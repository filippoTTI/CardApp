# CLAUDE.md

This file provides guidance to Claude when working with code in this repository.

## Project

CardApp is the mobile app for **merchants' customers** (Expo SDK 57, React Native 0.86, React 19, TypeScript 6 strict). It shows the loyalty (standard)/prepaid/postpaid cards of one or more **accounts** (an account = email + merchant, `codEsercente`), with balances, counters and movements; tapping a card flips it to reveal a QR code to show at the till.

The app talks to a **real backend** (no more stubs): the customer cloud service `wsClientiCloud` (default `https://wsclienticloud.skyoneserver.it`), which in turn queries the card management web service `wsCard` (Firebird). Code comments and UI strings are in **Italian** — keep new ones in Italian; identifiers in English.

Related repositories (same workspace): `cloud-server` (.NET solution, `TTI.wsClientiCloud` exposes the `/AUC/...` and `/CLE/...` endpoints used by the app) and `GestioneCard` (`wsCard`, card business logic and DB).

Full user + technical manual: `DOCUMENTAZIONE-CardApp.md` in the repo root.

## Commands

- `npm install` — install dependencies
- `npx expo start` — dev server (opens the **dev client**, `expo-dev-client` is installed); `npx expo start --go` for Expo Go
- `npx expo run:android` / `npx expo run:ios` — build and install the development build; `npx expo start --web` for web
- `npm run lint` — ESLint via `expo lint` (flat config extending `eslint-config-expo`)
- `npx tsc --noEmit` — type-check (strict mode)
- After changing native dependencies: rebuild the dev client; `android/` is generated (`npx expo prebuild --clean`), don't edit it by hand
- EAS profiles (`eas.json`): `development`, `preview` (internal), `production` (`autoIncrement`)

There is no test setup. Code must pass `npm run lint` and `npx tsc --noEmit` before delivery.

### Configuration

- `EXPO_PUBLIC_CLOUD_URL` (in `.env.local`) overrides the cloud URL, e.g. `http://<pc-ip>:5000` for a local service on the LAN. `EXPO_PUBLIC_*` are read at bundle time: restart Metro with `npx expo start -c` after changing them.
- Identifiers: bundle/package `com.cardapp.app`, URL scheme `cardapp`.

## Architecture

### Routing (`src/app/`, expo-router, typed routes, React Compiler on)

Root `_layout.tsx` uses `Stack.Protected` guards on `useAuth().isSignedIn` to switch between `(auth)` and `(app)`. **No manual redirects** — changing `isSignedIn` is what navigates. `RootStack` returns `null` (splash stays) until the session is restored (`isRestoring`) and the PIN state is known (`lockReady`); on top of the stack it renders `LockScreen` when `locked` and `PrivacyCover` when `covered` (app in background / multitasking preview).

| Route | File | Notes |
|---|---|---|
| `/login`, `/register` | `(auth)/` | optional `cod` param (merchant code from link/QR) |
| `/forgot-password` | `(auth)/forgot-password.tsx` | `mode=conferma` resends the confirmation email; params `email`, `cod` |
| `/` | `(app)/index.tsx` | home: cards grouped by account |
| `/card-details?id=` | `(app)/card-details.tsx` | details, movements, block/unblock |
| `/profile` | `(app)/profile.tsx` | accounts, change password, PIN, biometrics |
| `/add-account` | `(app)/add-account.tsx` | param `cod` |
| `/pin-setup?mode=` | `(app)/pin-setup.tsx` | `set` / `change` / `disable` |
| `/delete-account` | `(app)/delete-account.tsx` | permanent deletion (password + hold button) |
| `/recupera-password` | `(app)/recupera-password.tsx` | re-exports `forgot-password` |
| `/e/<codice>` | `e/[codice].tsx` | deep link `cardapp://e/<codice>` → `/add-account` if signed in, else `/login`, with `cod` |

### Provider stack (root layout)

`ThemeProvider` → `AppLockProvider` → `AuthProvider` → `ParallaxProvider` → `BackgroundFocusProvider` → `CardsProvider` → `RootStack`.

- `context/app-lock.tsx` — 4-digit unlock PIN + biometrics, re-lock after time in background, privacy cover. `withoutLock(op)` wraps operations that open system dialogs (e.g. camera permission) so the app isn't locked/covered. Recovery with an account password (`RecoverResult`: `ok` / `wrong` / `reset` / `error`); too many failures reset the app (saved accounts removed).
- `context/auth.tsx` — `isSignedIn`, `isRestoring`, `user`, `accountsVersion`. Restores the session at startup; keep-alive refresh every 2 min and on return to foreground (server token expires after 5 min). Actions: `signIn`, `signOut` (keeps saved accounts), `leaveAccount`, `switchAccount`, `removeAccount`, `deleteAccount`.
- `context/cards.tsx` — one `AccountCards` group per saved account (key, merchant name, email, cards, loading, error); loads all accounts in parallel, groups update independently and never go back to "loading" once they have data. Reloads on entry, account changes, pull-to-refresh and return to foreground.
- `context/parallax.tsx` — single app-wide motion sensor exposing smoothed `x`/`y` shared values (-1..1); off with "Reduce motion", in background or under the lock screen.
- `context/background-focus.tsx` — ref-counted tracker that blurs the animated background while any card shows its QR.
- `context/skeleton-shimmer.tsx` — shared shimmer progress so all skeletons animate in sync.
- `context/ui-scale.tsx` — `useRadius()` for consistent border radii of fields/buttons.

