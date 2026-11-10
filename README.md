# CardApp

App per i clienti degli esercenti: mostra le card fedeltà (saldo punti, contatori, movimenti, QR da esibire in cassa) di uno o più account, ognuno legato a un esercente. Expo / React Native con expo-router.

## Avvio

> Attenzione se l'app e' gia' installata meglio disinstallarla in caso di Existing package com.cardapp.app signatures do not match

```bash
npm ci                                  # cosi da non aggiornare i pacchetti ma tenere quelli che si trovano sul package-lock
npx expo prebuild --platform android    # preparare la build per android
npx expo start -c                       # serve un development build installato (non Expo Go)
                                        # > se non funziona lo start prova con expo run:android
npx expo run:android                    # compila e installa il development build
```

`EXPO_PUBLIC_CLOUD_URL` in `.env.local` sostituisce l'indirizzo del servizio cloud clienti (es. un servizio locale di test). Per far girare in locale tutta la catena (app + wsClientiCloud + wsCard sui DB di test) segui [docs/SVILUPPO-LOCALE.md](docs/SVILUPPO-LOCALE.md).

## Struttura

- `src/app` schermate (expo-router): `(auth)` accesso e registrazione, `(app)` area riservata, `e/[codice]` link/QR dell'esercente
- `src/context` stato globale: sessione, card, codice di sblocco, parallasse
- `src/services` chiamate al cloud, account salvati nell'archivio sicuro, codice di sblocco, biometria
- `src/components/ui` componenti riutilizzabili
- `src/hooks` hook condivisi (tema, errori dei moduli, esercente, conto alla rovescia del blocco)

## Note

- Le cartelle native (`android/`, `ios/`) sono generate (`npx expo prebuild --clean`) e non vanno modificate a mano.
- Dopo aver aggiunto o rimosso dipendenze con codice nativo il development build va ricompilato.
