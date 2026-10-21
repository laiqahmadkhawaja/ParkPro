# ParkPro: Offline-First Mobile Parking Management System

## 1. Project Overview
- **Project Title:** ParkPro
- **Description:** Mobile-first, offline-capable parking management application that operates completely without internet on Android devices and syncs seamlessly with a central PHP 8 server when online.
- **Packaging & Delivery:** HTTPS-hosted Progressive Web Application (PWA) / Trusted Web Activity (TWA) packaged into a standalone signed Android APK via automated GitHub Actions CI/CD.

---

## 2. Architecture & Technology Stack

### 2.1 Core Stack
| Component | Technology | Rationale & Responsibility |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, Modern CSS3 (Grid/Flexbox), Vanilla JS (ES2022) | Zero framework bloat; instant cold start (< 1.5s); touch targets > 48px; mobile-first. |
| **Offline Cache** | Service Worker + CacheStorage | Stores all app assets locally for 100% offline cold start even in airplane mode. |
| **Offline Database** | IndexedDB / SQLite WASM (`wa-sqlite`) | High-performance client-side transactional storage for 10,000+ sessions and configurations. |
| **Hardware - Camera / OCR** | `getUserMedia` + Client-Side WASM OCR | Live camera video feed with on-device license plate text recognition without cloud API calls. |
| **Hardware - Thermal Printing** | Web Bluetooth API (`navigator.bluetooth`) & Android Native Bridge | Raw ESC/POS bytecode generation for 58mm/80mm mobile Bluetooth thermal printers. |
| **Packaging & CI/CD** | HTTPS -> GitHub Actions -> Signed APK | Automated GitHub Actions workflow using Bubblewrap / Android Gradle to compile and sign release APK/AAB with GitHub secrets keystore. |
| **Online Backend** | PHP 8.1+ REST API + SQLite/MySQL | Token-authenticated REST API for multi-terminal sync, remote reports, and centralized administration. |

### 2.2 Architectural Shift: Capacitor vs. HTTPS -> GitHub Actions Build
Instead of relying on heavy local Capacitor dependencies:
1. **HTTPS App Shell:** The web app is served over HTTPS with full PWA manifests and Service Worker caching.
2. **Offline Resilience:** The application is self-contained. Once loaded or installed as an APK, the Service Worker guarantees full offline operation without touching the network.
3. **Hardware Bridges:**
   - **Web Bluetooth:** Directly supported in Chrome on Android and TWA over HTTPS. Attendants pair their 58mm/80mm Bluetooth printer once; receipts print directly via raw ESC/POS commands.
   - **Android Native Bridge Fallback:** A lightweight Gradle-based Android WebView shell in `.github/workflows` / `android/` can also be built to bind native Android Bluetooth sockets and camera if needed.
4. **Automated CI/CD:** Every push to GitHub runs a GitHub Actions workflow that:
   - Validates and bundles web assets
   - Builds the Android APK
   - Signs the APK with an Android Keystore stored in GitHub Secrets
   - Publishes the ready-to-install `.apk` as a downloadable GitHub Release artifact.

---

## 3. Database Schema Design (Unified Offline/Online)
The local client-side database and the remote PHP backend mirror the identical relational schema:

1. **`users`**: `id`, `username`, `name`, `password_hash`, `pin_hash`, `role` (Admin, Manager, Operator), `status`, `created_at`
2. **`vehicle_types`**: `id`, `name`, `icon`, `base_rate`, `hourly_rate`, `grace_period_mins`, `daily_max`, `night_rate`, `status`
3. **`parking_sessions`**: `id` (UUID), `ticket_no`, `plate_number`, `vehicle_type_id`, `entry_time`, `exit_time`, `operator_entry_id`, `operator_exit_id`, `rate_applied`, `total_amount`, `discount_amount`, `penalty_amount`, `status` (parked, completed, lost_ticket), `qr_signature`, `sync_status`, `created_at`, `updated_at`
4. **`shifts`**: `id` (UUID), `operator_id`, `start_time`, `end_time`, `starting_float`, `total_cash_collected`, `expected_cash`, `actual_cash`, `discrepancy`, `status` (open, closed), `notes`
5. **`settings`**: `key`, `value`, `updated_at` (lot_name, lot_address, phone, currency, receipt_header, receipt_footer, printer_width, qr_secret)
6. **`audit_logs`**: `id`, `user_id`, `action`, `details`, `ip_or_device`, `timestamp`
7. **`sync_queue`**: `id`, `table_name`, `record_id`, `operation` (INSERT, UPDATE, DELETE), `payload` (JSON), `created_at`, `attempts`, `status` (pending, synced, failed)

---

## 4. Key Functional Modules
1. **Authentication & Shift Control:**
   - Role-based authorization: Admin (system configuration, rates, analytics), Manager (shift overrides, manual lost-ticket waivers), Operator (rapid entry/exit operations).
   - Fast 4-digit PIN login with offline cryptographic verification.
   - Shift opening/closing with cash reconciliation and Z-Report printing.
2. **Vehicle Entry:**
   - 1-tap vehicle type selection (Bike, Car, Rickshaw, Van, Truck).
   - Live camera view with automatic OCR plate scanning and single-tap confirmation/correction.
   - Duplicate entry check: instantly alerts if a vehicle with the same plate is already inside.
   - Instant ticket generation with HMAC-SHA256 signed QR code.
3. **Bluetooth Thermal Receipt Printing:**
   - Direct ESC/POS driver supporting 58mm (32 chars) and 80mm (48 chars).
   - Formatted ticket: Header logo/name, large bold plate number, vehicle category, entry timestamp, rates, anti-tamper QR, footer terms.
   - Reprint capability and offline queueing.
4. **Vehicle Exit & Fee Calculation:**
   - Fast QR scanner with instant tamper signature verification.
   - Comprehensive rate calculation engine: grace periods, tiered hourly rates, daily caps, lost-ticket penalty fee.
   - One-tap payment acceptance and gate opening confirmation.
5. **Dashboard & Operational Analytics:**
   - Live metrics: Currently parked count, total entries/exits, total revenue, average duration, occupancy percentage.
   - Searchable live parking registry.
   - Shift and daily Z-reports with PDF, Excel, and CSV export.
6. **Enterprise Features:**
   - Bilingual support: English and Urdu (RTL-ready).
   - Lost-ticket lookup by plate number with manager audit trail.
   - Blacklist alert system for flagged or suspicious plates.
   - Two-way background delta sync engine when connectivity is restored.
