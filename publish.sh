#!/usr/bin/env bash
# Publishing goes through the tada command now (Downloads/TADA/tada-tool/tada.py):
# it saves this version on its own branch (v1 / v2) and rebuilds the live site.
#   bash publish.sh        same as: tada keep   (the live version stays)
#   bash publish.sh 1|2    same as: tada 1 / tada 2
set -euo pipefail
exec python "$(dirname "$0")/../tada-tool/tada.py" "${1:-keep}"
