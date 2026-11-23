#!/usr/bin/env bash
# Copies the static Tada website (the GitHub Pages output at the repository root) into deploy/site,
# so nginx serves only these files and nothing else from the repository.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
out="$here/site"
rm -rf "$out" && mkdir -p "$out"
for f in index.html tada.html versions.json; do [ -f "$repo/$f" ] && cp "$repo/$f" "$out/"; done
for d in assets css js v1 v2; do [ -d "$repo/$d" ] && cp -r "$repo/$d" "$out/"; done
echo "site copied to $out"
