#!/usr/bin/env bash

set -euo pipefail

echo "==> Verifica prerequisiti"

command -v git >/dev/null 2>&1 || {
    echo "Errore: Git non è installato."
    exit 1
}

command -v node >/dev/null 2>&1 || {
    echo "Errore: Node.js non è installato."
    exit 1
}

command -v npm >/dev/null 2>&1 || {
    echo "Errore: npm non è installato."
    exit 1
}

echo "Git: $(git --version)"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"

echo
echo "==> Installazione dipendenze"

npm ci

echo
echo "==> Setup completato"