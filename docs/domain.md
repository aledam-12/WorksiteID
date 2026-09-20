# Modello di dominio

## Obiettivo

Il dominio di WorksiteID rappresenta la patente a crediti associata a un lavoratore e le sanzioni che ne modificano lo stato.

Il sistema adotta un approccio **Privacy by Design**: i dati sensibili del lavoratore (crediti effettivi, motivazioni e penalità delle sanzioni, anagrafica) risiedono esclusivamente nel dominio applicativo, mentre la blockchain (Hyperledger Fabric) ospita unicamente riferimenti opachi e commitment crittografici dello stato.

---

## Entità del Dominio Privato (Off-Chain / Wallet / Database)

### User

Rappresenta l'identità applicativa e di autenticazione comune a Worker e Inspector:

* `id` — identificativo univoco dell'utente;
* `userType` — tipo di utente (`worker` o `inspector`);
* `createdAt` — data e ora di registrazione.

Non contiene password, chiavi private o credenziali Fabric. L'autenticazione è delegata a passkey WebAuthn (`WebAuthnCredentials`).

### Worker

Rappresenta il lavoratore dell'impresa edile:

* `id` — identificativo univoco del lavoratore (chiave esterna verso `users.id`);
* `name` — nome del lavoratore;
* `surname` — cognome del lavoratore;
* `cf` — codice fiscale (univoco nel sistema);
* `company` — impresa di appartenenza.

Nel database relazionale la tabella `workers` non contiene la colonna `license_id`: la titolarità della patente è modellata in modo autorevole ed esclusivo dal vincolo `private_licenses.worker_id -> workers.id` (`UNIQUE`).

### Inspector

Rappresenta l'ispettore che opera nel sistema e che può emettere sanzioni:

* `id` — identificativo univoco dell'ispettore (chiave esterna verso `users.id`).

L'autenticazione dell'Inspector viene gestita tramite WebAuthn e il ruolo viene verificato dal backend prima di qualsiasi operazione sul ledger.

### Patente e PrivateLicenseState

Rappresenta la patente a crediti del lavoratore e il suo stato privato:

* `licenseId` — identificativo univoco della patente;
* `workerId` — identificativo del lavoratore titolare (relazione 1:1);
* `licenseRef` — riferimento deterministico pseudonimo calcolato tramite HMAC-SHA256(`secret`, `licenseId`);
* `credits` — numero corrente di crediti ($\ge 0$);
* `status` — stato corrente della patente (`ACTIVE` oppure `REVOKED`);
* `randomness` — valore crittografico casuale a 256 bit (CSPRNG) generato per ciascuna versione dello stato;
* `version` — numero progressivo di versione ($\ge 1$).

Una nuova patente viene inizializzata con:
* `30` crediti;
* stato `ACTIVE`;
* `version = 1`;
* randomness generata tramite `CommitmentService`.

Il `PrivateLicenseState` è custodito nel database e nel wallet del lavoratore; non viene mai pubblicato sul ledger pubblico.

### Sanzione (Dati Privati)

Rappresenta la penalizzazione applicata alla patente nel dominio applicativo:

* `id` — identificativo univoco della sanzione;
* `penalty` — numero intero di crediti da sottrarre ($> 0$);
* `licenseRef` — riferimento opaco alla patente sanzionata (chiave esterna verso `private_licenses.license_ref`);
* `reason` — motivazione dettagliata della sanzione;
* `inspectorRef` — riferimento all'ispettore emittente (chiave esterna verso `inspectors.id`);
* `issuedAt` — momento di emissione;
* `randomness` — valore casuale per il commitment.
* `inspectorId` — identificativo dell'ispettore che ha emesso la sanzione.

La motivazione e l'entità della penalità non vengono salvate sul ledger, proteggendo la privacy del lavoratore e dell'impresa.

---

## Entità del Dominio On-Chain (Blockchain / Ledger)

Le entità on-chain sono quelle registrate e consultate tramite il chaincode Hyperledger Fabric e l'interfaccia FireFly (`sanctions-ffi.json`):

### LicenseOnChain (Stato Pubblico Patente)

Rappresenta lo stato pubblico e verificabile della patente memorizzato sul ledger:

* `licenseRef` — identificativo opaco e pseudonimo della patente (distinto dal `licenseId` reale);
* `commitment` — commitment crittografico SHA-256 calcolato sullo stato privato (`PrivateLicenseState`) e sulla relativa randomness;
* `version` — numero sequenziale di versione della patente ($\ge 1$).

Sul ledger non è possibile evincere il saldo crediti o lo stato della patente, prevenendo discriminazioni e profilazioni.

### SanctionOnChain (Metadati Pubblici Sanzione)

Rappresenta i metadati pubblici della sanzione registrati sul ledger:

* `id` — identificativo univoco della sanzione;
* `licenseRef` — riferimento opaco della patente a cui è applicata;
* `sanctionCommitment` — commitment crittografico calcolato sui dati privati della sanzione;
* `issuedAt` — timestamp certo generato direttamente dal consenso Fabric al momento della transazione;
* `inspectorRef` — identificativo pseudonimo dell'ispettore;
* `version` — versione della patente generata a seguito dell'applicazione della sanzione.

---

## Relazioni tra i Modelli