### Services (`src/services/`) — backend seam

- `api.ts` — `cloudPost`, `cloudPostAuth` (Bearer token), `cloudGet`. 15 s timeout; every response is an envelope `{ cod, msg }` (`cod` 0 = ok). Errors become `ApiError(cod, message, status)`: `-1` network, `401` session expired, `429` too many requests. `isTransientError()` distinguishes temporary failures from credential verdicts; technical server messages (Firebird, .NET exceptions) are replaced by a generic message. Use `errorMessage(e)` for UI text.
- `auth.ts` — login (`/AUC/LoginCliente`), merchant lookup (`fetchEsercente`), `signInWithPassword` (saves/updates the account and makes it active), registration and emails (`/CLE/RegistraClienteApp`, `/CLE/ReinoltraConfermaClienteApp`, `/CLE/ResetPwdClienteApp`), account deletion (`/AUC/EliminaAccountCliente`).
- `accounts.ts` — saved accounts (`SavedAccount`, credentials included, used to re-login when the token expires) in **SecureStore**, device-only and excluded from backups; `accountKey()` = merchant + email. Tracks `active` and `last` account.
- `cards.ts` — `fetchCards` (`/AUC/CardCliente`), `fetchMovements` (`/AUC/MovimentiCardCliente`, paginated from 1, optional `counter` filter `euro`/`points`; `movementCounters(card)` decides which lists the details screen shows), `setCardBlocked` (`/AUC/BloccaCardCliente`). Maps the management system's card type to `CardKind` (no detail = `standard`); displayed balance = euro counter, else points counter (issuing merchant's first, `pickCounter`); standard counter never shown; card discount from `tipoSconto`/`sconto`; reward thresholds ("soglie", never "limiti" in the UI) from `soglieIn`/`soglie`.
- `app-lock.ts` — PIN stored only as a salted hash (`sha256.ts`) in SecureStore, never sent to a server; growing lockout after wrong attempts. If the store fails, treat the PIN as set (fail closed).
- `biometric.ts` — Face ID / fingerprint unlock (only if a PIN is set), user preference, and identity check before re-opening a saved account.
- `brightness.ts` — max brightness (gradual) while at least one QR is shown, then restore.
- `esercente-qr.ts` — `parseEsercenteCode`: accepts `cardapp://e/<code>`, any URL ending in `/e/<code>`, or the bare code (4–32 alphanumeric); returns uppercase or `null`.
- `qr.ts` — `buildQrPayload` / `buildThresholdQrPayload`: **the only place** to change the QR formats (card: its `code`; reached reward threshold: `<code>-<threshold amount>`, e.g. `DSEOZVPTC5-4`; no `:` — the iPhone camera ignores it).
- `optional-native.ts` — `optionalNative(name, load)`: soft-loads native modules (camera, brightness, biometrics) so a dev build without them doesn't crash; the feature is just unavailable.

### Domain types (`src/types/card.ts`)

`CardKind` (`prepaid` | `postpaid` | `standard`), discriminated `CardBalance` (euro if the card has a euro counter, else points; never the standard counter), `Card` (id, `accountKey`, `code`, `issuer`, `blocked`, `color` from the merchant, `masterCode`, `counters`, `discount` from the card detail, `thresholds` = reward thresholds in points or euro, dates as `yyyyMMdd`), `CardCounter` / `CounterType` (backend `tipoContatore`: 0 standard, 1 euro, 4 points, 5 discount — standard and discount counters are never shown as a balance), `CardMovement` (`recharge` | `expense` | `credit`, with lines).

### UI

- Reusable components in `src/components/ui/` (flip-card, qr-code, qr-scanner, pin-pad, lock-screen, privacy-cover, glass-panel, account-header/list/picker, card-movements, skeletons, hold-button, text-field, auth-screen…).
- Heavy visuals: Reanimated 4 (shared values with `.get()` / `.set()`), Skia (`animated-background.tsx`, card visuals), react-native-svg, expo-glass-effect, expo-blur.
- Blocked cards show "BLOCCATA", red border, and do not flip (no QR). Card color: merchant-chosen `color` if set, otherwise the default for its kind (`constants/card-color.ts`).
- Hooks: `use-theme`, `use-esercente-code` (merchant code field / name lookup on auth screens), `use-form-errors` (field errors with shake), `use-keyboard-cover`, `use-lock-countdown`.
- **Theming**: colors, spacing and radii in `src/constants/theme.ts`; use `useTheme()` — never hardcode colors. Formatting helpers in `constants/format.ts`.

## Conventions

- File names in kebab-case; camelCase for variables/functions, PascalCase for components and types.
- Imports via `@/*` (→ `src/*`) and `@/assets/*`.
- Don't add new dependencies without asking (native ones also require a dev client rebuild).
- Never log or send credentials/PIN; anything sensitive goes in SecureStore via the existing services.
- Open TODOs: animated background replacement (video/Lottie) in `animated-background.tsx`; QR format in `qr.ts`.
