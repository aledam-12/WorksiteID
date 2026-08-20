#!/usr/bin/env bash

set -euo pipefail

echo "==> Pulizia artefatti"

rm -rf dist
rm -rf backend/dist
rm -rf coverage

echo "==> Pulizia completata"