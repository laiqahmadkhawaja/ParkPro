# ParkPro: Operator & Administrator Manual

## 1. System Overview
**ParkPro** is an offline-first mobile parking management system engineered for Android handheld terminals, smartphones, and tablets. It operates 100% offline without requiring internet connectivity and automatically synchronizes data with a central PHP 8 server when online.

---

## 2. Android APK Installation & GitHub Actions

### 2.1 Automated Cloud Build (Zero local SDK required)
Every push to your GitHub repository triggers `.github/workflows/build-apk.yml`, which:
1. Compiles the Android WebView wrapper via Gradle.
2. Cryptographically signs the APK with your release keystore secret.
3. Publishes the ready-to-install `ParkPro-Release-APK` under GitHub Releases and Workflow Artifacts.

### 2.2 Installing the APK on Devices
1. Download the generated `.apk` file to your Android device.
2. Enable **Install from Unknown Sources** in Android Settings if prompted.
3. Open and install `ParkPro.apk`.
4. Grant **Camera** and **Bluetooth** permissions upon launch.

---

## 3. First-Run Setup & PIN Authentication

### 3.1 First-Run Wizard
On first installation, ParkPro automatically presents the setup wizard:
1. **Facility Name:** e.g. `Central City Commercial Parking`.
2. **Address & Gate:** e.g. `Main Commercial Boulevard, Gate #1`.
3. **Currency Symbol:** e.g. `PKR`, `USD`, `AED`.
4. **Lot Capacity:** e.g. `100` slots.
5. **Master Credentials:** Configure your 4-digit master PIN (Default: `1234`) and admin password.

### 3.2 4-Digit Touch PIN Login
- To switch attendants or unlock the terminal, tap the operator avatar and punch the 4-digit PIN.
- The terminal automatically locks after **5 minutes of inactivity** or when tapping the padlock icon 🔒 in the top header.
- Brute-force protection locks the numpad for 60 seconds after 5 consecutive incorrect attempts.

---

## 4. Attendant Operational Workflows

### 4.1 Opening a Shift
1. Navigate to the **Reports** tab (or prompt on login).
2. Tap **OPEN SHIFT**.
3. Enter the physical starting cash float in the drawer (e.g. `2000`).
4. The shift status turns green: `● SHIFT ACTIVE`.

### 4.2 Logging a Vehicle Entry
1. Tap the large blue **SCAN PLATE** button.
2. Select the vehicle category (e.g. Bike 🏍️, Rickshaw 🛺, Car 🚗, Van 🚐, Truck 🚚).
3. Tap **OPEN CAMERA** to view the live plate scanner. Align the plate inside the blue reticle box.
4. Tap **SNAP & READ PLATE** (or type manually if dirty/damaged).
5. Tap **PRINT TICKET & SAVE ENTRY**.
   * *Duplicate Check:* The system prevents double entry if the plate is already inside.
   * *Capacity Check:* The system warns if the lot is 100% full.
   * *Security Check:* If the plate is on the **Blacklist Registry**, a security warning triggers immediately.
   * The paired Bluetooth thermal printer instantly prints the physical barcode ticket.

### 4.3 Logging a Vehicle Exit & Settlement
1. Tap the large emerald **EXIT SCAN** button.
2. Tap **SCAN TICKET QR** and point the camera at the customer's paper ticket.
   * *Anti-Tamper Check:* Recomputes the cryptographic HMAC-SHA256 signature. If modified or counterfeit, a red alert sounds: `TAMPERED TICKET DETECTED!`.
3. The screen calculates the exact stay duration, grace period ($0), hourly tiers, and night tariff.
4. Collect the cash payment and tap **COLLECT PAYMENT & OPEN GATE**.
5. The gate opens, the slot is freed, and the occupancy meter decreases.

### 4.4 Lost Ticket Resolution
1. Inside the Exit modal, tap **LOST TICKET**.
2. Enter the customer's vehicle license plate.
3. Confirm the lost-ticket penalty fee (e.g. `+500 PKR`).
4. Settle the fee and release the gate. An audit record is logged with supervisor approval.

### 4.5 Closing a Shift & Daily Z-Report
1. Tap the **Reports** tab.
2. Tap **CLOSE SHIFT**.
3. Count the physical cash in the drawer and enter the amount.
4. ParkPro calculates:
   * **Starting Float** + **Cash Collected** = **Expected Cash**
   * **Counted Cash** - **Expected Cash** = **Discrepancy (Over / Short / Balanced)**
5. A **Daily Z-Report** prints automatically to the Bluetooth thermal printer with operator and supervisor signature lines.

---

## 5. Bluetooth Thermal Printer Setup

### 5.1 Supported Hardware
* Any standard **58mm (32 columns)** or **80mm (48 columns)** Bluetooth thermal receipt printer supporting ESC/POS (e.g., PT-210, MPT-II, POS-5802, Epson, Xprinter).

### 5.2 Pairing Instructions
1. Turn on Bluetooth on your Android device and pair the printer in Android Bluetooth settings (Default PIN is usually `0000` or `1234`).
2. Open ParkPro, go to **Settings** $\rightarrow$ **Printer**.
3. Tap **PAIR / CONNECT PRINTER**.
4. Tap **SEND TEST PRINT TICKET** to verify line alignment, bold fonts, and QR rendering.

---

## 6. Bilingual Support & Urdu RTL Layout
* Tap the language toggle button in the top header (**EN** / **اردو**).
* Switching to Urdu instantly flips the entire interface into Right-to-Left (RTL) mode with Urdu typography and translated alerts.

---

## 7. Data Portability & Online Synchronization
* **Offline Backup:** Under the **Reports** tab, tap **BACKUP DB** to download a complete JSON snapshot of all parking records, rates, and shifts.
* **Restore:** Tap **RESTORE DB** to upload and recover a saved backup.
* **PHP Central Sync:** When the mobile device connects to Wi-Fi or cellular data, the background sync engine pushes pending records to `/server-php/api/sync.php` and downloads remote changes every 30 seconds automatically.
