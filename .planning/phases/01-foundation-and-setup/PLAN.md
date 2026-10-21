# Phase 1: Foundation, Local Data Engine & Automated APK CI/CD Pipeline

## Phase Goal
Establish the complete foundational architecture for ParkPro: directory structure, modern offline-first PWA web app shell, unified client-side transactional database (IndexedDB / SQLite WASM), and the GitHub Actions workflow that automatically compiles and signs the Android APK.

---

## Task Breakdown

### Task 1: Repository Structure & Directory Organization
- **Scope:**
  - Create the standard multi-tier project layout:
    - `/app/` - Client-side PWA web application (HTML5, CSS3, Vanilla JS).
    - `/app/css/` - Mobile-first design system, typography, responsive grid, theme variables.
    - `/app/js/` - Modular JavaScript architecture (DB adapter, auth, printer, ocr, ui, api).
    - `/app/assets/` - Icons, sound effects, brand assets.
    - `/server-php/` - PHP 8 REST backend, database migrations, SQLite/MySQL DB scripts.
    - `/android/` - Lightweight Android Gradle WebView wrapper shell with native Bluetooth bridge.
    - `/.github/workflows/` - CI/CD pipeline automation scripts.
- **Verification:** Directory structure verified with clear separation of concerns.

### Task 2: Mobile-First Offline PWA Web App Shell
- **Scope:**
  - Implement `/app/index.html` with mobile-first viewport meta tags, splash screen, and status bar coloring.
  - Implement `/app/manifest.json` configured for standalone display, portrait orientation, theme color `#1e293b`.
  - Implement `/app/sw.js` (Service Worker) implementing a Cache-First strategy for static assets and Network-First with offline fallback for dynamic requests.
  - Implement `/app/css/app.css` design system with touch targets (>48px), dark/light high-contrast mode, and Urdu RTL styling readiness.
- **Verification:** Loading `index.html` registers the service worker, caches all critical assets, and reloads in Airplane mode with 0 network latency.

### Task 3: Unified Relational Data Layer (IndexedDB / SQLite WASM)
- **Scope:**
  - Implement `/app/js/db.js` providing an asynchronous, transactional CRUD storage engine.
  - Define relational schema:
    - `users` (id, username, name, pin_hash, role, status)
    - `vehicle_types` (id, name, icon, base_rate, hourly_rate, grace_period_mins, daily_max, night_rate)
    - `parking_sessions` (id, ticket_no, plate_number, vehicle_type_id, entry_time, exit_time, total_amount, status, qr_signature, sync_status)
    - `shifts` (id, operator_id, start_time, end_time, starting_float, total_cash_collected, status)
    - `settings` (lot_name, address, phone, currency, header, footer, printer_width, qr_secret)
    - `sync_queue` (id, table_name, record_id, operation, payload, created_at, status)
    - `audit_logs` (id, user_id, action, details, timestamp)
  - Implement database seeder with default administrator credentials (`admin` / PIN: `1234`) and standard vehicle types (Bike, Rickshaw, Car, Van, Truck).
- **Verification:** Local test script inserts, queries, updates, and deletes records within IndexedDB; schema integrity verified.

### Task 4: Lightweight Native Android WebView Shell & Hardware Bridge
- **Scope:**
  - Create Android Gradle project under `/android/` containing:
    - `AndroidManifest.xml` with permissions: `CAMERA`, `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `INTERNET`.
    - `MainActivity.kt` / `MainActivity.java` with hardware-accelerated WebView, HTML5 camera file chooser support, and DOM storage enabled.
    - `AndroidBridge.java`: Exposes `@JavascriptInterface` methods:
      - `printBluetooth(byte[] data)` - Direct ESC/POS printing to bonded Bluetooth thermal printers.
      - `getPairedPrinters()` - Lists paired Bluetooth MAC addresses.
      - `vibrate(int ms)` - Haptic feedback for scans.
  - Web fallback: When running in browser/PWA over HTTPS, gracefully falls back to Web Bluetooth API (`navigator.bluetooth`).
- **Verification:** Android project compiles cleanly with Gradle without external dependency conflicts.

### Task 5: GitHub Actions Signed APK CI/CD Pipeline
- **Scope:**
  - Create `/.github/workflows/build-apk.yml`:
    - Triggers on push to `main` branch or release tags.
    - Sets up Java 17, Android SDK, and Gradle.
    - Executes `./gradlew assembleRelease` to compile the Android app.
    - Decodes Android Keystore from GitHub secret `ANDROID_KEYSTORE_BASE64`.
    - Signs the APK using `apksigner` with `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
    - Uploads the signed release APK (`parkpro-release.apk`) as a build artifact and GitHub Release.
  - Also provide a secondary workflow for Bubblewrap / TWA build if direct HTTPS deployment is preferred.
- **Verification:** Workflow YAML validated against GitHub Actions schema; Gradle build command succeeds locally.

---

## Acceptance Criteria
1. Project layout is structured with `/app`, `/server-php`, `/android`, and `/.github/workflows`.
2. PWA app loads offline via Service Worker caching.
3. Database engine boots on first run, seeds default admin and vehicle types, and executes CRUD queries locally.
4. GitHub Actions configuration script is fully prepared to produce a signed release APK.
