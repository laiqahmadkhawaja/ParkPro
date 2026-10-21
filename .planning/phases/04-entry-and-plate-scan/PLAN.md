# Phase 4: Vehicle Entry & On-Device Camera Plate Scanner

## Phase Goal
Implement the high-speed vehicle entry workflow featuring live camera plate scanning via client-side OCR, plate format extraction, instant manual edit keypad, duplicate entry check, lot capacity check, and tamper-resistant cryptographic QR code signature generation.

---

## Task Breakdown

### Task 1: Camera Controller & Frame Preprocessing (`app/js/camera-ocr.js`)
- **Scope:**
  - Media stream controller using `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.
  - Hidden canvas processor for live contrast enhancement, grayscale conversion, and license plate bounding box targeting.
  - Snapshot OCR extractor matching local license plate patterns (e.g. `ABC-1234`, `LEE-19-1234`, `ICT-202`).
  - Haptic feedback trigger on successful plate extraction.
- **Verification:** Testing with sample plate images extracts formatted text without server round-trips.

### Task 2: Entry Guard Rails (Capacity & Duplicate Verification)
- **Scope:**
  - Duplicate check: Blocks plate entry if a session with status `parked` already exists for that plate.
  - Capacity check: Compares active parked vehicles against lot `capacity`. If 100% full, triggers an alert with an optional Manager override.
- **Verification:** Simulating entry for an existing plate immediately triggers duplicate alert; full lot prompts capacity warning.

### Task 3: Cryptographic QR Signature & Session Creation
- **Scope:**
  - Generate HMAC-SHA256 signature for ticket: `HMAC_SHA256(ticket_no + plate + vehicle_type + entry_time, qr_secret)`.
  - Store signature on session record to prevent forged physical tickets.
  - Create QR code vector on client side for on-screen receipt and thermal print bytecodes.
- **Verification:** Generated ticket QR verifies successfully against local secret key.

---

## Acceptance Criteria
1. Camera opens smoothly on mobile devices with rear-facing camera priority.
2. Plate recognition extracts alphanumeric plate format and auto-fills the input field.
3. Duplicate entry is strictly blocked with clear operator alert.
4. Session is created with UUID, ticket number, and tamper-resistant signature.
