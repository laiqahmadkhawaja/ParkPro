# Phase 5: Bluetooth Thermal ESC/POS Receipt Printing

## Phase Goal
Deliver wireless thermal ticket printing supporting 58mm and 80mm mobile Bluetooth printers via standard Web Bluetooth API and native Android bridge fallback.

---

## Task Breakdown

### Task 1: Dual-Mode Bluetooth Adapter (`app/js/printer.js`)
- **Scope:**
  - `Web Bluetooth API` integration (`navigator.bluetooth`):
    - Connects to Bluetooth Low Energy / Serial GATT services (standard printer service UUIDs: `000018f0-...`, `49535343-...`, etc.).
  - `AndroidBridge` native fallback:
    - Queries paired bonded devices via `window.AndroidBridge.getPairedBluetoothDevices()`.
    - Transmits raw ESC/POS bytecodes via `window.AndroidBridge.printBluetooth(macAddress, base64Payload)`.
  - Saved default printer MAC/Name in `settings` for 1-tap instant printing without re-prompting.
- **Verification:** Mock and live print dispatch successful byte chunks to targeted device.

### Task 2: Standard ESC/POS Bytecode Generator
- **Scope:**
  - Build raw byte array according to standard ESC/POS specification:
    - `0x1B, 0x40`: Initialize printer
    - `0x1B, 0x61, 0x01`: Center alignment
    - Facility Title, Address, Phone
    - `0x1D, 0x21, 0x11`: Double Width & Double Height font for Plate Number
    - `0x1B, 0x21, 0x00`: Normal font for Ticket details, Date/Time, Rates
    - ESC/POS 2D QR Code generation byte sequence
    - Receipt Footer Note
    - `0x1B, 0x64, 0x03`: Feed 3 lines
    - `0x1D, 0x56, 0x00`: Paper cut command
  - Auto-adjust column layouts for 58mm (32 chars) vs. 80mm (48 chars).
- **Verification:** Generates byte stream containing correct alignment, sizing, and text delimiters.

### Task 3: Thermal Printer Pairing & Test Print UI
- **Scope:**
  - UI modal to scan for available Bluetooth thermal printers.
  - Test print button to verify line feeds, bold formatting, and barcode/QR rendering.
  - "Reprint Ticket" button on recent session cards.
- **Verification:** Attendant can test print and reprint any active ticket with 1 tap.

---

## Acceptance Criteria
1. Web Bluetooth and AndroidBridge dual-mode dispatch handles printing seamlessly in PWA and APK.
2. ESC/POS byte generator produces formatted receipts for both 58mm and 80mm paper widths.
3. Test print and reprint functions work offline.
