# Phase 10: Enterprise Localization, Security & Daily Z-Reports

## Phase Goal
Equip ParkPro with enterprise capabilities including Urdu/English bilingual support with instant RTL switching, vehicle blacklist security alerts, VIP monthly passes, and thermal Daily Z-Report printing.

---

## Task Breakdown

### Task 1: Urdu & English Localization Engine (`app/js/i18n.js`)
- **Scope:**
  - Comprehensive translation dictionary for English and Urdu (Nastaliq/Arabic script).
  - 1-tap language toggle in header (`EN` / `اردو`).
  - Dynamic `dir="rtl"` attribute and font switching (`var(--font-urdu)`).
  - Translates buttons, status pills, KPI headers, modals, and error alerts.
- **Verification:** Toggling language switches entire UI and layout orientation instantaneously offline.

### Task 2: Vehicle Blacklist & VIP Pass Engines
- **Scope:**
  - Blacklist store: checks entry plate against flagged/stolen registry and prompts loud warning.
  - VIP / Monthly Pass store: checks exit plate against valid passes and grants zero-charge exit pass.
- **Verification:** Blacklisted plate entry triggers warning prompt; VIP plate checkout computes 0 fee with active pass notice.

### Task 3: Bluetooth Thermal Daily Z-Report Builder
- **Scope:**
  - Bytecode ESC/POS Z-Report layout:
    - Facility header and Shift ID.
    - Operator Name and Shift Duration.
    - Financial summary: Starting Float, Cash Collected, Counted Drawer, Discrepancy.
    - Vehicle statistics: Total entries and exits.
    - Signature line and auto paper cut.
- **Verification:** Closing shift prints formatted Z-Report to Bluetooth thermal printer.

---

## Acceptance Criteria
1. UI toggles smoothly between English LTR and Urdu RTL.
2. Blacklist alerts trigger immediately upon scanning flagged plates.
3. VIP registered vehicles checkout with zero fee.
4. Daily Z-Report prints cleanly to 58mm/80mm thermal printers.
