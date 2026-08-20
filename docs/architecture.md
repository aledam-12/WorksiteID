# Architettura

WorksiteID è organizzato in moduli separati, ognuno con una responsabilità specifica.

## Backend

Il backend è sviluppato in TypeScript con Fastify.

È il punto di ingresso delle richieste provenienti dal frontend e svolge il ruolo di orchestratore del sistema.

Si occupa principalmente di:

- gestione delle API;
- validazione degli input;
- gestione della logica applicativa;
- coordinamento delle operazioni blockchain;
- coordinamento delle operazioni relative alle ZKP.

Il backend non accede direttamente a Hyperledger Fabric, ma utilizza FireFly.

## Frontend

Il frontend fornisce l'interfaccia per gli utenti del sistema.

Comunica esclusivamente con il backend tramite API e non interagisce direttamente con la blockchain.

## FireFly

FireFly viene utilizzato come livello di integrazione con la blockchain.

Il suo utilizzo permette al backend di rimanere indipendente dai dettagli specifici di Hyperledger Fabric.

La configurazione e la gestione dell'infrastruttura Fabric rimangono quindi separate dalla logica applicativa.

## Hyperledger Fabric

Hyperledger Fabric costituisce l'infrastruttura blockchain del sistema.

Fornisce il ledger, la gestione delle identità tramite MSP e l'esecuzione del chaincode.

Questi dettagli sono astratti dal backend attraverso FireFly.

## Chaincode

Il chaincode contiene le operazioni che devono essere eseguite e verificate sulla blockchain.

È sviluppato in Go.

Contiene principalmente la logica relativa allo stato che deve essere mantenuto sul ledger e alle operazioni che richiedono garanzie lato blockchain.

## ZKP

Le funzionalità Zero-Knowledge Proof sono mantenute separate dal resto dell'applicazione.

I circuiti definiscono le relazioni matematiche utilizzate nelle prove, mentre il backend ne coordina generazione e verifica.

Le ZKP vengono utilizzate per dimostrare determinate proprietà senza rivelare direttamente i dati sottostanti.

## Identità

Le identità utilizzate per interagire con Fabric sono gestite attraverso il sistema MSP di Fabric.

Il backend gestisce il processo applicativo di registrazione e autenticazione degli utenti e utilizza le identità appropriate per le operazioni che richiedono autorizzazione.

## Separazione delle responsabilità

L'architettura mantiene separate:

- interfaccia utente;
- logica applicativa;
- integrazione blockchain;
- infrastruttura blockchain;
- logica del chaincode;
- circuiti crittografici.

Questa separazione rende i componenti più semplici da sviluppare, testare e sostituire.