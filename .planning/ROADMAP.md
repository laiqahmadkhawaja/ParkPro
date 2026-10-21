# ParkPro Roadmap: Offline-First Mobile Parking Management System

## Milestone 1: Core Offline-First Parking Operations (Phases 0–7)
Deliver a standalone, fully offline mobile app packaged as an Android APK via GitHub Actions with entry, exit, camera OCR plate recognition, thermal printing, and local analytics.

### Phase 0: Project Foundation & Automated APK CI/CD Pipeline
- **Goal:** Set up project structure, PWA manifest, Service Worker offline caching, and GitHub Actions workflow to build and sign Android APK.
- **Deliverables:**
  - Directory structure: `/app` (PWA mobile frontend), `/server-php` (PHP 8 backend), `.github/workflows/build-apk.yml`.
  - PWA manifest, service worker setup for 100% offline cold-start.
  - GitHub Actions workflow to compile, sign with Android Keystore secrets, and release signed `.apk`.
- **Done When:** Repository builds a signed APK in GitHub Actions that installs on an Android device and loads offline.

### Phase 1: Local Database & Unified Data Layer
- **Goal:** Build the client-side transactional storage layer and database migrations matching the PHP relational schema.
- **Deliverables:**
  - Local database engine (IndexedDB / SQLite WASM) with transactional integrity.
  - Schema definitions: `users`, `vehicle_types`, `parking_sessions`, `shifts`, `settings`, `audit_logs`, `sync_queue`.
  - Data access layer (DAL) abstraction allowing identical calls for local database and remote REST API.
  - Initial seed data (default admin, default vehicle types: Bike, Car, Rickshaw, Van, Bus/Truck).
- **Done When:** Full CRUD operations execute locally with sub-millisecond response times and zero network dependencies.

### Phase 2: Authentication, RBAC & First-Run Wizard
- **Goal:** Implement offline authentication, role-based access control, and initial system setup.
- **Deliverables:**
  - First-run setup wizard (define parking lot profile, create master admin).
  - PIN and password authentication with offline SHA-256 / PBKDF2 hashing.
  - Role management: Admin, Manager, Operator.
  - Session auto-lock after inactivity and brute-force lockout protection.
- **Done When:** Operators can log in via 4-digit PIN while offline, accessing only assigned features.

### Phase 3: Parking Profile, Rates & Receipt Template Engine
- **Goal:** Configurable parking lot details, vehicle categories, multi-tier pricing structures, and receipt templates.
- **Deliverables:**
  - Lot profile settings: Name, logo, address, contact, tax/registration number.
  - Dynamic fee engine: Flat rates, hourly rates, first-hour rate, grace period (minutes), 24h daily maximum, night tariff.
  - Receipt customizer with live interactive preview for 58mm and 80mm formats.
- **Done When:** Modifying rates or lot details immediately updates the calculation engine and receipt template.

### Phase 4: Vehicle Entry & On-Device Camera Plate Scanner
- **Goal:** 1-tap rapid entry workflow with client-side OCR license plate scanner.
- **Deliverables:**
  - Large-touch vehicle type selection selector.
  - HTML5 Camera viewport with real-time on-device OCR plate recognition (Tesseract.js WASM / OCR engine).
  - Plate confirmation modal with one-touch edit keypad.
  - Duplicate-entry detection (alerting if vehicle is already parked inside).
  - Session creation with timestamp, UUID ticket ID, and HMAC-SHA256 digital signature.
- **Done When:** From tap to saved entry takes under 5 seconds with plate recognized offline.

### Phase 5: Bluetooth Thermal ESC/POS Receipt Printing
- **Goal:** Direct wireless printing to 58mm/80mm Bluetooth thermal printers.
- **Deliverables:**
  - Bluetooth device scanner and persistent pairing memory via Web Bluetooth API (`navigator.bluetooth`).
  - Native ESC/POS command generator: Bold plate number, entry barcode/QR code, header logo, line dividers, cut command.
  - Print preview modal and instant reprint functionality.
  - Print fallback: Screen ticket / sharing ticket when printer is unavailable.