```mermaid
classDiagram
    direction TB

    package "Dominio Privato (Off-Chain / Wallet)" {
        class Worker {
            id: string
            name: string
            surname: string
            cf: string
            company: string
            licenseId: string
        }

        class Inspector {
            id: string
        }

        class PrivateLicenseState {
            licenseId: string
            credits: number
            status: LicenseStatusEnum
            randomness: string
            version: number
            computeCommitment() string
        }

        class Sanction {
            id: string
            penalty: number
            licenseId: string
            reason: string
            issuedAt: Date
            inspectorId: string
        }
    }

    package "Dominio Pubblico (On-Chain / Ledger)" {
        class LicenseOnChain {
            licenseRef: string
            commitment: string
            version: number
        }

        class SanctionOnChain {
            id: string
            licenseRef: string
            sanctionCommitment: string
            issuedAt: Date
            inspectorRef: string
            version: number
        }
    }

    Worker "1" --> "1" PrivateLicenseState : possiede nel wallet
    PrivateLicenseState ..> LicenseOnChain : genera commitment
    Inspector "1" --> "0..*" Sanction : emette
    Sanction ..> SanctionOnChain : genera sanctionCommitment
    LicenseOnChain "1" --> "0..*" SanctionOnChain : traccia transizioni
```

---

## Regole di Dominio

### Crediti Iniziali e Soglie

1. **Inizializzazione**: ogni nuova patente nasce con **30 crediti**, stato **`ACTIVE`** e **`version = 1`**.
2. **Soglia di revoca**:
   * $\text{credits} \ge 15 \implies \text{ACTIVE}$;
   * $\text{credits} < 15 \implies \text{REVOKED}$.
3. **Irreversibilità**: una patente nello stato `REVOKED` non può tornare ad `ACTIVE`. Non sono previsti reintegri crediti nella presente versione.

### Applicazione di una Sanzione e Transizione di Stato

1. **Penalità valida**: una sanzione deve specificare una penalità intera strettamente maggiore di zero ($\text{penalty} > 0$).
2. **Non negatività**: se la penalità supera i crediti residui, i crediti vengono azzerati ($\text{credits}_{\text{new}} = \max(0, \text{credits}_{\text{old}} - \text{penalty})$).
3. **Aggiornamento dello stato**: se $\text{credits}_{\text{new}} < 15$, lo stato diventa `REVOKED`.
4. **Incremento di versione**: ogni sanzione produce un nuovo stato privato con $\text{version}_{\text{new}} = \text{version}_{\text{old}} + 1$ e una nuova randomness crittografica $R_{\text{new}}$.
5. **Aggiornamento on-chain**: sul ledger viene registrato il nuovo commitment $C_{\text{new}}$ e la sanzione $S_{\text{on-chain}}$ con la medesima versione.

---

## Schema di Commitment dello Stato

Il backend implementa uno schema di commitment crittografico conforme alle proprietà di **Hiding** (riservatezza) e **Binding** (non ripudiabilità):

### Formula del Commitment

$$C = \text{SHA-256}(\text{canonicalize}(\{ \text{state}: S, \text{randomness}: R \}))$$

* **Stato canonico ($S$)**: per la patente include `{ licenseId, credits, status, version }`.
* **Randomness ($R$)**: stringa esadecimale generata da 32 byte casuali crittograficamente sicuri (CSPRNG).
* **Canonicalizzazione**: ordinamento ricorsivo delle chiavi dell'oggetto prima della serializzazione JSON per garantire l'assoluta riproducibilità dell'hashing.

### Catena di Commitment ($C_1 \to C_2 \to \dots$)

Ogni aggiornamento della patente produce un nuovo commitment sul ledger:
* Stato iniziale (versione 1): $C_1 = \text{Commitment}(S_1, R_1)$
* Prima sanzione (versione 2): $C_2 = \text{Commitment}(S_2, R_2)$
* Il chaincode garantisce l'avanzamento sequenziale e che $C_{n+1} \ne C_n$.

---

## Verifica al Varco (ZKP)

Al momento dell'accesso al cantiere:
1. Il Worker non rivela il saldo crediti o le sanzioni ricevute.
2. Tramite circuito ZKP (Issue 12), il Worker genera una prova attestante che:
   * conosce uno stato privato $(S, R)$ tale che $\text{Commitment}(S, R) = C_{\text{corrente}}$;
   * $C_{\text{corrente}}$ corrisponde all'ultimo commitment registrato sul ledger per la sua patente;
   * i crediti associati a $S$ soddisfano la condizione $\text{credits} \ge 15$ (patente valida/attiva).
3. Il Verifier verifica la prova e restituisce l'esito:
   * **`PASS`** — accesso consentito;
   * **`NOT_PASS`** — accesso negato.

---

## WebAuthn e Wallet Locale

* **WebAuthn**: utilizzato unicamente per autenticare le identità applicative (Worker e Inspector) tramite passkey. Le credenziali contengono `publicKey` e `counter` e non memorizzano crediti o commitment.
* **Wallet**: contenitore locale persistito sul dispositivo del lavoratore. Per gli utenti di tipo `WORKER`, custodisce il `PrivateLicenseState` per consentire la generazione delle prove e il calcolo dei commitment.
