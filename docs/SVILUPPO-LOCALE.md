# Sviluppo in locale: CardApp + wsClientiCloud + wsCard

Guida passo passo per far girare **tutta la catena in locale sul PC**, usando i database di **test** (mai la produzione).
Il telefono Android è collegato al PC con il **cavo USB** e raggiunge il servizio locale tramite `adb reverse`.

```
Telefono Android (CardApp)
   │  http://localhost:5000   ── adb reverse (USB) ──►  porta 5000 del PC
   ▼
wsClientiCloud  (repo cloud-server, progetto TTI.wsClientiCloud, porta 5000)
   │  DB sistema: cloudsystemtest.fdb su skyoneserver.it   (account clienti, esercenti)
   │  http://localhost:5150
   ▼
wsCard          (repo GestioneCard, progetto wsCard, porta 5150)
      DB card:    CARD_TEST.FDB su 80.211.78.150             (card, saldi, movimenti)
      DB cloud:   cloudsystemtest.fdb su skyoneserver.it     (collegamento clienti ↔ anagrafiche)
```

> **Regola d'oro:** in locale `cloudsystem.fdb` (senza "test") **non deve mai comparire** nelle configurazioni attive. È la produzione.

---

## 1. Prerequisiti

- Visual Studio con .NET (cloud-server è netcoreapp3.1, GestioneCard è .NET 10).
- Node + dipendenze di CardApp installate (`npm install`) e il **development build** installato sul telefono (`npx expo run:android`).
- Telefono Android con **Debug USB** attivo, collegato al PC con il cavo; `adb devices` deve mostrarlo come `device` (non `unauthorized`).
- Branch:
  - cloud-server → `feat/ponteCardClienti` (o il branch in cui è stato unito; deve contenere `src/TTI.Clienti/CardClientiService.cs`)
  - GestioneCard → `feat_endpoint_cliente` (o successivo; deve contenere il blocco `CLOUDSYSTEM_HOST` in `src/wsCard/Startup.cs`)
- Facoltativo ma utile: un client Firebird (IBExpert o FlameRobin) per controllare i dati.

---

## 2. Configurazione (una volta sola)

Le password **non** sono scritte in questa guida: dove serve un segreto è indicato da dove copiarlo.

### 2.1 wsClientiCloud — `cloud-server/src/TTI.wsClientiCloud/appsettings.Development.json`

```jsonc
"DataBaseHost": "skyoneserver.it",
"DataBaseSysHost": "skyoneserver.it",
"DataBaseSysNome": "/var/lib/firebird/3.0/data/cloudsystemtest.fdb",
"DataBaseSysUser": "SYSDBA",
"DataBaseSysPassword": "<password SYSDBA di skyoneserver.it>",

// facoltativo: link dell'email di conferma verso il servizio locale invece che verso la produzione
"EMailValidaClienteBody": "http://localhost:5000/CLE/ValidaAccount/{0}",

// wsCard locale
"CardBaseUrl": "http://localhost:5150",
"CardClientiKey": "<valore di KEYHASHCARDCLIENTI>",
```

- **Password SYSDBA**: è la stessa di `DBPWD_CLOUD` scritta in `GestioneCard/src/wsCard/wsCloudSystemConfig.cs`. In alternativa si può impostare la variabile d'ambiente `DATABASE_SYSPWD`, che ha la precedenza sul file.
- **CardClientiKey**: costante `KEYHASHCARDCLIENTI` in `GestioneCard/src/wsCard/Controllers/wsCardClientiController.cs`. Con wsCard avviato in **Debug** l'hash non viene verificato, ma la chiave non deve essere vuota (altrimenti: "servizio card non configurato").
- Se `EMailValidaClienteBody` resta all'indirizzo di produzione (`https://wsclienticloud.skyoneserver.it/...`), il link nell'email di conferma cerca l'account **in produzione** e non lo trova. Con `localhost` il link funziona aprendolo dal browser del PC, oppure dal telefono finché `adb reverse` è attivo.

### 2.2 wsClientiCloud — `Properties/launchSettings.json`

Nel profilo **`TTI.wsClienti`** la porta deve essere **5000** e l'ambiente **Development**:

```json
"applicationUrl": "http://0.0.0.0:5000",
"environmentVariables": { "ASPNETCORE_ENVIRONMENT": "Development" }
```

