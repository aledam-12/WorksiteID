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