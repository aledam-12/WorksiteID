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

La procedura di deployment richiede un package di chaincode e specifica:

* nome dello stack;
* package del chaincode;
* canale Fabric;
* nome del chaincode;
* versione del chaincode.

Per la configurazione locale attuale, il canale di riferimento è `firefly`.

Il chaincode non gestisce l'autenticazione WebAuthn degli utenti. L'autenticazione e l'autorizzazione applicativa vengono gestite dal backend, che costituisce il trusted gateway verso FireFly e Fabric.