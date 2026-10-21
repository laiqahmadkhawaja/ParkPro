# Phase 2: Authentication, RBAC & First-Run Wizard

## Phase Goal
Implement secure offline authentication, a fast 4-digit PIN numpad interface, role-based access control (Admin, Manager, Operator), session management with auto-lock protection, and a first-run lot onboarding wizard.

---

## Task Breakdown

### Task 1: Authentication Engine & Session State (`app/js/auth.js`)
- **Scope:**
  - Fast cryptographic verification using local Web Crypto SHA-256 against stored `pin_hash` or `password_hash`.
  - Roles: `Admin`, `Manager`, `Operator`.
  - In-memory current user session object (`currentUser`, `currentRole`, `sessionToken`).
  - Session auto-lock after 5 minutes of inactivity; brute-force lockout after 5 consecutive failed attempts (60-second cooldown).
  - Logout and instant lock controls.
- **Verification:** Unit logic correctly matches seeded admin (`PIN: 1234`), assigns `Admin` role, and blocks invalid PINs.

### Task 2: 4-Digit Touch PIN Pad & User Switcher UI
- **Scope:**
  - Create full-screen PIN entry overlay with large, responsive numpad buttons (0–9, backspace, clear).
  - Visual masked PIN indicator dots (● ● ● ●).
  - Multi-user selector allowing operators to tap their name/avatar and punch their PIN without typing usernames.
  - Header profile indicator showing active logged-in user name and role badge, with quick-lock icon.
- **Verification:** Tapping PIN dots logs user in immediately upon 4th digit.

### Task 3: Role-Based Access Control (RBAC) Enforcement
- **Scope:**
  - Enforce permissions across UI elements:
    - `Operator`: Allowed to execute "Scan Plate" (Entry), "Exit Scan" (Exit), and view active lot count. Restricted from Settings, User Management, and Financial Reports.
    - `Manager`: Allowed all Operator functions plus live reports, fee overrides, and shift cash audits.
    - `Admin`: Unrestricted access across all operational, financial, configuration, and user management modules.
  - Automatically adapt bottom navigation tabs and action buttons based on active role.
- **Verification:** Logging in as Operator hides Settings and Admin Reports; logging in as Admin reveals full suite.

### Task 4: First-Run Onboarding Wizard
- **Scope:**
  - Checks if `setup_completed` flag exists in local `settings`.
  - If unconfigured, renders a sleek 3-step setup wizard:
    1. Parking Lot Details: Name, address, phone, currency (PKR/USD/EUR/INR/AED).
    2. Capacity & Rates overview.
    3. Master Admin credentials: Set new 4-digit PIN and password.
  - Writes settings to IndexedDB and marks `setup_completed: 'true'`.
- **Verification:** Resetting database triggers wizard; completing wizard boots directly into configured operational state.

---

## Acceptance Criteria
1. First-run wizard activates on fresh install and saves configuration offline.
2. Fast 4-digit PIN authentication validates offline against IndexedDB in <100ms.
3. Attendants with `Operator` role are restricted from administrative controls.
4. Auto-lock engages after inactivity, requiring PIN to resume work.
