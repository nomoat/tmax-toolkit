#!/usr/bin/env python3
"""Include the locked Rust dependency license notices in a binary archive."""
import json
import pathlib
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
destination = pathlib.Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)
metadata = json.loads(subprocess.check_output([
    "cargo", "metadata", "--locked", "--format-version", "1",
    "--manifest-path", str(root / "tmux-jump/Cargo.toml"),
]))
lines = []
for package in metadata["packages"]:
    if not package["source"]:
        continue
    identity = f'{package["name"]}-{package["version"]}'
    lines.append(f'{identity}: {package.get("license") or "See included license file"}')
    package_root = pathlib.Path(package["manifest_path"]).parent
    files = [p for p in package_root.iterdir() if p.is_file() and
             p.name.upper().startswith(("LICENSE", "COPYING", "NOTICE"))]
    if package.get("license_file"):
        files.append(package_root / package["license_file"])
    for source in set(files):
        if source.is_file():
            target = destination / identity / source.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
(destination / "RUST-DEPENDENCIES.txt").write_text("\n".join(sorted(lines)) + "\n")