Con `adb reverse` basterebbe anche `http://localhost:5000`; `0.0.0.0` serve solo per l'alternativa via Wi-Fi (§7).

### 2.3 wsCard — `GestioneCard/src/wsCard/appsettings.Development.json`

```jsonc
"DBHOST": "80.211.78.150",
"DBNOME": "/var/lib/firebird/3.0/data/CARD_TEST.FDB",
...
// cloudsystem di test (letto in Startup solo se CLOUDSYSTEM_HOST è impostato)
"CLOUDSYSTEM_HOST": "skyoneserver.it",
"CLOUDSYSTEM_NOME": "/var/lib/firebird/3.0/data/cloudsystemtest.fdb",
"CLOUDSYSTEM_USER": "SYSDBA",
"CLOUDSYSTEM_PWD": "<password SYSDBA di skyoneserver.it>"
```

**Attenzione:** wsCard **ignora** le chiavi `DBHOST_CLOUD` / `DBNOME_CLOUD` / `DBPWD_CLOUD` di `appsettings.json`. Legge solo `CLOUDSYSTEM_*`; se mancano usa i valori scritti in `wsCloudSystemConfig.cs`, cioè **la produzione**.

### 2.4 CardApp — `.env.local`

```
EXPO_PUBLIC_CLOUD_URL=http://localhost:5000
```

Sul telefono `localhost:5000` viene girato al PC da `adb reverse` (§3 punto 1). Lo stesso valore va bene anche per provare dal browser del PC (`npx expo start --web`).

---

## 3. Avvio (ogni volta)

1. **Collega il telefono e attiva il reverse** (va rifatto ogni volta che stacchi il cavo, riavvii il telefono o riparte adb):
   ```
   adb devices
   adb reverse tcp:5000 tcp:5000
   adb reverse --list        # deve comparire tcp:5000 tcp:5000
   ```
   Se Metro non è raggiungibile dal dev client, aggiungi anche `adb reverse tcp:8081 tcp:8081`.
2. **Avvia wsCard** (Visual Studio, soluzione GestioneCard):
   - configurazione **Debug**, profilo **`wsCard`**;
   - verifica: sul PC `http://localhost:5150/index.html` mostra Swagger.
3. **Avvia wsClientiCloud** (Visual Studio, soluzione `TTI.ALL.sln` di cloud-server):
   - clic destro su **TTI.wsClientiCloud** → *Imposta come progetto di avvio*;
   - profilo **`TTI.wsClienti`** nel menu accanto a ▶;
   - verifica: dal browser del **telefono** `http://localhost:5000/` mostra Swagger con titolo **"API ThinkToIT ClientiCloud"**.
4. **Avvia l'app**: nella cartella CardApp `npx expo start -c` (il `-c` serve a rileggere `.env.local`) e apri il development build sul telefono.

> ⚠️ **Non avviare il progetto `wsCloud`.** Contiene gli stessi endpoint `/AUC` e `/CLE`, ascolta anche lui sulla porta 5000, ma il suo `appsettings.Development.json` punta al `cloudsystem.fdb` di **produzione**. Se la pagina Swagger ha un titolo diverso da "API ThinkToIT ClientiCloud", hai avviato il progetto sbagliato.

---

## 4. Verifica del flusso completo

