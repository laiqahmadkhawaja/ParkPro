/**
 * ParkPro Benchmark & Stress Test Script
 * Seeds 1,000 realistic parking transactions into IndexedDB to measure query throughput.
 */

async function runParkProStressTest() {
  console.log('--- STARTING PARKPRO STRESS TEST (1,000 SESSIONS) ---');
  const startTime = performance.now();
  const vehicleTypes = ['vt_bike', 'vt_car', 'vt_rickshaw', 'vt_van', 'vt_truck'];
  const baseTime = Date.now() - (7 * 24 * 3600 * 1000); // Past 7 days

  const tx = window.db.db.transaction(['parking_sessions'], 'readwrite');
  const store = tx.objectStore('parking_sessions');

  for (let i = 0; i < 1000; i++) {
    const isCompleted = i % 4 !== 0; // 75% completed, 25% parked
    const entryTime = new Date(baseTime + (i * 600000)).toISOString();
    const exitTime = isCompleted ? new Date(baseTime + (i * 600000) + 7200000).toISOString() : null;
    const vType = vehicleTypes[i % vehicleTypes.length];
    const ticketNo = `PK-${100000 + i}`;
    const plate = `TST-${1000 + i}`;

    const session = {
      id: `ses_stress_${i}`,
      ticket_no: ticketNo,
      plate_number: plate,
      vehicle_type_id: vType,
      entry_time: entryTime,
      exit_time: exitTime,
      operator_entry_id: 'usr_admin',
      operator_exit_id: isCompleted ? 'usr_admin' : null,
      rate_applied: 50,
      total_amount: isCompleted ? 100 : 0,
      discount_amount: 0,
      penalty_amount: 0,
      status: isCompleted ? 'completed' : 'parked',
      qr_signature: `SIG-STR-${i}`,
      sync_status: 'synced',
      created_at: entryTime,
      updated_at: exitTime || entryTime
    };

    store.put(session);
  }

  await new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });

  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`[Stress Test] 1,000 sessions inserted in ${duration} ms (${(1000 / (duration / 1000)).toFixed(0)} ops/sec).`);

  // Measure KPI query throughput
  const queryStart = performance.now();
  const kpis = await window.db.getTodayKPIs();
  const queryDuration = (performance.now() - queryStart).toFixed(2);
  console.log(`[Stress Test] KPI Aggregation over 1,000+ records finished in ${queryDuration} ms.`);
  console.log('[Stress Test] KPIs calculated:', kpis);

  alert(`Stress Test Passed!\n1,000 records seeded in ${duration} ms.\nKPI calculation took ${queryDuration} ms.`);
}

window.runParkProStressTest = runParkProStressTest;
