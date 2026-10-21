# Phase 3: Settings, Rates Engine & Live Receipt Preview

## Phase Goal
Build the administrative settings center, configure lot profile and logo, implement the advanced multi-tier fee calculation engine, and provide a real-time thermal receipt preview simulator for both 58mm (32 chars) and 80mm (48 chars) formats.

---

## Task Breakdown

### Task 1: Comprehensive Fee Calculation Engine (`app/js/fee-engine.js`)
- **Scope:**
  - Support flexible pricing structures per vehicle category:
    - `grace_period_mins`: Zero charge if exit occurs within grace period (e.g., 10 mins).
    - `base_rate`: Covers initial entry / first hour.
    - `hourly_rate`: Charged per subsequent hour (or partial hour).
    - `daily_max`: 24-hour maximum cap protecting long-stay parkers.
    - `night_rate`: Optional flat surcharge or higher rate between 10:00 PM and 06:00 AM.
    - `penalty_rate`: Lost-ticket penalty fee.
  - Return detailed transparent computation object:
    `{ durationMins, billableHours, baseAmount, hourlyAmount, nightSurcharge, penaltyAmount, totalFee }`.
- **Verification:** Test cases verify grace period ($0), standard stay, overnight stay, and 24h cap.

### Task 2: Parking Lot Profile & Rate Management Interface
- **Scope:**
  - Create the Settings view modal accessible to Admins:
    - Facility Profile: Lot Name, Address, Contact Phone, Tax / NTN Number, Currency Symbol.
    - Hardware Settings: Thermal printer width selection (58mm or 80mm), default Bluetooth printer MAC address.
    - Vehicle Types CRUD: Add new vehicle types, adjust base rate, hourly rate, grace period, and daily cap.
- **Verification:** Updating vehicle rates saves to IndexedDB and reflects immediately in the vehicle grid and checkout fee engine.

### Task 3: Interactive Live Receipt Preview
- **Scope:**
  - Render an on-screen realistic ESC/POS thermal receipt paper simulator with monospaced receipt typography:
    - Facility header, contact, date/time in.
    - Big bold license plate display.
    - Rate schedule, vehicle category.
    - Generated QR Code container.
    - Customizable receipt footer terms and disclaimer.
  - Toggle between 58mm (compact) and 80mm (wide) views with instant re-formatting.
- **Verification:** Changing lot name or footer text updates the live receipt preview in real time.

---

## Acceptance Criteria
1. Fee calculation engine calculates exact fees matching configured tiered rules (grace period, hourly tiers, daily cap).
2. Vehicle rates can be edited and new vehicle categories added offline.
3. Live receipt simulator displays accurate formatted receipt layout for both 58mm and 80mm widths.
