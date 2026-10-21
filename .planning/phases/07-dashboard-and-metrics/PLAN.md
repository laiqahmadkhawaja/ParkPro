# Phase 7: Real-Time Operations Dashboard & Occupancy Metrics

## Phase Goal
Deliver a real-time command dashboard and vehicles registry featuring dynamic occupancy indicators, live KPI calculations, search and filtering by vehicle category, and instant action triggers for attendants and supervisors.

---

## Task Breakdown

### Task 1: Real-Time Lot Occupancy Visualizer
- **Scope:**
  - Progress bar dynamically shaded:
    - Normal (Green): Occupancy < 75%
    - Busy (Amber): Occupancy 75% – 90%
    - Critical Full (Red): Occupancy > 90%
  - Displays numerical count: `Active / Total Slots` and remaining available slots (`X Slots Free`).
- **Verification:** Adding sessions increases count and updates meter color automatically.

### Task 2: Searchable & Filterable Parked Vehicles Registry
- **Scope:**
  - Real-time search bar filtering across license plates and ticket numbers.
  - Category filter pills: All, Bikes (🏍️), Cars (🚗), Rickshaws (🛺), Vans (🚐), Trucks (🚚).
  - Sort selector: Sort by Entry Time (Newest first, Oldest first) or Duration.
  - Interactive Action Menu per parked vehicle:
    - "Exit Checkout" (opens Exit settlement modal directly for that vehicle)
    - "Reprint Ticket" (dispatches ESC/POS print again to Bluetooth printer)
- **Verification:** Typing plate filters list immediately; tapping "Exit Checkout" auto-populates the vehicle in the exit modal.

### Task 3: Dedicated Vehicles View (Bottom Nav Tab 2)
- **Scope:**
  - Full-screen view listing all active and recently completed sessions with tabs: "Currently Parked" and "Completed Today".
  - Clean monospaced plate styling with category badges and duration counter.
- **Verification:** Switching between Dashboard and Vehicles view maintains state and updates live.

---

## Acceptance Criteria
1. Occupancy visualizer changes colors based on capacity thresholds.
2. Search and filter update the list in <50ms without lag.
3. Quick actions (Reprint, Direct Exit) trigger smoothly from the vehicle list.