- **Done When:** Entry ticket prints reliably to paired Bluetooth thermal printer in under 2 seconds.

### Phase 6: Vehicle Exit, QR Verification & Fee Calculation Engine
- **Goal:** Instant exit checkout, anti-tamper QR verification, and automated fee settlement.
- **Deliverables:**
  - High-speed QR scanner using camera.
  - QR signature verification against tamper secret.
  - Automatic duration calculation and fee engine breakdown (duration, base, tier, penalties, discounts).
  - Lost ticket resolution workflow (search by plate number, apply penalty fee with manager authorization).
  - One-tap session close, gate-pass receipt generation, and slot release.
- **Done When:** Scanning ticket QR computes fee and closes session in under 3 seconds.

### Phase 7: Real-Time Operations Dashboard & Occupancy Metrics
- **Goal:** High-visibility dashboard for parking attendants and managers.
- **Deliverables:**
  - Live KPI cards: Current parked vehicles, today's entries, today's exits, total revenue, average park duration.
  - Real-time lot capacity and occupancy progress indicator.
  - Live searchable list of currently parked vehicles (filter by plate, vehicle type, entry time).
  - Prominent quick-action buttons: "New Entry" and "Scan Exit".
- **Done When:** Attendant sees real-time capacity and active vehicles update dynamically with every action.

---

## Milestone 2: Enterprise Features & Online Synchronization (Phases 8–12)

### Phase 8: Admin Panel, Analytics & Data Export
- **Goal:** Comprehensive management interface, reporting, and data portability.
- **Deliverables:**
  - Shift summary and cash reconciliation module.
  - Revenue breakdown charts (by vehicle type, hourly distribution, operator).
  - Export capabilities: PDF receipt/report generation, Excel/CSV export of parking sessions.
  - System audit log tracking all edits, cancellations, and manual fee overrides.
  - Offline database backup and restore (encrypted JSON/SQLite dump).
- **Done When:** Admin can export detailed financial reports and audit logs for any date range offline.

### Phase 9: PHP 8 Central REST API & Two-Way Sync Engine
- **Goal:** Central server for multi-device sync and remote management.
- **Deliverables:**
  - Lightweight PHP 8 REST API with SQLite/MySQL database.
  - Token-based API authentication and CORS configuration.
  - Background sync client: Monitors network status (`navigator.onLine`), flushes pending `sync_queue` items, and receives new remote updates.
  - Conflict resolution strategy: Client timestamp vs. server timestamp with audit preservation.
- **Done When:** Offline transactions automatically synchronize to the PHP backend once internet is reconnected.

### Phase 10: Enterprise Enhancements & Localization
- **Goal:** Advanced operational capabilities for commercial parking installations.
- **Deliverables:**
  - Operator shifts: Opening float, shift close, cash counted vs. expected, discrepancy tracking, Daily Z-Report.
  - Urdu & English bilingual UI with instantaneous toggle and RTL layout support.
  - Vehicle blacklist alert (stolen/flagged vehicles prompt warning on entry).
  - VIP / Monthly pass whitelist (free/prepaid entry for registered plates).
- **Done When:** Shifts close with verified cash reconciliation and UI renders seamlessly in Urdu and English.

### Phase 11: End-to-End Testing & Hardening
- **Goal:** Verify performance, offline resilience, and hardware compatibility.
- **Deliverables:**
  - Stress test with 10,000+ local records to ensure zero UI lag.
  - Offline-online transition test: network drop, reconnect, and conflict handling.
  - OCR accuracy verification under low-light and angled camera conditions.
  - Hardware testing across thermal printer widths (58mm and 80mm).
- **Done When:** System passes all stress and offline resilience benchmarks without crash or data loss.

### Phase 12: Production Packaging & Release
- **Goal:** Final release pipeline, signed APK distribution, and operations documentation.
- **Deliverables:**
  - Automated GitHub Actions release pipeline building signed APK with version tags.
  - In-app update notification / PWA service worker update prompt.
  - User manual and operator training guide (English + Urdu).
- **Done When:** Production APK installs cleanly, registers in release repository, and is ready for frontline deployment.
