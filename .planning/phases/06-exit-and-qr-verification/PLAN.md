# Phase 6: Vehicle Exit, Anti-Tamper QR Verification & Fee Settlement Engine

## Phase Goal
Build the automated vehicle exit checkout pipeline featuring fast camera QR scanning, HMAC-SHA256 digital signature validation, transparent fee computation, lost-ticket resolution with penalty calculation, and gate-pass printing.

---

## Task Breakdown

### Task 1: Camera QR Scanner & Signature Verifier (`app/js/qr-verifier.js`)
- **Scope:**
  - Fast QR code video stream reader using native `BarcodeDetector` (supported on Chromium / Android) with canvas fallback.
  - Parse QR payload string: `${ticket_no}|${plate_number}|${qr_signature}`.
  - Cryptographic verification: Recompute HMAC-SHA256 signature against stored lot secret key. If signature is mismatched or missing, display loud red alert "FORGED / TAMPERED TICKET DETECTED".
  - Haptic feedback and success chime upon valid QR decode.
- **Verification:** Scanning valid ticket loads session instantly; modified payload triggers tamper alarm.

### Task 2: Exit Detail & Tariff Settlement Modal
- **Scope:**
  - Display comprehensive breakdown:
    - Plate number with visual vehicle icon.
    - Entry timestamp and Exit timestamp.
    - Elapsed duration in minutes and rounded billable hours.
    - Tariff breakdown (Base rate, hourly rate, grace period badge, daily cap badge, night tariff).
    - Amount due in local currency.
  - One-tap "Collect Payment & Open Gate" settlement action.
  - Optional exit gate pass thermal print.
- **Verification:** Completing checkout updates session to `completed`, releases parking slot, and records exit in `sync_queue`.

### Task 3: Lost-Ticket Resolution Workflow
- **Scope:**
  - "Lost Ticket" resolution button inside exit modal.
  - Lookup active parked vehicle by license plate number.
  - Apply configured lost-ticket penalty fee (e.g. 500 PKR) on top of accumulated duration charges.
  - Require Operator confirmation with audit log entry: `LOST_TICKET_RESOLVED`.
- **Verification:** Resolving a lost ticket calculates penalty, updates status to `completed`, and logs audit trail.

---

## Acceptance Criteria
1. Camera QR scanner reads ticket QR and verifies signature in under 1 second.
2. Fee is calculated accurately with transparent itemization.
3. Tampered tickets are detected and blocked.
4. Lost ticket flow successfully identifies vehicle by plate and applies penalty fee.
