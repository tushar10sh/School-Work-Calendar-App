# Changelog

All notable changes to School Planner are documented here.

---

## [Unreleased] — 2026-04-22

### Added

#### Sync progress bar (SSE streaming)
- `GET /api/sync/stream?token=` — new SSE endpoint that streams sync progress in real time
- Sync pipeline refactored from a blocking function into an `async` generator (`sync_child_streaming`) that yields structured progress events at each stage: `fetching`, `planner` (per-message), `events_fetching`, `events` (per-message), `done`
- Frontend **Sync Now** button now opens an SSE stream using `fetch` + `ReadableStream`; shows a live progress bar and status label for each stage
- Nginx gets a dedicated `location /api/sync/stream` block with `proxy_buffering off`, `proxy_cache off`, and a 300 s read timeout so SSE chunks are not buffered

#### Message deduplication (`whatsapp_messages` table)
- New `whatsapp_messages` DB table stores every WhatsApp message that has been run through the event LLM, keyed by `(child_id, wa_msg_id)` using WhatsApp's own `id._serialized`
- Event scan now skips messages already in this table — each message is run through Ollama **exactly once** regardless of how many syncs occur
- Dedup is purely ID-based; no more relying on fragile `(child_id, title, event_date)` matching as the primary guard

#### Re-sync / purge (Settings)
- `POST /api/sync/purge` — clears all `whatsapp_messages` rows and all auto-detected events (those with a `source_message`) for the current child; manually-added events are untouched
- **Settings** page now has a "Re-sync Everything" section with a two-step confirmation button that calls the purge endpoint; after purging, the next sync reprocesses every message from scratch

#### Hallucination guard for event detection
- After the LLM returns an event title, a word-overlap check (`_title_in_message`) requires that at least one significant word (>3 chars) from the generated title actually appears in the source message body
- Events whose title cannot be grounded in the message text are rejected and logged as a warning, preventing the model from fabricating event names

#### Events — original message modal
- Clicking any event in the **Events** tab opens a modal showing the full original WhatsApp message text, the sender's phone number, and the date/time the message was sent
- Manually-added events show "No source message" in the modal
- Events with a source message display a `MessageSquare` icon in the list for quick identification

#### WhatsApp reconnect during LOADING
- The **Connect / Reconnect** button is now visible in all non-connected states including `LOADING`; label changes to "Stuck? Force Reconnect" during the loading phase

#### JWT expiry enforced client-side
- `useAuth.loadFromStorage` decodes the JWT payload and compares `exp * 1000` against `Date.now()`; an expired token is removed from `localStorage` on page load, prompting re-authentication

#### Events as a top-level tab
- Events moved from the Settings section into its own navigation tab (between Calendar and Todos)

#### Auto-detect Events toggle
- Per-child `parse_events` boolean stored in the database; toggled from the WhatsApp Sync panel in Settings
- When enabled, non-planner messages are scanned for school events and parent-activity deadlines
- Disabled by default to avoid unnecessary Ollama calls

### Changed

- **Sync pipeline**: `sync_child` is now a thin wrapper that consumes `sync_child_streaming` and returns the final summary dict; the scheduler continues to use `sync_child` unchanged
- **Event scanning**: always fetches the latest 100 messages (`since=None`) regardless of `last_synced_at`, ensuring events are not missed if the toggle was enabled after the last sync; deduplication is handled by the `whatsapp_messages` table rather than timestamp filtering
- **Subject code resolution**: matching is now case-insensitive post-LLM (e.g. `eng`, `Eng`, `ENG` all resolve to "English")
- **Sync result banner**: shows events added count in addition to messages parsed
- **Bag items in Day Panel**: full subject name shown next to the abbreviation (e.g. `MTB — Maths Text Book`)

### Fixed

- **Timezone display**: `last_synced_at` datetime stored as UTC naive; frontend now appends `Z` before constructing `Date` so `formatDistanceToNow` uses the correct UTC offset
- **WhatsApp group list crash**: groups with a null `name` field no longer crash the sort comparator
- **`fetchMessages` crash** (`waitForChatLoading` undefined): switched from `getChatById()` to finding the chat in the `getChats()` result list, which returns fully-hydrated objects; also upgraded `whatsapp-web.js` from npm `^1.26.0` to the GitHub `main` branch to track protocol fixes
- **Chromium SingletonLock**: `clearChromiumLocks()` runs before every `createClient()` call, preventing stale lock files from blocking reconnects after container recreation
- **Nginx port stripping on redirect**: changed `proxy_set_header Host $host` to `$http_host` so FastAPI's trailing-slash redirects include the correct port (`3000`) in the `Location` header
- **`npm ci` failure with GitHub dependency**: switched to `npm install`; added `git` and `ca-certificates` to the Docker image and configured `git config url."https://".insteadOf` to handle HTTPS-only environments

---

## [1.0.0] — 2026-04-21 — Initial release

### Added

- **Multi-child profiles** with PIN authentication and per-child JWT (6 h expiry)
- **WhatsApp Web integration** via `whatsapp-web.js` microservice (QR code scan, group selection, message fetch)
- **Auto-sync** with configurable per-child interval using APScheduler
- **Ollama-powered planner parsing**: extracts date, classwork, homework, and bag items from structured WhatsApp messages; retries up to 3× with exponential backoff
- **Calendar view** (react-big-calendar) with color-coded dots per entry type
- **Day panel** with CW/PW completion checkboxes and bag item list
- **Manual message paste** modal for one-off parsing
- **Events**, **Todos**, and **Test Alerts** with full CRUD
- **Settings** view with subject mapping table and Ollama config display
- **Docker Compose** setup: `backend` (FastAPI), `frontend` (Nginx + React build), `whatsapp-service` (Node.js + Chromium)
- SQLite with async SQLAlchemy; additive `ALTER TABLE` migrations run at startup so the database survives image upgrades without data loss
