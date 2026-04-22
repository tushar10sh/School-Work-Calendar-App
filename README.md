# School Planner

A web app for tracking your child's daily classwork and homework using a calendar view. Supports multiple child profiles, WhatsApp group sync via a local WhatsApp Web session, and AI-powered message parsing using a local Ollama model.

## Features

- **Child profiles** — multiple children, each with their own PIN and data
- **WhatsApp sync** — connect via QR code; messages are pulled from a chosen group and parsed automatically with a real-time progress bar
- **Auto-sync** — configurable per-child interval (default 60 min); also available on demand via Sync Now
- **AI parsing** — local Ollama LLM extracts date, classwork, homework, and bag items from the planner message format; subject codes resolved case-insensitively
- **Event detection** — optional toggle to scan non-planner group messages for school events, parent meetings, and activity deadlines; hallucination guard prevents false positives
- **Message deduplication** — processed WhatsApp messages are tracked so each message is run through the AI exactly once, regardless of how many syncs occur
- **Calendar view** — month view with color-coded dots for CW, PW, events, and tests
- **Day panel** — click any date for CW/PW entries with completion checkboxes, bag items with full subject names, events, and tests
- **Events tab** — school events, holidays, parent meetings; sort by date (soonest/latest); mark events as action-taken with a single click; click any auto-detected event to see the original WhatsApp message, sender, and send time
- **Calendar → Events navigation** — clicking an Event dot on the calendar switches to the Events tab and highlights the matching events with a 2-second amber flash
- **Event editing** — pencil icon on hover opens a pre-filled edit modal for any event; title/date changes on auto-detected events are logged to `event_corrections` for LLM fine-tuning
- **Pending filter** — one-click toggle in the Events tab to show only events where action has not yet been taken
- **Archive** — archive button on events and todos hides them from the default view without deleting; archived items can be revealed and unarchived via a toggle; syncing never recreates archived events
- **Weekly / Monthly Summary tab** — stat cards and a detail table showing CW/PW completion rates, events actioned %, and todos completion for the current week or month
- **Todos** — task list with priority (High/Medium/Low) and due dates
- **Test Alerts** — upcoming test tracker with live countdown
- **Re-sync everything** — purge the message cache from Settings to force a full reprocess on the next sync
- **Configurable** — subject code mappings, Ollama model, sync interval all in `config.yaml`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy 2 (async) + SQLite |
| Frontend | React 18 + Vite + Tailwind CSS + react-big-calendar |
| AI Parsing | Local Ollama (`gemma3:4b` default) |
| WhatsApp | whatsapp-web.js (Node.js microservice) |
| Containerization | Docker Compose (3 services) |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux)
- [Ollama](https://ollama.com) running locally with a model pulled:
  ```bash
  ollama pull gemma3:4b
  ```
- A WhatsApp account (to scan the QR code and connect the sync service)

## Quick Start

```bash
git clone https://github.com/tushar10sh/School-Work-Calendar-App.git
cd School-Work-Calendar-App
docker compose up --build
```

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API docs | http://localhost:8000/docs |
| WhatsApp service | http://localhost:3001/status |

> **First run:** The `whatsapp-service` image installs Chromium — expect the build to take a few minutes.

## First-Time Setup

1. Open http://localhost:3000
2. Click **Add Child Profile** — enter a name and set a PIN
3. Click the child card and enter the PIN to log in
4. Go to **Settings → WhatsApp Sync**
5. Click **Connect** — a QR code will appear
6. Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → scan the QR code
7. Once connected, select the school group from the dropdown and click **Use "Group Name"**
8. *(Optional)* Enable **Auto-detect Events** to scan non-planner messages for school events and parent activities
9. Click **Sync Now** — a live progress bar will track each stage of the sync

## WhatsApp Message Format

The parser handles messages in this format:

```
Todays planner- 21.4.26
Cw
Eng- Writing of words and new words of the poem in ECW.
M- Doing pages in MTB.
Pw
E- Revise A/An
H- writing vyanjan in HA
M- Do pw given in mtb

My bag- MTB, ETB.
```

**What gets extracted:**

| Field | Source | Example result |
|-------|--------|----------------|
| Date | `Todays planner- DD.MM.YY` | `2026-04-21` |
| Classwork | Lines under `Cw`/`CW` | `English — Writing of words…` |
| Homework | Lines under `Pw`/`PW` | `Hindi — writing vyanjan…` |
| Bag items | After `My bag-` | `MTB`, `ETB` |

Subject codes are resolved to full names via the `subjects.mappings` section in `config.yaml`. Matching is case-insensitive. Only messages containing the word "planner" (configurable) are picked up during the planner sync pass.

## Event Detection

When **Auto-detect Events** is enabled, every non-planner message in the group is scanned by the AI for actionable events:

- Parent-teacher meetings and school meetings
- School trips, sports days, cultural programs
- Requests to submit forms, fees, or permission slips by a date
- Any message where a parent or child must act by a specific day

Each message is processed **exactly once** — processed IDs are stored in the database, so re-syncing never re-runs old messages. A hallucination guard requires that at least one significant word from the AI-generated event title actually appears in the source message, preventing fabricated events.

Click any event in the **Events** tab to see the original WhatsApp message, the sender's number, and the time it was sent.

## Configuration

Edit `config.yaml` at the repo root. It is mounted read-only into the backend container — changes take effect after a container restart, no rebuild needed.

```yaml
ollama:
  model: "gemma3:4b"     # Any installed Ollama model
  timeout: 60            # Seconds to wait for LLM response

auth:
  secret_key: "change-this-to-a-random-secret-in-production"

sync:
  auto_sync: true
  default_interval_minutes: 60   # Per-child default; overridable in the UI

whatsapp:
  service_url: "http://whatsapp-service:3001"
  message_filter: "planner"      # Only messages containing this word are treated as planner messages

subjects:
  mappings:
    AEB: "Active English - 1"
    MTB: "Maths Text Book - Joyful Mathematics 1"
    HTB: "Hindi Text Book - Sarangi - 1"
    # Add or edit subject codes here
```

**Section header aliases** — the parser recognises these as CW or PW headers:

- **Classwork:** `Cw`, `CW`, `cw`, `Class Work`, `Classwork`
- **Homework:** `Pw`, `PW`, `pw`, `Home Work`, `Homework`, `HW`, `Practice Work`

## Development (without Docker)

**Backend**
```bash
cd backend
pip install -r requirements.txt
CONFIG_PATH=../config.yaml uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 — proxies /api/* to localhost:8000
```

**WhatsApp service**
```bash
cd whatsapp-service
npm install
node index.js      # http://localhost:3001
```

Update `config.yaml` → `whatsapp.service_url` to `http://localhost:3001` when running outside Docker.

## Project Structure

```
School-Work-Calendar-App/
├── config.yaml                      # All app configuration
├── docker-compose.yml               # 3 services: backend, frontend, whatsapp-service
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                  # FastAPI app + APScheduler auto-sync
│       ├── config.py                # Typed config loader
│       ├── database.py              # Async SQLAlchemy + additive migrations
│       ├── dependencies.py          # JWT auth dependency
│       ├── core/security.py         # PIN hashing + JWT utils
│       ├── models/                  # ORM models (8 tables)
│       │   ├── child.py
│       │   ├── planner.py
│       │   ├── bag.py
│       │   ├── event.py             # Includes source_message / sender / is_archived fields
│       │   ├── event_correction.py  # Logs title/date edits for LLM fine-tuning
│       │   ├── todo.py              # Includes is_archived field
│       │   ├── test_alert.py
│       │   └── whatsapp_message.py  # Tracks processed WA message IDs (dedup)
│       ├── schemas/
│       ├── routers/
│       │   ├── auth.py
│       │   ├── children.py
│       │   ├── planner.py
│       │   ├── events.py
│       │   ├── todos.py
│       │   ├── test_alerts.py
│       │   ├── whatsapp.py
│       │   ├── sync.py              # /trigger, /stream (SSE), /purge, /status
│       │   ├── corrections.py       # GET /api/corrections — fine-tuning data export
│       │   ├── summary.py           # GET /api/summary — weekly/monthly progress
│       │   └── config_router.py
│       └── services/
│           ├── ollama_service.py    # Planner parser + event parser with hallucination guard
│           ├── whatsapp_service.py  # HTTP client for whatsapp-service
│           └── sync_service.py      # Streaming async-generator sync pipeline
├── whatsapp-service/
│   ├── Dockerfile                   # node:20-bullseye + Chromium
│   ├── package.json
│   └── index.js                     # Express + whatsapp-web.js (GitHub main)
└── frontend/
    ├── Dockerfile                   # Multi-stage: Vite build → Nginx
    ├── nginx.conf                   # /api/sync/stream has buffering disabled for SSE
    └── src/
        ├── App.jsx                  # Auth gate + tab navigation (Calendar|Events|Todos|Tests|Settings)
        ├── hooks/useAuth.js         # JWT auth state + client-side expiry check
        ├── api/index.js             # Axios client + syncApi.streamUrl for SSE
        └── components/
            ├── Auth/LoginPage.jsx
            ├── Calendar/            # react-big-calendar month view
            ├── DayView/             # Slide-in day detail panel
            ├── MessageParser/       # Paste & parse modal
            ├── WhatsApp/            # QR code, group selector, streaming sync + progress bar
            ├── Events/              # Events list + SourceModal + EditModal (corrections logged)
            ├── Todos/               # Todos with archive support
            ├── TestAlerts/
            ├── Summary/             # Weekly/monthly progress stat cards
            └── Settings/            # WhatsApp panel + re-sync/purge + config viewer
```

## API Reference

**Auth & children (public)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/children` | List all child profiles |
| `POST` | `/api/children` | Create a child profile |
| `POST` | `/api/auth/login` | Login with child ID + PIN → JWT |
| `GET` | `/api/auth/me` | Current child info (requires token) |

**Planner (requires JWT)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/planner/parse` | Parse WhatsApp message via Ollama |
| `GET` | `/api/planner/range?start=&end=` | Calendar dot data for a date range |
| `GET` | `/api/planner/{date}` | Full day detail (CW, PW, bag items) |
| `PATCH` | `/api/planner/{id}/complete` | Toggle entry completion |
| `DELETE` | `/api/planner/{id}` | Delete a planner entry |

**Other (requires JWT)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/events` | List / create events |
| `PATCH/DELETE` | `/api/events/{id}` | Update / delete event (including `action_taken` toggle) |
| `GET/POST` | `/api/todos` | List (`?completed=false`) / create |
| `PATCH/DELETE` | `/api/todos/{id}` | Update / delete todo |
| `GET/POST` | `/api/test-alerts` | List (`?upcoming=true`) / create |
| `PATCH/DELETE` | `/api/test-alerts/{id}` | Update / delete test alert |
| `GET` | `/api/whatsapp/status` | WhatsApp connection status |
| `GET` | `/api/whatsapp/qr` | QR code data URL |
| `GET` | `/api/whatsapp/groups` | List WhatsApp groups |
| `POST` | `/api/whatsapp/connect-group` | Set group for this child |
| `POST` | `/api/whatsapp/reconnect` | Force reconnect (use when stuck at LOADING) |
| `POST` | `/api/sync/trigger` | Trigger sync (blocking, returns summary) |
| `GET` | `/api/sync/stream?token=` | Streaming SSE sync with per-message progress |
| `POST` | `/api/sync/purge` | Clear message cache + auto-detected events |
| `GET` | `/api/sync/status` | Last sync time + settings |
| `GET` | `/api/config` | Subject mappings + Ollama config |
| `GET` | `/api/corrections` | List all event title/date corrections (fine-tuning data) |
| `GET` | `/api/summary?start=&end=` | Aggregated CW/PW/events/todos stats for a date range |

## Ollama on Linux

On Linux Docker Engine, `host.docker.internal` requires an extra hosts entry. This is already included in `docker-compose.yml`:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

If Ollama is bound to `127.0.0.1` only, either configure it to listen on `0.0.0.0`, or replace `host.docker.internal` with your LAN IP in `config.yaml`.

## Data Persistence

| Volume | Contains |
|--------|---------|
| `school-planner-data` | SQLite database (`school_planner.db`) |
| `school-planner-whatsapp-sessions` | WhatsApp session (avoids re-scanning QR) |

Both volumes survive container restarts and `docker compose up --build`. To wipe everything and start fresh:

```bash
docker compose down -v
docker compose up --build
```

**Backup:**
```bash
docker run --rm \
  -v school-planner-data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/planner-backup.tar.gz /data
```
