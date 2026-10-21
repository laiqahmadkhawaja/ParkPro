# ParkPro

> **Offline-First Mobile Parking Management System**

ParkPro is an offline-capable parking operations platform built for Android terminals, tablets, and smartphones. It handles vehicle entry (license plate OCR recognition, Bluetooth thermal receipt printing), exit (anti-tamper QR code verification, dynamic fee settlement), and administrative control (rates, shifts, analytics, and sync).

---

## Key Features

- **Offline-First Architecture:** 100% operational in airplane mode with sub-second cold starts powered by a Cache-First Service Worker and IndexedDB transactional engine.
- **On-Device Plate Recognition:** Live camera feed with on-device license plate extraction and format normalization.
- **Bluetooth Thermal Printing:** Native ESC/POS driver supporting 58mm and 80mm wireless Bluetooth receipt printers via Web Bluetooth API and Android native SPP RFCOMM sockets.
- **Anti-Tamper QR Security:** HMAC-SHA256 digital signature embedded in every ticket to detect and block forged physical tickets.
- **Dynamic Fee Engine:** Multi-tier tariffs, grace periods, hourly increments, 24-hour daily caps, and overnight surcharges.
- **Shift & Cash Reconciliation:** Starting drawer floats, cash collected tracking, over/short discrepancy audits, and printable Daily Z-Reports.
- **Bilingual Interface:** Instant 1-tap switching between English (LTR) and Urdu (RTL).
- **Two-Way Sync:** Delta synchronization with a central PHP 8 REST API whenever network connectivity returns.

---

## Automated GitHub Actions APK Builds

This repository is configured with a GitHub Actions workflow (`.github/workflows/build-apk.yml`) that automatically compiles and signs an installable Android APK on every push to `main`.

To download the signed APK:
1. Navigate to the **Actions** tab in this GitHub repository.
2. Select the latest workflow run.
3. Download the **`ParkPro-Signed-Release-APK`** artifact.

---

## Directory Structure

```
├── .github/workflows/       # GitHub Actions automated APK build & sign workflow
├── android/                 # Android WebView wrapper with native Bluetooth bridge
├── app/                     # Offline PWA mobile application (HTML5, CSS3, Vanilla JS)
│   ├── css/                 # Mobile design system & RTL styles
│   ├── js/                  # DB, auth, fee engine, camera OCR, printer, QR verifier
│   ├── manifest.json        # PWA Web App Manifest
│   └── sw.js                # Service Worker offline cache
├── server-php/              # Central PHP 8 REST API (SQLite / MySQL)
└── docs/                    # Operator manual & benchmark scripts
```

---

## License
MIT License
