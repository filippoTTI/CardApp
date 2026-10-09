# CardApp

App per i clienti degli esercenti: mostra le card fedeltà (saldo punti, contatori, movimenti, QR da esibire in cassa) di uno o più account, ognuno legato a un esercente. Expo / React Native con expo-router.

## Avvio

```bash
npm install
npx expo start          # serve un development build installato (non Expo Go)
npx expo run:android    # compila e installa il development build
```

`EXPO_PUBLIC_CLOUD_URL` in `.env.local` sostituisce l'indirizzo del servizio cloud clienti (es. un servizio locale di test).

## Struttura

- `src/app` schermate (expo-router): `(auth)` accesso e registrazione, `(app)` area riservata, `e/[codice]` link/QR dell'esercente
- `src/context` stato globale: sessione, card, codice di sblocco, parallasse
- `src/services` chiamate al cloud, account salvati nell'archivio sicuro, codice di sblocco, biometria
- `src/components/ui` componenti riutilizzabili
- `src/hooks` hook condivisi (tema, errori dei moduli, esercente, conto alla rovescia del blocco)

## Note

- Le cartelle native (`android/`, `ios/`) sono generate (`npx expo prebuild --clean`) e non vanno modificate a mano.
- Dopo aver aggiunto o rimosso dipendenze con codice nativo il development build va ricompilato.
