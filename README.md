# BloodPressureAppWasm

Blazor WebAssembly app per il monitoraggio della pressione arteriosa e gestione terapie, con supporto offline-first e sincronizzazione automatica.

## Architettura

```
BloodPressureAppWasm/
├── Pages/              # Componenti Razor (BloodPressure, Therapies, Login, User, etc.)
├── Components/         # Componenti riusabili (DialogContent)
├── Services/           # Servizi WASM
│   ├── SyncService.cs         # Coda offline + sync misurazioni BP
│   ├── ReminderService.cs     # Coda offline + sync terapie
│   └── PushNotificationService.cs  # Notifiche locali + Service Worker
├── Layout/             # MainLayout, NavMenu
├── wwwroot/            # Static assets, appsettings.json, service-worker.js
└── Program.cs          # DI, HttpClient config, auth
```

**Libreria condivisa** (`../BloodPressureApp/BloodPressureAppLibrary/`):
- `BloodPressure.cs` — Modello misurazione (Sistolica, Diastolica, Pulse, Timestamp, Device, Context)
- `Therapy.cs` — Modello terapia con `FrequencyType` enum (OnceDaily, TwiceDaily, EveryXHours, CustomTimes) e helper `GetDoseTimes()`

## Stack

| Tecnologia | Versione |
|------------|----------|
| .NET | 10.0 |
| Blazor WebAssembly | 10.0.1 |
| MudBlazor | 8.15.0 |
| MudBlazor.ThemeManager | 3.0.0 |
| Blazored.LocalStorage | 4.5.0 |
| MongoDB.Bson | (modelli) |

## Funzionalità principali

### Pressione arteriosa (`/bloodPressure`)
- Grafico interattivo (Line/Bar) con filtri per anno e periodo (3/6/12/24 mesi)
- Aggiunta misurazioni via popover modale (validazione Sistolica > Diastolica)
- **Offline-first**: se l'API non risponde, salva in `localStorage` e sincronizza al ripristino
- Export CSV

### Terapie (`/therapies`)
- CRUD completo con dialog modale
- Frequenza strutturata: enum `FrequencyType` + `CustomTimes` (TimeOnly[])
- Reminder notifiche locali via Service Worker (`PushNotificationService`)
- **Offline-first**: coda locale con `ReminderService` + sync automatica

### Autenticazione
- JWT con `AuthMessageHandler` (allega token alle richieste API)
- `ProductionAuthStateProvider` + `AccessTokenStore` (localStorage)
- Login/Register/ForgotPassword/ResetPassword

### Sincronizzazione offline
- `SyncService` → coda `offline_bloodpressure_queue` (localStorage)
- `ReminderService` → coda `offline_therapies_queue` (localStorage)
- Entrambi tentano sync all'avvio e gestiscono retry con `_isSyncing` guard

## Configurazione

`wwwroot/appsettings.json`:
```json
{
  "Api": { "BaseUrl": "http://192.168.1.12:81" },
  "Auth": { "BaseUrl": "http://192.168.1.12:81/api/auth/" }
}
```
Override per environment: `appsettings.{Environment}.json`.

## Avvio

```bash
dotnet restore
dotnet build
dotnet run --project BloodPressureAppWasm
```

## Service Worker

`wwwroot/service-worker.js` gestisce:
- Cache statica per offline
- Push notifications (VAPID)
- Background sync

## API Endpoints (attesi dal backend)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `api/bloodpressure/{patientId}` | Lista misurazioni |
| POST | `api/bloodpressure` | Nuova misurazione |
| GET | `api/therapies/{patientId}` | Lista terapie |
| POST | `api/therapies` | Nuova terapia |
| PUT | `api/therapies/{id}` | Aggiorna terapia |
| DELETE | `api/therapies/{id}` | Elimina terapia |
| POST | `api/auth/login` | Login (ritorna JWT) |
| POST | `api/auth/register` | Registrazione |
| POST | `api/auth/forgot-password` | Reset password |
| POST | `api/auth/reset-password` | Conferma reset |

## Dipendenze progetto (solution)

```
BloodPressureAppWasm
  └── BloodPressureAppLibrary (shared models)
```

Il backend API (`../ProvaApi/ProvaApi/`) non è incluso in questo repo.