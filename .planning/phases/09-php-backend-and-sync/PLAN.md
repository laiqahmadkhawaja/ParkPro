# Phase 9: PHP 8 Central REST API & Two-Way Background Delta Sync

## Phase Goal
Deliver the central PHP 8 REST API and client-side background synchronization engine, allowing offline-first terminals to automatically synchronize data with a central server whenever network connectivity is available.

---

## Task Breakdown

### Task 1: PHP 8 REST API Server (`server-php/api/`)
- **Scope:**
  - `server-php/database/db.php`: PDO database connection helper supporting MySQL and local SQLite (`server-php/database/parkpro.sqlite`).
  - `server-php/api/auth.php`: API authentication and token issuing.
  - `server-php/api/sync.php`:
    - `POST /push`: Batch ingestion of `sync_queue` items (inserts, updates). Uses Last-Write-Wins based on ISO timestamps.
    - `GET /pull?since=<timestamp>`: Returns delta changes made on other devices since the specified timestamp.
  - `server-php/api/health.php`: Lightweight endpoint returning system status and timestamp.
- **Verification:** API scripts handle JSON payloads, support CORS, and execute transactions without database errors.

### Task 2: Client-Side Background Delta Sync Engine (`app/js/sync.js`)
- **Scope:**
  - Network state monitor: Listens to `online`/`offline` events and periodic ping to `/api/health.php`.
  - Push Worker: Reads pending items from `sync_queue`, packages into batches, posts to `/api/sync.php?action=push`, and marks successfully uploaded records as `synced`.
  - Pull Worker: Fetches new sessions/settings created on other terminals and upserts into local IndexedDB.
  - Conflict Resolution: Local changes in progress are never overwritten by server state; client records updated with server confirmation.
- **Verification:** Simulating offline operations followed by reconnection successfully synchronizes records with the PHP backend.

---

## Acceptance Criteria
1. PHP 8 REST endpoints handle JSON payloads and execute PDO database queries.
2. Background sync client detects network status changes and flushes pending queue.
3. Bidirectional delta synchronization maintains data integrity across multiple devices.
