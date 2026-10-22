/**
 * ParkPro Settings & Receipt Simulator Controller
 * Manages lot settings, vehicle rates configuration, and live receipt rendering.
 */

class ParkProSettings {
  constructor() {
    this.currentSettings = {};
    this.receiptWidth = '58'; // '58' or '80'
  }

  async init() {
    await this.loadSettings();
    this.renderRatesTable();
    this.renderReceiptPreview();
  }

  async loadSettings() {
    const list = await window.db.getAll('settings');
    this.currentSettings = {};
    list.forEach(item => {
      this.currentSettings[item.key] = item.value;
    });

    // Populate Settings Form Fields
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    setVal('settingLotName', this.currentSettings.lot_name || 'ParkPro Central');
    setVal('settingLotAddress', this.currentSettings.lot_address || 'Main Gate #1');
    setVal('settingLotPhone', this.currentSettings.phone || '+92-300-1234567');
    setVal('settingCurrency', this.currentSettings.currency || 'PKR');
    setVal('settingCapacity', this.currentSettings.capacity || '100');
    setVal('settingPrinterWidth', this.currentSettings.printer_width || '58');
    setVal('settingReceiptFooter', this.currentSettings.receipt_footer || 'Park at own risk. Keep ticket safe.');
    setVal('settingServerUrl', this.currentSettings.server_url || '');

    this.receiptWidth = this.currentSettings.printer_width || '58';
  }

  async saveSettings() {
    const getVal = (id) => document.getElementById(id)?.value.trim() || '';

    const newSettings = [
      { key: 'lot_name', value: getVal('settingLotName') },
      { key: 'lot_address', value: getVal('settingLotAddress') },
      { key: 'phone', value: getVal('settingLotPhone') },
      { key: 'currency', value: getVal('settingCurrency') },
      { key: 'capacity', value: getVal('settingCapacity') },
      { key: 'printer_width', value: getVal('settingPrinterWidth') },
      { key: 'receipt_footer', value: getVal('settingReceiptFooter') },
      { key: 'server_url', value: getVal('settingServerUrl') }
    ];

    for (const s of newSettings) {
      await window.db.put('settings', s);
      this.currentSettings[s.key] = s.value;
    }

    this.receiptWidth = this.currentSettings.printer_width || '58';
    this.renderReceiptPreview();
    if (typeof refreshDashboard === 'function') refreshDashboard();

    alert('Settings Saved Successfully!');
  }

  async renderRatesTable() {
    const ratesContainer = document.getElementById('ratesTableContainer');
    if (!ratesContainer) return;

    const types = await window.db.getAll('vehicle_types');
    const currency = this.currentSettings.currency || 'PKR';

    ratesContainer.innerHTML = types.map(t => `
      <div class="rate-config-card" data-type-id="${t.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong style="font-size:16px;">${t.icon} ${t.name}</strong>
          <span style="font-size:11px;color:var(--text-muted);">Grace: ${t.grace_period_mins}m</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
          <div>Base (1st hr): <strong>${t.base_rate} ${currency}</strong></div>
          <div>Hourly: <strong>${t.hourly_rate} ${currency}</strong></div>
          <div>Daily Cap: <strong>${t.daily_max || 'No cap'} ${currency}</strong></div>
          <div>Night Rate: <strong>${t.night_rate || 0} ${currency}</strong></div>
        </div>
      </div>
    `).join('');
  }

  renderReceiptPreview() {
    const previewBox = document.getElementById('receiptPreviewContent');
    if (!previewBox) return;

    const lotName = this.currentSettings.lot_name || 'ParkPro Central Parking';
    const address = this.currentSettings.lot_address || 'Main Boulevard, Gate #1';
    const phone = this.currentSettings.phone || '0300-1234567';
    const footer = this.currentSettings.receipt_footer || 'Thank you for parking with ParkPro.';
    const currency = this.currentSettings.currency || 'PKR';
    const is80mm = this.receiptWidth === '80';

    previewBox.className = `receipt-paper ${is80mm ? 'width-80mm' : 'width-58mm'}`;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    previewBox.innerHTML = `
      <div class="receipt-header-center">
        <div class="receipt-lot-title">${lotName}</div>
        <div>${address}</div>
        <div>Tel: ${phone}</div>
      </div>

      <div class="receipt-divider">--------------------------------</div>

      <div class="receipt-center">
        <div style="font-size:10px;text-transform:uppercase;color:#475569;">VEHICLE LICENSE PLATE</div>
        <div class="receipt-plate-bold">ABC-1234</div>
      </div>

      <div class="receipt-divider">--------------------------------</div>

      <div class="receipt-row">
        <span>TICKET NO:</span>
        <strong>PK-839201</strong>
      </div>
      <div class="receipt-row">
        <span>CATEGORY:</span>
        <span>CAR (🚗)</span>
      </div>
      <div class="receipt-row">
        <span>ENTRY TIME:</span>
        <span>${dateFormatted} ${timeFormatted}</span>
      </div>
      <div class="receipt-row">
        <span>BASE RATE:</span>
        <span>60 ${currency} / 1st hr</span>
      </div>
      <div class="receipt-row">
        <span>HOURLY:</span>
        <span>50 ${currency} / hr</span>
      </div>

      <div class="receipt-divider">--------------------------------</div>

      <div class="receipt-qr-box">
        <div class="receipt-qr-mock">
          <div style="font-size:24px;">🏁</div>
          <div style="font-size:9px;font-family:monospace;margin-top:2px;">[SECURE QR CODE]</div>
        </div>
        <div style="font-size:9px;color:#64748b;margin-top:4px;">Scan at exit for automatic checkout</div>
      </div>

      <div class="receipt-divider">--------------------------------</div>

      <div class="receipt-footer-center">
        <div>${footer}</div>
        <div style="margin-top:4px;font-size:9px;color:#94a3b8;">ParkPro Offline System v1.0</div>
      </div>
    `;
  }
}

// Global Settings Instance
window.parkproSettings = new ParkProSettings();
