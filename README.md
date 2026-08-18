# WorksiteID

WorksiteID è un prototipo universitario per la gestione della patente a crediti nei cantieri.

Il progetto combina:

- Self-Sovereign Identity / Verifiable Credentials
- WebAuthn
- cifratura locale AES-256-GCM
- pseudonimizzazione
- Hyperledger Fabric
- FireFly
- commitment crittografici
- Zero-Knowledge Proof
- challenge-response
- versionamento dello stato

## Architettura

Il sistema separa:

- identità e attestazioni
- autenticazione del Holder
- stato amministrativo
- prova crittografica
- ledger distribuito

Fabric viene utilizzato attraverso FireFly come livello di astrazione.

## Stato del progetto

Work in progress.

## Ambiente

Sviluppo locale tramite WSL e Docker.

## Disclaimer

Il progetto è un prototipo universitario e non rappresenta un'implementazione production-grade di EUDI Wallet, SSI o di un sistema reale di gestione della patente a crediti.
