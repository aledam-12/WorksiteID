# Architettura

WorksiteID è organizzato in moduli separati, ognuno con una responsabilità specifica, secondo i principi di **Privacy by Design** e **Separazione dei Domini** (privato off-chain vs pubblico on-chain).

## Backend

Il backend è sviluppato in TypeScript con Fastify.

È il punto di ingresso delle richieste provenienti dal frontend e svolge il ruolo di orchestratore del sistema.

Si occupa principalmente di:

* gestione delle API e validazione degli input;
* gestione della logica applicativa e del dominio privato (`PrivateLicenseState`, `Sanction`);
* autenticazione e gestione delle sessioni utente tramite WebAuthn;
* gestione del wallet locale dell'utente (`WalletService`, `WalletRepository`);
* calcolo e verifica dei commitment crittografici dello stato (`CommitmentService`);
* coordinamento delle operazioni blockchain verso FireFly (`BlockchainService`);
* coordinamento delle operazioni relative alle ZKP (generazione prove e verifica).

Il backend non accede direttamente a Hyperledger Fabric, ma utilizza FireFly come intermediario.

## Frontend

Il frontend fornisce l'interfaccia per gli utenti del sistema (Worker e Inspector).

Comunica esclusivamente con il backend tramite API REST e non interagisce direttamente con la blockchain.

## FireFly

FireFly viene utilizzato come livello di integrazione con la blockchain.

Il suo utilizzo permette al backend di rimanere indipendente dai dettagli specifici di Hyperledger Fabric, esponendo una REST API generata automaticamente a partire dall'interfaccia FFI (`sanctions-ffi.json`).

La configurazione e la gestione dell'infrastruttura Fabric rimangono quindi separate dalla logica applicativa.

## Hyperledger Fabric

Hyperledger Fabric costituisce l'infrastruttura blockchain del sistema.

Fornisce il distributed ledger immutabile e l'ambiente di esecuzione del chaincode.

Le funzionalità di autenticazione degli utenti applicativi non sono affidate a Fabric: Worker e Inspector vengono autenticati dal backend attraverso il sistema comune WebAuthn.

Fabric utilizza identità tecniche proprie dell'infrastruttura (organizzazioni, peer, orderer) per consentire a FireFly e al backend di interagire con la rete, ma tali identità non rappresentano le identità applicative degli utenti.

## Chaincode

Il chaincode contiene le operazioni che devono essere eseguite e verificate sulla blockchain.

È sviluppato in Go e adotta un'architettura **Privacy-Preserving**: nessun dato privato della patente (`credits`, `status`, `randomness`, anagrafica) o della sanzione (`penalty`, `reason`, riferimenti personali) viene mai memorizzato sul ledger.

Sul ledger risiedono esclusivamente:

* **Stato pubblico della patente (`LicenseOnChain`)**:
  * `licenseRef` — identificativo opaco e pseudonimo della patente;
  * `commitment` — digest crittografico dello stato privato calcolato dal backend;
  * `version` — numero sequenziale di versione ($\ge 1$).
* **Metadati pubblici della sanzione (`SanctionOnChain`)**:
  * `id` — identificativo univoco della sanzione;
  * `licenseRef` — riferimento opaco della patente a cui è applicata;
  * `sanctionCommitment` — digest crittografico dei dati privati della sanzione;
  * `issuedAt` — timestamp certo generato direttamente dalla transazione Fabric (`ctx.GetStub().GetTxTimestamp()`);
  * `inspectorRef` — identificativo pseudonimo dell'ispettore;
  * `version` — versione della patente risultante dall'emissione della sanzione.

## Autenticazione e autorizzazione

L'autenticazione degli utenti è gestita dal backend attraverso il sistema comune WebAuthn/Passkey.

Worker e Inspector utilizzano lo stesso meccanismo di autenticazione. Il tipo di utente viene identificato tramite `userType`.

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

Il backend agisce come **trusted gateway** verso la blockchain:
* per le operazioni che richiedono un Inspector, verifica che la sessione appartenga a un utente con `userType = INSPECTOR`;
* l'identificativo dell'Inspector per l'operazione viene ricavato dal contesto autenticato e non da parametri client arbitrari.

## Flusso di emissione sanzione

L'emissione di una sanzione coinvolge sia il dominio privato custodito nel wallet, sia il calcolo dei commitment, sia l'ancoraggio immutabile sul ledger:

```text
Inspector autenticato
        |
        v
     Backend
        |
        +--> 1. Recupera lo stato privato corrente della patente (PrivateLicenseState)
        |
        +--> 2. Applica la penalità nel dominio privato:
        |       creditsNew = max(0, creditsOld - penalty)
        |       statusNew  = creditsNew >= 15 ? ACTIVE : REVOKED
        |       versionNew = versionOld + 1
        |
        +--> 3. Genera nuova randomness CSPRNG crittograficamente sicura (256 bit)
        |
        +--> 4. Calcola i commitment crittografici tramite CommitmentService:
        |       newCommitment      = SHA-256(canonicalize({ stateNew, randomnessNew }))
        |       sanctionCommitment = SHA-256(canonicalize({ sanctionPrivateData, sanctionRandomness }))
        |
        | 5. Invocazione IssueSanction(sanctionID, licenseRef, sanctionCommitment, newCommitment, inspectorRef)
        v
     FireFly
        |
        v
    Chaincode
        |
        +--> valida che licenseRef esista sul ledger
        +--> valida che sanctionID non esista già
        +--> verifica che newCommitment != currentCommitment
        +--> incrementa la versione on-chain (pubState.Version + 1)
        +--> aggiorna LicenseOnChain con (newCommitment, newVersion)
        +--> registra SanctionOnChain con timestamp transazione Fabric e newVersion
```

