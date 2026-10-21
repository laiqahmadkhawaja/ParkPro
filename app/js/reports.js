/**
 * ParkPro Analytics, Reporting, Shift & Backup Controller
 * Financial analytics, CSV/Excel export, Shift Cash Reconciliation, and DB Backup/Restore.
 */

class ParkProReports {
  constructor() {
    this.selectedRange = 'today'; // 'today' | 'yesterday' | 'week' | 'all'
    this.activeShift = null;
  }

  async init() {
    await this.checkActiveShift();
    await this.renderReports();
    await this.renderAuditLogs();
  }

  // --- Date Range Filtering & Analytics ---
  async getSessionsInRange(range = this.selectedRange) {
    const all = await window.db.getAll('parking_sessions');
    const now = new Date();
    let startDate = new Date();

    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      return all.filter(s => s.entry_time >= startDate.toISOString() && s.entry_time <= endDate.toISOString());
    } else if (range === 'week') {
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else {
      return all;
    }

    return all.filter(s => s.entry_time >= startDate.toISOString());
  }

  async calculateFinancialMetrics(range = this.selectedRange) {
    const sessions = await this.getSessionsInRange(range);
    const vehicleTypes = await window.db.getAll('vehicle_types');

    let totalRevenue = 0;
    let completedCount = 0;
    let totalDurationMs = 0;
    let durationCount = 0;

    const typeBreakdown = {};
    vehicleTypes.forEach(vt => {
      typeBreakdown[vt.id] = { name: vt.name, icon: vt.icon, count: 0, revenue: 0 };
    });

    sessions.forEach(s => {
      if (s.status === 'completed') {
        completedCount++;
        totalRevenue += (s.total_amount || 0);

        if (s.exit_time && s.entry_time) {
          const dur = new Date(s.exit_time) - new Date(s.entry_time);
          if (dur > 0) {
            totalDurationMs += dur;
            durationCount++;
          }
        }

        if (typeBreakdown[s.vehicle_type_id]) {
          typeBreakdown[s.vehicle_type_id].count++;
          typeBreakdown[s.vehicle_type_id].revenue += (s.total_amount || 0);
        }
      }
    });

    const avgDurationMins = durationCount > 0 ? Math.round(totalDurationMs / (durationCount * 60000)) : 0;

    return {
      totalRevenue,
      completedCount,
      totalSessions: sessions.length,
      avgDurationMins,
      typeBreakdown
    };
  }

  async renderReports() {
    const metrics = await this.calculateFinancialMetrics(this.selectedRange);
    const settingsList = await window.db.getAll('settings');
    const currency = settingsList.find(s => s.key === 'currency')?.value || 'PKR';

    const revEl = document.getElementById('reportTotalRevenue');
    const countEl = document.getElementById('reportTotalCompleted');
    const durEl = document.getElementById('reportAvgDuration');
    const tableEl = document.getElementById('reportTypeTable');

    if (revEl) revEl.textContent = `${metrics.totalRevenue} ${currency}`;
    if (countEl) countEl.textContent = metrics.completedCount;
    if (durEl) durEl.textContent = `${metrics.avgDurationMins} mins`;

    if (tableEl) {
      let rows = '';
      for (const id in metrics.typeBreakdown) {
        const item = metrics.typeBreakdown[id];
        rows += `
          <div class="rate-config-card" style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-size:18px;">${item.icon}</span>
              <strong>${item.name}</strong>
              <div style="font-size:11px;color:var(--text-muted);">${item.count} Exits completed</div>
            </div>
            <div style="font-size:16px;font-weight:800;color:var(--accent-success);">
              ${item.revenue} ${currency}
            </div>
          </div>
        `;
      }
      tableEl.innerHTML = rows;
    }
  }

