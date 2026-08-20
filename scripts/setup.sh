#!/usr/bin/env bash

set -euo pipefail

STACK_NAME="worksiteid"
FIREFLY_STACK_DIR="$HOME/.firefly/stacks/$STACK_NAME"

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

command -v ff >/dev/null 2>&1 || {
    echo "Errore: FireFly CLI non è installato."
    exit 1
}

echo "Git: $(git --version)"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"

echo
echo "==> Installazione dipendenze"

npm ci

echo
echo "==> Verifica FireFly"

ff version

if [ ! -d "$FIREFLY_STACK_DIR" ]; then
    echo
    echo "==> Creazione stack FireFly/Fabric"

    ff init fabric "$STACK_NAME" 2
else
    echo
    echo "==> Stack FireFly '$STACK_NAME' già presente"
fi

echo
echo "==> Avvio FireFly/Fabric"

ff start "$STACK_NAME"

echo
echo "==> Setup completato"