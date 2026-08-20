#!/usr/bin/env bash

set -euo pipefail

echo "==> ESLint"
npm run lint

echo
echo "==> Jest"
npm test

echo
echo "==> TypeScript build"
npm run build

echo
echo "==> Tutte le verifiche sono state superate"