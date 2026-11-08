#!/usr/bin/env bash
# Publishes the site to GitHub Pages: rebuilds tada.html, commits everything in this
# folder and pushes it. GitHub Pages then serves the new version in about a minute.
#
# First time only (after creating an empty repository on github.com):
#   bash publish.sh https://github.com/USER/REPO.git
# Every update after that:
#   bash publish.sh
set -euo pipefail
cd "$(dirname "$0")"

python stamp.py
python build-single.py

if [ ! -d .git ]; then
  url="${1:?first run: pass the repository address, e.g. bash publish.sh https://github.com/USER/tada.git}"
  git init -b main
  git remote add origin "$url"
fi

git add -A
if git diff --cached --quiet; then
  echo "Nothing new to publish."
  exit 0
fi
git commit -m "Update site $(date '+%Y-%m-%d %H:%M')"
git push -u origin main
echo "Pushed. GitHub Pages shows the new version in about a minute."
