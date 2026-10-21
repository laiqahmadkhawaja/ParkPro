/**
 * ParkPro Core Application Controller
 * Handles UI interactions, offline state, and entry/exit workflows.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('[App] ServiceWorker registered with scope:', reg.scope);
    } catch (err) {
      console.warn('[App] ServiceWorker registration failed:', err);
    }
  }

  // 2. Network Status Monitor
  const statusBadge = document.getElementById('networkStatus');
  const statusText = document.getElementById('networkText');

  function updateNetworkStatus() {
    if (navigator.onLine) {
      statusBadge.classList.remove('offline');
      statusText.textContent = 'ONLINE';
    } else {
      statusBadge.classList.add('offline');
      statusText.textContent = 'OFFLINE';
    }
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // 3. Initialize Local Database and Authentication
  try {
    await window.db.init();
    await window.auth.init();
    await loadVehicleTypes();
    await refreshDashboard();
  } catch (err) {
    console.error('[App] Database/Auth initialization failed:', err);
  }

  // 4. Modal, Lock & Action Event Listeners
  setupEventListeners();
});

// State
let selectedVehicleType = null;
let vehicleTypesList = [];

async function loadVehicleTypes() {
  vehicleTypesList = await window.db.getAll('vehicle_types');
  const typeContainer = document.getElementById('vehicleTypeGrid');
  if (!typeContainer) return;

  typeContainer.innerHTML = '';
  vehicleTypesList.forEach((type, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `type-btn ${idx === 0 ? 'selected' : ''}`;
    btn.innerHTML = `<span>${type.icon}</span><span>${type.name}</span>`;
    btn.onclick = () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedVehicleType = type;
    };
    typeContainer.appendChild(btn);
  });

  if (vehicleTypesList.length > 0) {
    selectedVehicleType = vehicleTypesList[0];
  }
}

async function refreshDashboard() {
  const kpis = await window.db.getTodayKPIs();
  
  document.getElementById('kpiActiveParked').textContent = kpis.activeCount;
  document.getElementById('kpiTodayEntries').textContent = kpis.entriesToday;
  document.getElementById('kpiTodayExits').textContent = kpis.exitsToday;
  document.getElementById('kpiTodayRevenue').textContent = `${kpis.revenueToday} PKR`;
  
  document.getElementById('occupancyText').textContent = `${kpis.activeCount} / ${kpis.totalCapacity} Slots (${kpis.occupancyPercent}%)`;
  document.getElementById('occupancyBar').style.width = `${kpis.occupancyPercent}%`;

  // Load currently parked vehicles
  const parkedVehicles = await window.db.getCurrentlyParked();
  const listContainer = document.getElementById('parkedList');
  if (!listContainer) return;

  if (parkedVehicles.length === 0) {
    listContainer.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;">No vehicles currently parked.</div>';
    return;
  }

  listContainer.innerHTML = parkedVehicles.map(session => {
    const typeObj = vehicleTypesList.find(v => v.id === session.vehicle_type_id) || { name: 'Vehicle', icon: '🚗' };
    const entryDate = new Date(session.entry_time);
    const timeFormatted = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="session-item" data-session-id="${session.id}">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">${typeObj.icon}</span>
          <div>
            <span class="plate-pill">${session.plate_number}</span>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Ticket #${session.ticket_no}</div>
          </div>
        </div>
        <div class="session-meta">
          <span class="session-type">${typeObj.name}</span>
          <span class="session-time">${timeFormatted}</span>
        </div>
      </div>
    `;
  }).join('');
}

function setupEventListeners() {
  // Lock Button
  const btnLock = document.getElementById('btnLockApp');
  if (btnLock) {
    btnLock.onclick = () => window.auth.lock();
  }

  // First-Run Setup Wizard Form Submission
  const wizardForm = document.getElementById('setupWizardForm');
  if (wizardForm) {
    wizardForm.onsubmit = async (e) => {
      e.preventDefault();
      const lotName = document.getElementById('wizardLotName').value.trim();
      const lotAddress = document.getElementById('wizardLotAddress').value.trim();
      const currency = document.getElementById('wizardCurrency').value.trim();
      const capacity = document.getElementById('wizardCapacity').value.trim();
      const adminPin = document.getElementById('wizardAdminPin').value.trim();
      const adminPassword = document.getElementById('wizardAdminPassword').value.trim();

      if (adminPin.length !== 4) {
        alert('PIN must be exactly 4 digits.');
        return;
      }

      const pinHash = await window.db.hash(adminPin);
      const passwordHash = await window.db.hash(adminPassword);

      // Save settings
      await window.db.put('settings', { key: 'lot_name', value: lotName });
      await window.db.put('settings', { key: 'lot_address', value: lotAddress });
      await window.db.put('settings', { key: 'currency', value: currency });
      await window.db.put('settings', { key: 'capacity', value: capacity });
      await window.db.put('settings', { key: 'setup_completed', value: 'true' });

      // Update admin credentials
      const adminUser = await window.db.get('users', 'usr_admin');
      if (adminUser) {
        adminUser.pin_hash = pinHash;
        adminUser.password_hash = passwordHash;
        await window.db.put('users', adminUser);
      }

      window.auth.hideSetupWizard();
      await refreshDashboard();
      window.auth.showPinModal();
      alert('Setup Completed Successfully! Log in with your new PIN.');
    };
  }

  // Modals
  const entryModal = document.getElementById('entryModal');
  const exitModal = document.getElementById('exitModal');

  document.getElementById('btnOpenEntry').onclick = () => {
    document.getElementById('entryPlateInput').value = '';
    entryModal.classList.add('active');
  };

  document.getElementById('btnCloseEntry').onclick = () => {
    entryModal.classList.remove('active');
  };

  document.getElementById('btnOpenExit').onclick = () => {
    document.getElementById('exitTicketInput').value = '';
    document.getElementById('exitDetailsBox').style.display = 'none';
    document.getElementById('btnConfirmExit').style.display = 'none';
    exitModal.classList.add('active');
  };

  document.getElementById('btnCloseExit').onclick = () => {
    exitModal.classList.remove('active');
  };

  // Entry Submit: Check duplicate and save
  document.getElementById('entryForm').onsubmit = async (e) => {
    e.preventDefault();
    const plateInput = document.getElementById('entryPlateInput');
    const plateNumber = plateInput.value.trim().toUpperCase();

    if (!plateNumber) {
      alert('Please enter or scan a license plate number.');
      return;
    }

    if (!selectedVehicleType) {
      alert('Please select a vehicle category.');
      return;
    }

    // Duplicate Check
    const existing = await window.db.getActiveSessionByPlate(plateNumber);
    if (existing) {
      alert(`DUPLICATE ENTRY ALERT!\nPlate ${plateNumber} is already parked inside with Ticket #${existing.ticket_no}.`);
      return;
    }

    const ticketNo = 'PK-' + Math.floor(100000 + Math.random() * 900000);
    const sessionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const entryTime = new Date().toISOString();
    const operatorId = window.auth.currentUser ? window.auth.currentUser.id : 'usr_admin';

    const newSession = {
      id: sessionId,
      ticket_no: ticketNo,
      plate_number: plateNumber,
      vehicle_type_id: selectedVehicleType.id,
      entry_time: entryTime,
      exit_time: null,
      operator_entry_id: operatorId,
      operator_exit_id: null,
      rate_applied: selectedVehicleType.base_rate,
      total_amount: 0,
      discount_amount: 0,
      penalty_amount: 0,
      status: 'parked',
      qr_signature: 'sig_' + Math.random().toString(36).substring(2, 10),
      sync_status: 'pending',
      created_at: entryTime,
      updated_at: entryTime
    };

    await window.db.put('parking_sessions', newSession);
    await window.db.enqueueSync('parking_sessions', sessionId, 'INSERT', newSession);

    entryModal.classList.remove('active');
    await refreshDashboard();
    alert(`Vehicle Entry Logged!\nPlate: ${plateNumber}\nTicket: ${ticketNo}\nRate: ${selectedVehicleType.base_rate} PKR`);
  };

  // Exit Search and Calculation
  document.getElementById('btnSearchExit').onclick = async () => {
    const query = document.getElementById('exitTicketInput').value.trim().toUpperCase();
    if (!query) return;

    let session = null;
    const parked = await window.db.getCurrentlyParked();
    session = parked.find(s => s.ticket_no === query || s.plate_number === query);

    if (!session) {
      alert('No active parked vehicle found matching ticket or plate.');
      return;
    }

    const typeObj = vehicleTypesList.find(v => v.id === session.vehicle_type_id) || { name: 'Vehicle', base_rate: 50, hourly_rate: 30 };
    
    const entryDate = new Date(session.entry_time);
    const exitDate = new Date();
    const durationMins = Math.max(1, Math.round((exitDate - entryDate) / 60000));
    const durationHours = Math.ceil(durationMins / 60);

    // Calculate fee (Base rate + extra hours)
    let calculatedFee = typeObj.base_rate;
    if (durationHours > 1) {
      calculatedFee += (durationHours - 1) * typeObj.hourly_rate;
    }

    document.getElementById('exitDetailsBox').style.display = 'block';
    document.getElementById('exitDetailsBox').innerHTML = `
      <div style="background:var(--bg-card);padding:14px;border-radius:var(--radius-md);display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-muted);">Plate Number:</span>
          <span class="plate-pill">${session.plate_number}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-muted);">Ticket #:</span>
          <strong>${session.ticket_no}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-muted);">Vehicle Type:</span>
          <span>${typeObj.name}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--text-muted);">Duration:</span>
          <span>${durationMins} mins (${durationHours} hr)</span>
        </div>
        <hr style="border:none;border-top:1px solid var(--border-color);margin:4px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:16px;font-weight:700;">Total Fee:</span>
          <span style="font-size:22px;font-weight:800;color:var(--accent-success);">${calculatedFee} PKR</span>
        </div>
      </div>
    `;

    const confirmBtn = document.getElementById('btnConfirmExit');
    confirmBtn.style.display = 'block';
    confirmBtn.onclick = async () => {
      const operatorId = window.auth.currentUser ? window.auth.currentUser.id : 'usr_admin';
      session.exit_time = exitDate.toISOString();
      session.operator_exit_id = operatorId;
      session.total_amount = calculatedFee;
      session.status = 'completed';
      session.sync_status = 'pending';
      session.updated_at = exitDate.toISOString();

      await window.db.put('parking_sessions', session);
      await window.db.enqueueSync('parking_sessions', session.id, 'UPDATE', session);

      exitModal.classList.remove('active');
      await refreshDashboard();
      alert(`Payment Settled!\nCollected: ${calculatedFee} PKR\nGate opened.`);
    };
  };
}