Dati necessari nei DB di test:
- in `cloudsystemtest`: l'esercente e l'account cliente (oppure crealo con la registrazione dall'app);
- in `CARD_TEST`: almeno una card collegata a quel cliente e a quell'esercente (`ANAGDAT_CLOUD`), meglio con qualche movimento.

| Azione nell'app | Endpoint app → wsClientiCloud | wsClientiCloud → wsCard | Dove controllare |
|---|---|---|---|
| Registrazione | `/CLE/RegistraClienteApp` | — | nuovo account in `cloudsystemtest` (non in `cloudsystem`!) |
| Login | `/AUC/LoginCliente` | — | accesso riuscito |
| Elenco card | `/AUC/CardCliente` | `/CLI/CardClienteCloud` | card e saldi come in `CARD_TEST` |
| Movimenti | `/AUC/MovimentiCardCliente` | `/CLI/MovimentiCardCliente` | movimenti corretti |
| Card girata → QR | — | — | il QR si legge in cassa / con un lettore |
| Blocco card | `/AUC/BloccaCardCliente` | `/CLI/BloccaCardCliente` | stato aggiornato in `CARD_TEST` |
| Elimina account (per ultimo, account usa e getta) | `/AUC/EliminaAccountCliente` | `/CLI/EliminaAccountCliente` | account sparito da `cloudsystemtest` |

Per seguire ogni passaggio:
- breakpoint in `CardClientiService.PostWsCard` (cloud-server, `src/TTI.Clienti`) e nel metodo corrispondente di `wsCardClientiController` (GestioneCard): a ogni azione devono fermarsi entrambi;
- console dei due servizi;
- client Firebird su `cloudsystemtest.fdb` e `CARD_TEST.FDB`.

---

## 5. Problemi frequenti

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| L'account finisce nel DB di **produzione** | avviato `wsCloud` invece di `TTI.wsClientiCloud` | §3 punto 3; poi cancellare a mano l'account da `cloudsystem.fdb` (o chiedere a chi gestisce il server) |
| wsCard legge clienti di produzione | mancano le chiavi `CLOUDSYSTEM_*` in `appsettings.Development.json` di wsCard | §2.3 |
| Dal telefono `http://localhost:5000/` non si apre | reverse non attivo (cavo staccato, adb riavviato) o servizio non avviato | `adb reverse --list`, rifare `adb reverse tcp:5000 tcp:5000`; provare prima `http://localhost:5000/` sul PC |
| `adb devices` vuoto o `unauthorized` | debug USB spento o PC non autorizzato | attivare Debug USB e accettare il popup "Consenti debug USB" sul telefono |
| `…/swagger` pagina vuota | in wsClientiCloud Swagger è sulla **radice** | aprire `http://localhost:5000/` |
| L'app chiama ancora il vecchio indirizzo | Metro non ha riletto `.env.local` | `npx expo start -c` |
| Console: "servizio card non configurato" | `CardBaseUrl` o `CardClientiKey` vuoti | §2.1 |
| Console: "wsCard non raggiungibile" | wsCard non avviato o non sulla porta 5150 | §3 punto 2 |
| wsCard: "hash non valido" | wsCard avviato in **Release** con chiave diversa | avviarlo in Debug o allineare `CardClientiKey` |
| Login ok ma nessuna card | dati mancanti in `CARD_TEST` / collegamento `ANAGDAT_CLOUD` | §4, dati di test |
| Link dell'email di conferma non funziona | `EMailValidaClienteBody` punta alla produzione | §2.1 |

---

## 6. Da non committare

Questi file contengono password, chiavi o impostazioni del tuo PC e servono solo in locale:

- `cloud-server/src/TTI.wsClientiCloud/appsettings.Development.json`
- `cloud-server/src/TTI.wsClientiCloud/appsettings.json` (se modificato)
- `cloud-server/src/TTI.wsClientiCloud/Properties/launchSettings.json`
- `GestioneCard/src/wsCard/appsettings.Development.json`
- `CardApp/.env.local`

Se uno di questi risulta nell'area di stage: `git restore --staged <file>`.
Per cambiare branch senza perderli: `git stash` prima del checkout, `git stash pop` dopo.

> Nota di sicurezza: con HTTP in chiaro (solo test locale) credenziali e token viaggiano non cifrati. In produzione l'app usa sempre HTTPS.

---

## 7. Alternativa senza cavo (Wi-Fi) — non usata finora

Serve solo se non puoi usare `adb reverse` (per esempio con un iPhone). Non è mai stata provata in questo setup.

- `applicationUrl` del profilo `TTI.wsClienti` su `http://0.0.0.0:5000` (§2.2).
- In `.env.local`: `EXPO_PUBLIC_CLOUD_URL=http://<IP-PC>:5000`, con l'**Indirizzo IPv4** della scheda Wi-Fi/Ethernet letto da `ipconfig` (di solito `192.168.x.x`, non la scheda *vEthernet* `172.x.x.x`). L'IP può cambiare: ricontrollarlo a ogni sessione.
- Telefono e PC sulla stessa rete (niente rete ospiti né VPN).
- Se il telefono non raggiunge il PC potrebbe servire aprire la porta 5000 nel firewall di Windows per le reti private.
