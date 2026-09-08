# Architettura

WorksiteID è organizzato in moduli separati, ognuno con una responsabilità specifica.

## Backend

Il backend è sviluppato in TypeScript con Fastify.

È il punto di ingresso delle richieste provenienti dal frontend e svolge il ruolo di orchestratore del sistema.

Si occupa principalmente di:

* gestione delle API;
* validazione degli input;
* gestione della logica applicativa;
* autenticazione e gestione delle sessioni utente;
* coordinamento delle operazioni blockchain;
* coordinamento delle operazioni relative alle ZKP.

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

Fornisce il ledger e l'esecuzione del chaincode.

Le funzionalità di autenticazione degli utenti applicativi non sono affidate a Fabric: Worker e Inspector vengono autenticati dal backend attraverso il sistema comune definito nella #8.

Fabric può utilizzare identità tecniche proprie dell'infrastruttura per consentire a FireFly e al backend di interagire con la rete, ma tali identità non rappresentano le identità applicative degli utenti.

## Chaincode

Il chaincode contiene le operazioni che devono essere eseguite e verificate sulla blockchain.

È sviluppato in Go.

Contiene principalmente:

* il modello on-chain della patente;
* il modello on-chain della sanzione;
* le regole relative all'applicazione delle penalità;
* l'aggiornamento dei crediti della patente;
* la gestione dello stato `ACTIVE` / `REVOKED`;
* la persistenza della patente e delle sanzioni sul ledger.

Il chaincode mantiene le regole che devono essere garantite a livello blockchain e non contiene la logica di autenticazione WebAuthn.

## Autenticazione e autorizzazione

L'autenticazione degli utenti è gestita dal backend attraverso il sistema comune definito nella #8.

Worker e Inspector utilizzano lo stesso meccanismo di autenticazione WebAuthn. Il tipo di utente viene identificato tramite `userType`.

Il flusso applicativo è:

```text
Worker / Inspector
        |
        | WebAuthn
        v
     Backend
        |
        | sessione autenticata
        v
   API applicative
        |
        | operazione autorizzata
        v
     FireFly
        |
        v
 Hyperledger Fabric
        |
        v
    Chaincode
```

Il backend agisce quindi come **trusted gateway** verso la blockchain.

Per le operazioni che richiedono un Inspector, il backend verifica che la sessione autenticata appartenga a un utente con `userType = INSPECTOR`.

L'identificativo dell'Inspector utilizzato per l'operazione viene ricavato dal contesto autenticato e non viene considerato attendibile se fornito arbitrariamente dal client.

Il chaincode riceve quindi le richieste provenienti dal backend attraverso il normale flusso FireFly/Fabric.

In questa versione del progetto Fabric non gestisce:

* login degli utenti;
* passkey o WebAuthn;
* sessioni applicative;
* JWT;
* identità applicative Worker/Inspector tramite MSP.

Il bypass diretto del chaincode da parte di utenti non autorizzati non rientra nel normale threat model applicativo: il backend costituisce il punto di ingresso autorizzato alle operazioni blockchain.

## Chaincode delle sanzioni

Il chaincode delle sanzioni implementa le operazioni relative alla patente a crediti e alle sanzioni.

L'operazione principale è l'emissione di una sanzione.

Il flusso è:

```text
Inspector autenticato
        |
        v
      Backend
        |
        | IssueSanction
        v
    Chaincode
        |
        +--> valida la sanzione
        |
        +--> verifica la patente
        |
        +--> applica la penalità
        |
        +--> aggiorna i crediti
        |
        +--> aggiorna lo stato
        |
        +--> salva la patente
        |
        +--> salva la sanzione
```

Le regole relative ai crediti sono applicate dal dominio utilizzato dal chaincode:

* una penalità deve essere maggiore di `0`;
* i crediti non possono diventare negativi;
* se la penalità supera i crediti disponibili, i crediti vengono portati a `0`;
* quando i crediti diventano inferiori a `15`, la patente viene impostata a `REVOKED`;
* una patente `REVOKED` non viene riportata a `ACTIVE`.

Il chaincode verifica inoltre che la patente associata alla sanzione esista e impedisce la registrazione di una seconda sanzione con lo stesso identificativo.

## ZKP

Le funzionalità Zero-Knowledge Proof sono mantenute separate dal resto dell'applicazione.

I circuiti definiscono le relazioni matematiche utilizzate nelle prove, mentre il backend ne coordina generazione e verifica.

Le ZKP vengono utilizzate per dimostrare determinate proprietà senza rivelare direttamente i dati sottostanti.

Commitment e ZKP saranno introdotti nelle issue successive e non fanno parte del chaincode delle sanzioni.

## Identità applicativa

WorksiteID distingue due tipi di utenti:

* `WORKER`;
* `INSPECTOR`.

L'identità applicativa è gestita dal backend tramite il sistema definito nelle issue #5, #6 e #8.

L'autenticazione viene effettuata tramite WebAuthn.

Il wallet locale identifica l'utente tramite:

* `userId`;
* `userType`.

Le identità applicative non vengono quindi modellate tramite Fabric MSP.

## Separazione delle responsabilità

L'architettura mantiene separate:

* interfaccia utente;
* autenticazione applicativa;
* logica applicativa;
* integrazione blockchain;
* infrastruttura blockchain;
* logica del chaincode;
* circuiti crittografici.

Questa separazione rende i componenti più semplici da sviluppare, testare e sostituire.
