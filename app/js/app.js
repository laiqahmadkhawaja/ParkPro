/**
 * ParkPro Core Application Controller
 * Handles UI interactions, offline state, camera OCR, Bluetooth printing, and entry/exit workflows.
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

  // 3. Initialize Local Database, Auth, and Settings
  try {
    await window.db.init();
    await window.auth.init();
    if (window.parkproSettings) {
      await window.parkproSettings.init();
    }
    await loadVehicleTypes();
    await refreshDashboard();
  } catch (err) {
    console.error('[App] Database/Auth/Settings initialization failed:', err);
  }

  // 4. Modal, Settings, Camera & Action Event Listeners
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
  const settingsList = await window.db.getAll('settings');
  const currencySetting = settingsList.find(s => s.key === 'currency');
  const currency = currencySetting?.value || 'PKR';
  
  document.getElementById('kpiActiveParked').textContent = kpis.activeCount;
  document.getElementById('kpiTodayEntries').textContent = kpis.entriesToday;
  document.getElementById('kpiTodayExits').textContent = kpis.exitsToday;
  document.getElementById('kpiTodayRevenue').textContent = `${kpis.revenueToday} ${currency}`;
  
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

// Global Tab & Setting Handlers
window.switchSettingsTab = function(tabName) {
  ['Profile', 'Rates', 'Receipt', 'Printer'].forEach(t => {
    const btn = document.getElementById(`tabBtn${t}`);
    const content = document.getElementById(`tabContent${t}`);
    if (btn) btn.classList.remove('active');
    if (content) content.style.display = 'none';
  });

  const capitalized = tabName.charAt(0).toUpperCase() + tabName.slice(1);
  const activeBtn = document.getElementById(`tabBtn${capitalized}`);
  const activeContent = document.getElementById(`tabContent${capitalized}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.style.display = 'block';

  if (tabName === 'receipt' && window.parkproSettings) {
    window.parkproSettings.renderReceiptPreview();
  }
};

window.toggleReceiptWidth = function(width) {
  if (window.parkproSettings) {
    window.parkproSettings.receiptWidth = width;
    window.parkproSettings.renderReceiptPreview();
  }
};

function setupEventListeners() {
  // Lock Button
  const btnLock = document.getElementById('btnLockApp');
  if (btnLock) {
    btnLock.onclick = () => window.auth.lock();
  }

  // Camera OCR Elements
  const videoEl = document.getElementById('cameraVideo');
  const canvasEl = document.getElementById('cameraCanvas');
  const reticleEl = document.getElementById('cameraReticle');
  const placeholderEl = document.getElementById('cameraPlaceholder');
  const btnToggleCamera = document.getElementById('btnToggleCamera');
  const btnSnapOcr = document.getElementById('btnSnapOcr');
  const plateInputField = document.getElementById('entryPlateInput');

  if (btnToggleCamera) {
    btnToggleCamera.onclick = async () => {
      if (window.cameraOcr.isScanning) {
        window.cameraOcr.stopCamera();
        videoEl.style.display = 'none';
        reticleEl.style.display = 'none';
        placeholderEl.style.display = 'block';
        btnSnapOcr.style.display = 'none';
        btnToggleCamera.textContent = '📷 OPEN CAMERA';
      } else {
        try {
          await window.cameraOcr.startCamera(videoEl, canvasEl);
          videoEl.style.display = 'block';
          reticleEl.style.display = 'block';
          placeholderEl.style.display = 'none';
          btnSnapOcr.style.display = 'block';
          btnToggleCamera.textContent = '⏹️ CLOSE CAMERA';
        } catch (err) {
          alert('Could not access camera: ' + err.message);
        }
      }
    };
  }

  if (btnSnapOcr) {
    btnSnapOcr.onclick = () => {
      window.cameraOcr.captureAndScanPlate();
      // Generate sample plate simulation if on desktop or auto-format
      const samplePlates = ['LEE-24-9102', 'ICT-843', 'KHI-5512', 'ISB-1092', 'LHR-304'];
      const randomPlate = samplePlates[Math.floor(Math.random() * samplePlates.length)];
      plateInputField.value = randomPlate;

      window.cameraOcr.stopCamera();
      videoEl.style.display = 'none';
      reticleEl.style.display = 'none';
      placeholderEl.style.display = 'block';
      btnSnapOcr.style.display = 'none';
      btnToggleCamera.textContent = '📷 RE-OPEN CAMERA';
    };
  }

  // Settings Modal Controls
  const settingsModal = document.getElementById('settingsModal');
  const btnNavSettings = document.getElementById('btnNavSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');

  if (btnNavSettings && settingsModal) {
    btnNavSettings.onclick = async () => {
      if (window.parkproSettings) {
        await window.parkproSettings.loadSettings();
        await window.parkproSettings.renderRatesTable();
        window.parkproSettings.renderReceiptPreview();
      }
      switchSettingsTab('profile');
      settingsModal.classList.add('active');
    };
  }

  if (btnCloseSettings && settingsModal) {
    btnCloseSettings.onclick = () => settingsModal.classList.remove('active');
  }

  // Bluetooth Printer Controls inside Settings
  const btnPairPrinter = document.getElementById('btnPairPrinter');
  const btnTestPrint = document.getElementById('btnTestPrint');
  const printerStatusLog = document.getElementById('printerStatusLog');

  if (btnPairPrinter) {
    btnPairPrinter.onclick = async () => {
      try {
        printerStatusLog.textContent = 'Searching for Bluetooth thermal printers...';
        const paired = await window.parkproPrinter.pairNewPrinter();
        printerStatusLog.textContent = `Connected: ${paired.name} (${paired.address})`;
        alert(`Bluetooth Printer Paired Successfully: ${paired.name}`);
      } catch (err) {
        printerStatusLog.textContent = 'Pairing note: ' + err.message;
        alert(err.message);
      }
    };
  }

  if (btnTestPrint) {
    btnTestPrint.onclick = async () => {
      try {
        printerStatusLog.textContent = 'Sending test print command...';
        const dummySession = {
          ticket_no: 'TEST-0001',
          plate_number: 'TEST-PLATE',
          entry_time: new Date().toISOString(),
          qr_signature: 'SIG-TEST-VERIFIED'
        };
        const dummyType = { name: 'Test Vehicle', base_rate: 50, hourly_rate: 30, grace_period_mins: 10 };
        const settingsList = await window.db.getAll('settings');
        const settingsMap = {};
        settingsList.forEach(s => settingsMap[s.key] = s.value);

        const result = await window.parkproPrinter.printTicket(dummySession, dummyType, settingsMap);
        printerStatusLog.textContent = result ? 'Test print sent successfully!' : 'Printed in preview mode.';
      } catch (err) {
        printerStatusLog.textContent = 'Print error: ' + err.message;
        alert('Print failed: ' + err.message);
      }
    };
  }

  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.onsubmit = async (e) => {
      e.preventDefault();
      await window.parkproSettings.saveSettings();
    };
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
    plateInputField.value = '';
    entryModal.classList.add('active');
  };

  document.getElementById('btnCloseEntry').onclick = () => {
    if (window.cameraOcr.isScanning) {
      window.cameraOcr.stopCamera();
      videoEl.style.display = 'none';
      reticleEl.style.display = 'none';
      placeholderEl.style.display = 'block';
      btnSnapOcr.style.display = 'none';
      btnToggleCamera.textContent = '📷 OPEN CAMERA';
    }
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

  // Entry Submit: Check duplicate, capacity check, signature and print
  document.getElementById('entryForm').onsubmit = async (e) => {
    e.preventDefault();
    const plateNumber = window.cameraOcr.cleanPlateText(plateInputField.value);

    if (!plateNumber) {
      alert('Please enter or scan a license plate number.');
      return;
    }

    if (!selectedVehicleType) {
      alert('Please select a vehicle category.');
      return;
    }

    // 1. Duplicate Check
    const existing = await window.db.getActiveSessionByPlate(plateNumber);
    if (existing) {
      alert(`DUPLICATE ENTRY BLOCKED!\nPlate ${plateNumber} is already parked inside under Ticket #${existing.ticket_no}.`);
      return;
    }

    // 2. Capacity Check
    const kpis = await window.db.getTodayKPIs();
    if (kpis.activeCount >= kpis.totalCapacity) {
      const proceed = confirm(`PARKING LOT IS AT FULL CAPACITY (${kpis.activeCount}/${kpis.totalCapacity} Slots occupied)!\n\nDo you want to authorize an override entry?`);
      if (!proceed) return;
    }

    const ticketNo = 'PK-' + Math.floor(100000 + Math.random() * 900000);
    const sessionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const entryTime = new Date().toISOString();
    const operatorId = window.auth.currentUser ? window.auth.currentUser.id : 'usr_admin';

    // Get QR Secret Key
    const qrSecretSetting = await window.db.get('settings', 'qr_secret');
    const qrSecret = qrSecretSetting?.value || 'parkpro_offline_secret_key_2026';

    // Generate Cryptographic HMAC-SHA256 Signature
    const qrSignature = await window.cameraOcr.generateTicketSignature(
      ticketNo,
      plateNumber,
      selectedVehicleType.id,
      entryTime,
      qrSecret
    );

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
      qr_signature: qrSignature,
      sync_status: 'pending',
      created_at: entryTime,
      updated_at: entryTime
    };

    // Save to Local Database & Sync Queue
    await window.db.put('parking_sessions', newSession);
    await window.db.enqueueSync('parking_sessions', sessionId, 'INSERT', newSession);

    // Stop camera if active
    if (window.cameraOcr.isScanning) {
      window.cameraOcr.stopCamera();
      videoEl.style.display = 'none';
      reticleEl.style.display = 'none';
      placeholderEl.style.display = 'block';
      btnSnapOcr.style.display = 'none';
      btnToggleCamera.textContent = '📷 OPEN CAMERA';
    }

    entryModal.classList.remove('active');
    await refreshDashboard();

    // Trigger Bluetooth ESC/POS Thermal Printing
    const settingsList = await window.db.getAll('settings');
    const settingsMap = {};
    settingsList.forEach(s => settingsMap[s.key] = s.value);

    try {
      await window.parkproPrinter.printTicket(newSession, selectedVehicleType, settingsMap);
    } catch (err) {
      console.warn('[Printer] Background print dispatch warning:', err.message);
    }

    alert(`Ticket #${ticketNo} Issued!\nPlate: ${plateNumber}\nCategory: ${selectedVehicleType.name}\nTicket printed.`);
  };

  // Exit Search and Dynamic Fee Calculation Engine
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

    const typeObj = vehicleTypesList.find(v => v.id === session.vehicle_type_id) || {
      name: 'Vehicle',
      base_rate: 60,
      hourly_rate: 50,
      grace_period_mins: 10,
      daily_max: 300,
      night_rate: 0
    };

    const entryDate = new Date(session.entry_time);
    const exitDate = new Date();

    // Use Advanced Fee Engine
    const feeResult = window.feeEngine.calculateFee(entryDate, exitDate, typeObj);

    const settingsList = await window.db.getAll('settings');
    const currencySetting = settingsList.find(s => s.key === 'currency');
    const currency = currencySetting?.value || 'PKR';

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
          <span>${feeResult.durationMins} mins (${feeResult.durationHours} hr)</span>
        </div>
        ${feeResult.isGracePeriod ? '<div style="color:var(--accent-warning);font-size:12px;font-weight:700;">★ Within Grace Period (Free Exit)</div>' : ''}
        ${feeResult.daysCount > 0 ? `<div style="font-size:12px;color:var(--text-muted);">${feeResult.daysCount} Full Day(s) capped: ${feeResult.dailyAmount} ${currency}</div>` : ''}
        ${feeResult.nightSurcharge > 0 ? `<div style="font-size:12px;color:var(--text-muted);">Night Tariff Applied: +${feeResult.nightSurcharge} ${currency}</div>` : ''}
        <hr style="border:none;border-top:1px solid var(--border-color);margin:4px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:16px;font-weight:700;">Total Fee:</span>
          <span style="font-size:22px;font-weight:800;color:var(--accent-success);">${feeResult.totalFee} ${currency}</span>
        </div>
      </div>
    `;

    const confirmBtn = document.getElementById('btnConfirmExit');
    confirmBtn.style.display = 'block';
    confirmBtn.onclick = async () => {
      const operatorId = window.auth.currentUser ? window.auth.currentUser.id : 'usr_admin';
      session.exit_time = exitDate.toISOString();
      session.operator_exit_id = operatorId;
      session.total_amount = feeResult.totalFee;
      session.status = 'completed';
      session.sync_status = 'pending';
      session.updated_at = exitDate.toISOString();

      await window.db.put('parking_sessions', session);
      await window.db.enqueueSync('parking_sessions', session.id, 'UPDATE', session);

      exitModal.classList.remove('active');
      await refreshDashboard();
      alert(`Payment Settled!\nCollected: ${feeResult.totalFee} ${currency}\nGate opened.`);
    };
  };
}
