# WorksiteID

WorksiteID è un prototipo universitario per la gestione della patente a crediti nei cantieri.

## Stack

- Node.js
- TypeScript
- Fastify
- Jest
- ESLint
- Prettier
- Hyperledger FireFly
- Hyperledger Fabric
- Go
- Docker

## Prerequisiti

Per l'avvio del progetto sono necessari:

- Git
- Node.js
- npm

Le componenti blockchain e l'ambiente FireFly/Fabric saranno configurati nelle issue dedicate.

## Struttura

* `backend/` — API e logica applicativa
* `frontend/` — interfaccia utente
* `chaincode/` — smart contract Hyperledger Fabric
* `circuits/` — circuiti Zero-Knowledge Proof
* `tests/` — test automatici
* `scripts/` — script di setup, test e pulizia
* `docs/` — documentazione tecnica

## Documentazione

La documentazione tecnica è disponibile nella directory `docs/`.

* `docs/architecture.md` — architettura e responsabilità dei moduli
* `docs/setup.md` — configurazione dell'ambiente e procedure di setup

