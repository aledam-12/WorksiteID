## Setup

Clonare la repository:

```bash
git clone <repository-url>
cd WorksiteID
```

Preparare l'ambiente:

```bash
./scripts/setup.sh
``` 

Per eseguire lint, test e build:

```bash
./scripts/test.sh
```

Per pulire la directory di build:

```bash
./scripts/clean.sh
```

## FireFly e Hyperledger Fabric

La componente blockchain locale viene gestita tramite FireFly CLI.

Versione utilizzata:

- FireFly CLI: `1.5.0`

Installare FireFly CLI seguendo la documentazione ufficiale.

Creare lo stack Fabric:

```bash
ff init fabric worksiteid 2
````

Il parametro `2` configura due membri FireFly.

Avviare lo stack:

```bash
ff start worksiteid
```

Le interfacce locali dei due membri sono disponibili rispettivamente sulle porte `5000` e `5001`.

Per arrestare lo stack:

```bash
ff stop worksiteid
```

Lo stack viene generato e gestito da FireFly nella directory locale dell'utente e non viene versionato nella repository WorksiteID.

## Chaincode

Il chaincode di WorksiteID è sviluppato in Go e si trova nella directory:

```text
chaincode/
```

Per verificare che il chaincode sia compilabile ed eseguire i test:

```bash
cd chaincode
go test ./...
```

È inoltre consigliato verificare il formato del codice e la presenza di eventuali problemi statici:

```bash
gofmt -w .
go vet ./...
```

Il chaincode utilizza `fabric-contract-api-go` ed è destinato alla rete Hyperledger Fabric configurata dallo stack FireFly `worksiteid`.

Il canale Fabric utilizzato dallo stack è:

```text
firefly
```

Il deployment del chaincode viene effettuato tramite FireFly CLI.

### Packaging e Deploy Chaincode

Il chaincode viene impacchettato nel formato standard Fabric (`.tar.gz` contenente `metadata.json` e `code.tar.gz`).
È possibile eseguire packaging e deploy automatico tramite:

```bash
./scripts/setup.sh --deploy-chaincode
```

Oppure manualmente tramite i comandi FireFly e HTTP:

1. **Deploy del Chaincode su Fabric**:
```bash
ff deploy fabric worksiteid chaincode/sanctions_v2.tar.gz firefly sanctions 2.0
```

2. **Registrazione Interfaccia FFI su FireFly**:
```bash
curl -X POST http://127.0.0.1:5001/api/v1/namespaces/default/contracts/interfaces \
  -H "Content-Type: application/json" \
  -d @chaincode/sanctions-ffi.json
```

3. **Generazione API REST Gateway (`sanctionsv2.0`)**:
```bash
curl -X POST http://127.0.0.1:5001/api/v1/namespaces/default/apis \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sanctionsv2.0",
    "interface": {"id": "<FFI_INTERFACE_ID>"},
    "location": {"channel": "firefly", "chaincode": "sanctions"}
  }'
```

Il chaincode non gestisce l'autenticazione WebAuthn degli utenti. L'autenticazione e l'autorizzazione applicativa vengono gestite dal backend, che costituisce il trusted gateway verso FireFly e Fabric.

## Zero-Knowledge Proofs (ZKP Groth16 / BN254)

La piattaforma utilizza prove a conoscenza zero basate sul sistema Groth16 sulla curva ellittica BN254 (alt_bn128) per verificare che il lavoratore possieda una patente valida (`credits >= 15` e `status == ACTIVE`) senza rivelare il saldo effettivo né il segreto casuale off-chain.

### Pipeline di Compilazione e Setup

La pipeline ZKP è integrata in `setup.sh`:

```bash
# Esegue solo la pipeline ZKP
./scripts/setup.sh --zkp-only

# Forza la rigenerazione completa di PTAU e chiavi Groth16
./scripts/setup.sh --rebuild-zkp
```

I comandi manuali eseguiti dalla pipeline sono:

1. **Compilazione del circuito Circom**:
```bash
circom zkp/circuits/license_verification.circom -l node_modules --r1cs --wasm --sym -o zkp/build
```

2. **Cerimonia Powers of Tau (PTAU 2^12 per BN254)**:
```bash
npx snarkjs powersoftau new bn128 12 zkp/build/ptau/pot12_0000.ptau -v
npx snarkjs powersoftau contribute zkp/build/ptau/pot12_0000.ptau zkp/build/ptau/pot12_0001.ptau --name="WorksiteID" -v
npx snarkjs powersoftau prepare phase2 zkp/build/ptau/pot12_0001.ptau zkp/build/ptau/pot12_final.ptau -v
```

3. **Setup Groth16 e generazione Proving Key (`.zkey`)**:
```bash
npx snarkjs groth16 setup zkp/build/license_verification.r1cs zkp/build/ptau/pot12_final.ptau zkp/build/license_verification_0000.zkey
npx snarkjs zkey contribute zkp/build/license_verification_0000.zkey zkp/build/license_verification_final.zkey --name="WorksiteID Prover" -v
```

4. **Esportazione della Verification Key (`verification_key.json`)**:
```bash
npx snarkjs zkey export verificationkey zkp/build/license_verification_final.zkey zkp/build/verification_key.json
```

5. **Test di validazione della prova**:
```bash
node zkp/build/license_verification_js/generate_witness.js zkp/build/license_verification_js/license_verification.wasm zkp/inputs/license-verification.json zkp/build/witness.wtns
npx snarkjs groth16 prove zkp/build/license_verification_final.zkey zkp/build/witness.wtns zkp/build/proof-valid.json zkp/build/public-valid.json
npx snarkjs groth16 verify zkp/build/verification_key.json zkp/build/public-valid.json zkp/build/proof-valid.json
```


## Livello di Persistenza (MySQL)

### Configurazione Ambiente

Il modulo di connessione (`backend/src/database/connection.ts`) è configurabile tramite variabili d'ambiente:

* `DB_HOST`: host del server MySQL (default: `localhost`);
* `DB_PORT`: porta di ascolto (default: `3306`);
* `DB_NAME`: nome del database applicativo (`worksiteid` per sviluppo/produzione, `worksiteid_test` per i test di integrazione);
* `DB_USER`: utente database (default: `root`);
* `DB_PASSWORD`: password database;
* `LICENSE_REF_SECRET`: chiave segreta per la derivazione HMAC-SHA256 di `licenseRef` (obbligatoria in produzione, configurabile in dev/test, mai memorizzata o esposta).

## Verifiable Credentials (VC) Issuer

L'Issuer delle Verifiable Credential utilizza una coppia di chiavi asimmetriche Ed25519 persistenti per apporre la firma digitale.

### Generazione Chiavi di Sviluppo Locale

Per generare le chiavi persistenti per lo sviluppo locale:

```bash
npm run keys:generate
```

Questo comando genera:
* `./secrets/issuer-private-key.pem` (chiave privata Ed25519 PKCS#8)
* `./secrets/issuer-public-key.pem` (chiave pubblica Ed25519 SPKI)

La directory `secrets/` e i relativi file `.pem` sono rigorosamente esclusi dal versionamento Git tramite `.gitignore`.