La correttezza matematica della transizione di stato tra crediti precedenti e crediti aggiornati ($credits_{new} = credits_{old} - penalty$) non è calcolata in chiaro dal chaincode, ma viene garantita e verificata off-chain tramite prove a conoscenza zero (**ZKP**).

## Schema di Commitment dello Stato

Il sistema adotta uno schema di commitment crittografico SNARK-friendly (funzione hash **Poseidon**) per garantire la riservatezza, l'integrità e la verificabilità a conoscenza zero dei dati del lavoratore:

### Algoritmo di Commitment (Poseidon)

Dato uno stato privato $S = (\text{credits}, \text{status}, \text{version})$ e un valore di randomness crittografica $R$:

$$C = \text{Poseidon}(\text{credits}, \text{status}, \text{version}, R) \pmod p$$

### Proprietà di Sicurezza del Commitment

* **Hiding**: è computazionalmente impossibile dedurre $S$ (crediti, stato o versione) osservando esclusivamente il commitment $C$ on-chain, grazie all'elevata entropia della randomness $R$ (248 bit).
* **Binding**: per le proprietà crittografiche dell'hash algebrico Poseidon (resistenza alle collisioni e alla pre-immagine), è computazionalmente impossibile trovare una quadrupla $(\text{credits}', \text{status}', \text{version}', R') \ne (\text{credits}, \text{status}, \text{version}, R)$ tale per cui $\text{Poseidon}(\dots) = C$. Una volta pubblicato $C$ sul ledger, lo stato è congelato e non falsificabile.

---

## ZKP (Zero-Knowledge Proofs) & Verifica al Varco

WorksiteID impiega il sistema di prova a conoscenza zero **Groth16** per consentire la verifica dell'accesso al cantiere nel rispetto assoluto del GDPR (minimizzazione dei dati e privacy by design).

### Il Circuito Aritmetico (`license_verification.circom`)

Il circuito impone i seguenti vincoli algebrici (R1CS):

* **Segnali Privati (Witness)**:
  - `credits`: saldo punti della patente del lavoratore;
  - `status`: stato della patente ($1 = \text{ACTIVE}$, $0 = \text{REVOKED}$);
  - `version`: versione dello stato;
  - `randomness`: segreto crittografico CSPRNG associato alla versione corrente.
* **Segnali Pubblici (Noti a Prover e Verifier)**:
  - `commitment`: commitment registrato on-chain sul ledger;
  - `challenge`: sfida casuale monouso emessa dal varco/backend;
  - `challengeBinding`: digest che lega la challenge alla randomness del lavoratore.
* **Vincoli Verificati nel Circuito**:
  1. `credits >= 15`: implementato mediante comparatore a 8 bit `LessThan(8)`;
  2. `status === 1`: verifica che la patente sia attiva;
  3. `commitment === Poseidon([credits, status, version, randomness])`: vincola la prova allo stato pubblico registrato;
  4. `challengeBinding === Poseidon([commitment, challenge, randomness])`: dimostra che il Prover possiede la specifica randomness $R$ legata al commitment senza mai rivelarla.

---

### Regole del verificatore (`LicenseVerificationService`)

1. **Coerenza con la Blockchain**: Se la patente non è registrata sul ledger Fabric o se il commitment nei segnali pubblici differisce da quello registrato on-chain (`onChainState.commitment !== publicSignals.commitment`), l'esito è immediatamente `NOT_PASS` (es. patente sanzionata con commitment non aggiornato dal worker).
2. **Minimizzazione dei Dati**: La risposta di verifica contiene esclusivamente `{ outcome: "PASS" }` oppure `{ outcome: "NOT_PASS", reason: "..." }`. Nessun campo relativo a crediti, timestamp di sanzione, randomness o witness viene mai registrato nei log o restituito nella risposta.

---

## Identità applicativa

WorksiteID distingue due tipi di utenti:

* `WORKER`;
* `INSPECTOR`.

L'identità applicativa è gestita dal backend tramite passkey WebAuthn.

Il wallet locale identifica l'utente tramite `userId` e `userType`. Per i lavoratori, il wallet custodisce il `PrivateLicenseState` contenente crediti, stato e randomness necessari a calcolare i testimoni e a generare le prove ZKP.

## Separazione delle responsabilità

L'architettura mantiene rigorosamente separate:

* **Interfaccia utente**: interazione con l'utente (Worker o Inspector);
* **Autenticazione applicativa**: WebAuthn / Passkey;
* **Dominio privato**: `PrivateLicenseState`, crediti, sanzioni, wallet locale del lavoratore;
* **Crittografia**: `CommitmentService` (Poseidon), `ChallengeService` (CSPRNG), `ZkpService` (Groth16);
* **Orchestrazione di Verifica**: `LicenseVerificationService` (collegamento tra wallet, prova e blockchain);
* **Integrazione blockchain**: `FireFlyClient` e `BlockchainService`;
* **Infrastruttura ledger**: Hyperledger Fabric e storage immutabile dei soli metadati pubblici (`LicenseOnChain`, `SanctionOnChain`).