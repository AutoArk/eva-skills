#!/usr/bin/env python3
from __future__ import annotations

import ast
import json
import re
import sys
import tomllib
from pathlib import Path


PYPI_REGISTRY = "https://pypi.org/simple"
PUBLIC_IMPORTS = {
    "autoark-eva-client-sdk": {
        "eva_client_sdk",
        "eva_client_sdk.contracts",
        "eva_client_sdk.media",
    }
}
FORBIDDEN_SOURCE_KEYS = {"editable", "git", "path", "url", "workspace"}
IGNORED_DIRECTORIES = {".git", ".venv", "__pycache__", "build", "dist"}


def fail(message: str) -> None:
    raise RuntimeError(message)


def normalized_name(value: str) -> str:
    return re.sub(r"[-_.]+", "-", value).lower()


def contains_forbidden_source(value: object) -> bool:
    if isinstance(value, dict):
        if set(value) & FORBIDDEN_SOURCE_KEYS:
            return True
        return any(contains_forbidden_source(item) for item in value.values())
    if isinstance(value, list):
        return any(contains_forbidden_source(item) for item in value)
    return False


def exact_requirement_version(dependencies: object, package_name: str) -> str:
    if not isinstance(dependencies, list):
        fail("project.dependencies must be an array")
    pattern = re.compile(
        rf"^{re.escape(package_name)}(?:\[[A-Za-z0-9_,.-]+\])?=="
        r"([0-9A-Za-z][0-9A-Za-z.!+_-]*)$",
        re.IGNORECASE,
    )
    matches = [
        match
        for dependency in dependencies
        if isinstance(dependency, str) and (match := pattern.fullmatch(dependency))
    ]
    if len(matches) != 1:
        fail(f"{package_name}: exactly one exact project dependency is required")
    return matches[0].group(1)


def validate_pyproject(pyproject: dict[str, object], package_name: str) -> tuple[str, str]:
    project = pyproject.get("project")
    if not isinstance(project, dict):
        fail("pyproject.toml project table is required")
    project_name = project.get("name")
    if not isinstance(project_name, str) or not project_name:
        fail("pyproject.toml project.name is required")
    version = exact_requirement_version(project.get("dependencies"), package_name)

    tool = pyproject.get("tool")
    uv = tool.get("uv") if isinstance(tool, dict) else None
    if not isinstance(uv, dict):
        fail("pyproject.toml tool.uv table is required")
    sources = uv.get("sources")
    if sources != {package_name: {"index": "eva-pypi"}}:
        fail(f"{package_name}: tool.uv.sources must contain only the eva-pypi SDK source")
    indexes = uv.get("index")
    if indexes != [{"name": "eva-pypi", "url": PYPI_REGISTRY, "explicit": True}]:
        fail("eva-pypi must be the explicit https://pypi.org/simple index")
    if contains_forbidden_source(sources):
        fail("pyproject.toml contains a local, Git, workspace, or direct URL source")
    return project_name, version


def validate_lock(
    lock: dict[str, object], package_name: str, project_name: str, version: str
) -> None:
    packages = lock.get("package")
    if not isinstance(packages, list) or not packages:
        fail("uv.lock must contain packages")
    matches = [
        item for item in packages
        if isinstance(item, dict) and normalized_name(str(item.get("name", ""))) == normalized_name(package_name)
    ]
    if len(matches) != 1:
        fail(f"uv.lock must contain exactly one {package_name} package")
    sdk = matches[0]
    if sdk.get("version") != version:
        fail(f"uv.lock SDK version drifted: {sdk.get('version')} != {version}")
    if sdk.get("source") != {"registry": PYPI_REGISTRY}:
        fail(f"uv.lock SDK must resolve from {PYPI_REGISTRY}")

    for item in packages:
        if not isinstance(item, dict):
            fail("uv.lock package entries must be tables")
        source = item.get("source")
        if not isinstance(source, dict):
            fail(f"uv.lock package {item.get('name')} has no source")
        if set(source) & FORBIDDEN_SOURCE_KEYS:
            fail(f"uv.lock package {item.get('name')} uses a forbidden source")
        is_project = normalized_name(str(item.get("name", ""))) == normalized_name(project_name)
        expected_source = {"virtual": "."} if is_project else {"registry": PYPI_REGISTRY}
        if source != expected_source:
            fail(f"uv.lock package {item.get('name')} must use source {expected_source}")


def validate_public_imports(directory: Path, package_name: str) -> list[str]:
    allowed = PUBLIC_IMPORTS.get(package_name)
    if allowed is None:
        fail(f"{package_name}: public Python import allowlist is not defined")
    imports: set[str] = set()
    for path in directory.rglob("*.py"):
        if any(part in IGNORED_DIRECTORIES for part in path.relative_to(directory).parts):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules = [node.module]
            else:
                continue
            for module in modules:
                if module == "eva_client_sdk" or module.startswith("eva_client_sdk."):
                    imports.add(module)
                    if module not in allowed:
                        fail(f"forbidden non-public SDK import: {module}")
    if not imports:
        fail(f"Python example does not import the public {package_name} SDK")
    return sorted(imports)


def main() -> int:
    if len(sys.argv) != 3:
        fail("usage: inspect-python-example.py <directory> <sdk-package>")
    directory = Path(sys.argv[1]).resolve()
    package_name = sys.argv[2]
    pyproject_path = directory / "pyproject.toml"
    lock_path = directory / "uv.lock"
    pyproject = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    lock = tomllib.loads(lock_path.read_text(encoding="utf-8"))
    project_name, version = validate_pyproject(pyproject, package_name)
    validate_lock(lock, package_name, project_name, version)
    imports = validate_public_imports(directory, package_name)
    print(json.dumps({"package": package_name, "version": version, "publicImports": imports}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, SyntaxError, ValueError, tomllib.TOMLDecodeError) as error:
        raise SystemExit(f"Python example validation failed: {error}") from None