  // --- Export Spreadsheets ---
  async exportToCsv() {
    const sessions = await this.getSessionsInRange(this.selectedRange);
    const vehicleTypes = await window.db.getAll('vehicle_types');
    const typeMap = {};
    vehicleTypes.forEach(t => typeMap[t.id] = t.name);

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'Ticket No,Plate Number,Vehicle Category,Entry Time,Exit Time,Status,Total Amount,Penalty,Signature\r\n';

    sessions.forEach(s => {
      const typeName = typeMap[s.vehicle_type_id] || 'Unknown';
      const row = [
        `"${s.ticket_no || ''}"`,
        `"${s.plate_number || ''}"`,
        `"${typeName}"`,
        `"${s.entry_time || ''}"`,
        `"${s.exit_time || ''}"`,
        `"${s.status || ''}"`,
        s.total_amount || 0,
        s.penalty_amount || 0,
        `"${s.qr_signature || ''}"`
      ];
      csvContent += row.join(',') + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ParkPro_Report_${this.selectedRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async exportToExcel() {
    const sessions = await this.getSessionsInRange(this.selectedRange);
    const vehicleTypes = await window.db.getAll('vehicle_types');
    const typeMap = {};
    vehicleTypes.forEach(t => typeMap[t.id] = t.name);

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"></head>
      <body>
      <table border="1">
        <tr style="background:#1e293b;color:#fff;font-weight:bold;">
          <th>Ticket No</th><th>Plate</th><th>Category</th><th>Entry Time</th><th>Exit Time</th><th>Status</th><th>Fee</th><th>Penalty</th>
        </tr>
    `;

    sessions.forEach(s => {
      html += `
        <tr>
          <td>${s.ticket_no}</td>
          <td>${s.plate_number}</td>
          <td>${typeMap[s.vehicle_type_id] || ''}</td>
          <td>${s.entry_time}</td>
          <td>${s.exit_time || '-'}</td>
          <td>${s.status}</td>
          <td>${s.total_amount || 0}</td>
          <td>${s.penalty_amount || 0}</td>
        </tr>
      `;
    });

    html += `</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ParkPro_Report_${Date.now()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Shift Management & Cash Drawer Reconciliation ---
  async checkActiveShift() {
    const shifts = await window.db.getAll('shifts');
    const openShift = shifts.find(s => s.status === 'open');
    this.activeShift = openShift || null;
    this.updateShiftUI();
  }

  updateShiftUI() {
    const shiftBox = document.getElementById('shiftStatusBox');
    if (!shiftBox) return;

    if (this.activeShift) {
      const startTime = new Date(this.activeShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      shiftBox.innerHTML = `
        <div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);border-radius:var(--radius-md);padding:14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;font-weight:800;color:var(--accent-success);">● SHIFT ACTIVE (Since ${startTime})</div>
            <div style="font-size:13px;margin-top:2px;">Starting Float: <strong>${this.activeShift.starting_float} PKR</strong></div>
          </div>
          <button type="button" class="btn-mini-action" style="background:#b91c1c;color:#fff;padding:8px 14px;" onclick="window.parkproReports.promptCloseShift()">CLOSE SHIFT</button>
        </div>
      `;
    } else {
      shiftBox.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;font-weight:800;color:var(--text-muted);">NO ACTIVE SHIFT OPEN</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Open shift with starting drawer float</div>
          </div>
          <button type="button" class="btn-mini-action accent" style="padding:8px 14px;" onclick="window.parkproReports.promptOpenShift()">OPEN SHIFT</button>
        </div>
      `;
    }
  }

  async promptOpenShift() {
    const floatStr = prompt('START NEW SHIFT\nEnter starting cash drawer float (PKR):', '2000');
    if (floatStr === null) return;
    const floatAmount = parseFloat(floatStr) || 0;

    const newShift = {
      id: 'shf_' + Date.now(),
      operator_id: window.auth.currentUser?.id || 'usr_admin',
      start_time: new Date().toISOString(),
      end_time: null,
      starting_float: floatAmount,
      total_cash_collected: 0,
      expected_cash: 0,
      actual_cash: 0,
      discrepancy: 0,
      status: 'open',
      notes: ''
    };

    await window.db.put('shifts', newShift);
    await window.db.enqueueSync('shifts', newShift.id, 'INSERT', newShift);
    this.activeShift = newShift;
    this.updateShiftUI();
    alert(`Shift opened successfully with ${floatAmount} PKR float.`);
  }

  async promptCloseShift() {
    if (!this.activeShift) return;

    // Calculate cash collected during this shift
    const allSessions = await window.db.getAll('parking_sessions');
    let collectedDuringShift = 0;
    allSessions.forEach(s => {
      if (s.status === 'completed' && s.exit_time >= this.activeShift.start_time) {
        collectedDuringShift += (s.total_amount || 0);
      }
    });

    const expectedCash = this.activeShift.starting_float + collectedDuringShift;
    const countedStr = prompt(`CLOSE SHIFT & CASH RECONCILIATION\n\nStarting Float: ${this.activeShift.starting_float} PKR\nCash Collected: ${collectedDuringShift} PKR\nExpected in Drawer: ${expectedCash} PKR\n\nEnter counted physical cash in drawer:`, expectedCash.toString());
    
    if (countedStr === null) return;
    const countedCash = parseFloat(countedStr) || 0;
    const discrepancy = countedCash - expectedCash;

    this.activeShift.end_time = new Date().toISOString();
    this.activeShift.total_cash_collected = collectedDuringShift;
    this.activeShift.expected_cash = expectedCash;
    this.activeShift.actual_cash = countedCash;
    this.activeShift.discrepancy = discrepancy;
    this.activeShift.status = 'closed';

    await window.db.put('shifts', this.activeShift);
    await window.db.enqueueSync('shifts', this.activeShift.id, 'UPDATE', this.activeShift);

    // Audit log
    await window.db.put('audit_logs', {
      user_id: window.auth.currentUser?.id || 'usr_admin',
      action: 'SHIFT_CLOSED_RECONCILED',
      details: `Shift closed. Expected: ${expectedCash}, Counted: ${countedCash}, Discrepancy: ${discrepancy}`,
      timestamp: new Date().toISOString()
    });

    const discMsg = discrepancy === 0 ? 'Drawer Balanced! (0 discrepancy)' : (discrepancy > 0 ? `Drawer OVER by +${discrepancy} PKR` : `Drawer SHORT by ${discrepancy} PKR`);
    alert(`DAILY Z-REPORT SUMMARY\n\nStarting Float: ${this.activeShift.starting_float} PKR\nCash Collected: ${collectedDuringShift} PKR\nCounted Cash: ${countedCash} PKR\n\n${discMsg}\n\nShift closed.`);

    this.activeShift = null;
    this.updateShiftUI();
  }

  // --- System Audit Logs ---
  async renderAuditLogs() {
    const listEl = document.getElementById('auditLogsList');
    if (!listEl) return;

    const logs = await window.db.getAll('audit_logs');
    if (logs.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:12px;text-align:center;">No audit records.</div>';
      return;
    }

    const recentLogs = [...logs].reverse().slice(0, 20);
    listEl.innerHTML = recentLogs.map(l => {
      const timeStr = new Date(l.timestamp).toLocaleString();
      return `
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:6px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;font-weight:700;">
            <span style="color:#60a5fa;">${l.action}</span>
            <span style="color:var(--text-muted);font-size:10px;">${timeStr}</span>
          </div>
          <div style="color:var(--text-muted);margin-top:2px;">${l.details || ''}</div>
        </div>
      `;
    }).join('');
  }

  // --- Full Database Backup & Restore ---
  async exportDatabaseBackup() {
    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      users: await window.db.getAll('users'),
      settings: await window.db.getAll('settings'),
      vehicle_types: await window.db.getAll('vehicle_types'),
      parking_sessions: await window.db.getAll('parking_sessions'),
      shifts: await window.db.getAll('shifts'),
      audit_logs: await window.db.getAll('audit_logs')
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ParkPro_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async importDatabaseBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.users || !data.settings || !data.parking_sessions) {
          throw new Error('Invalid backup file schema.');
        }

        for (const u of data.users) await window.db.put('users', u);
        for (const s of data.settings) await window.db.put('settings', s);
        for (const vt of (data.vehicle_types || [])) await window.db.put('vehicle_types', vt);
        for (const ps of (data.parking_sessions || [])) await window.db.put('parking_sessions', ps);
        for (const sh of (data.shifts || [])) await window.db.put('shifts', sh);

        alert('Database restored successfully from backup!');
        window.location.reload();
      } catch (err) {
        alert('Restore failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
}

// Global Reports Instance
window.parkproReports = new ParkProReports();
