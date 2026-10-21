/**
 * ParkPro Local Database Engine (IndexedDB)
 * High-performance transactional client-side storage for 10,000+ offline records.
 */

const DB_NAME = 'ParkProDB';
const DB_VERSION = 1;

class ParkProDB {
  constructor() {
    this.db = null;
  }

  // Helper: SHA-256 hash for PIN and passwords
  async hash(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Initialize and run migrations
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Users Store
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
        }

        // 2. Vehicle Types Store
        if (!db.objectStoreNames.contains('vehicle_types')) {
          db.createObjectStore('vehicle_types', { keyPath: 'id' });
        }

        // 3. Parking Sessions Store
        if (!db.objectStoreNames.contains('parking_sessions')) {
          const sessionStore = db.createObjectStore('parking_sessions', { keyPath: 'id' });
          sessionStore.createIndex('plate_number', 'plate_number', { unique: false });
          sessionStore.createIndex('status', 'status', { unique: false });
          sessionStore.createIndex('ticket_no', 'ticket_no', { unique: true });
          sessionStore.createIndex('entry_time', 'entry_time', { unique: false });
        }

        // 4. Shifts Store
        if (!db.objectStoreNames.contains('shifts')) {
          const shiftStore = db.createObjectStore('shifts', { keyPath: 'id' });
          shiftStore.createIndex('status', 'status', { unique: false });
        }

        // 5. Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 6. Sync Queue Store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('status', 'status', { unique: false });
        }

        // 7. Audit Logs Store
        if (!db.objectStoreNames.contains('audit_logs')) {
          db.createObjectStore('audit_logs', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        console.log('[Database] IndexedDB connection established');
        await this.seedDefaults();
        resolve(this);
      };

      request.onerror = (event) => {
        console.error('[Database] Failed to open IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Seed default admin and vehicle types if empty
  async seedDefaults() {
    const userCount = await this.count('users');
    if (userCount === 0) {
      console.log('[Database] Seeding default administrator & vehicle types');
      const defaultPinHash = await this.hash('1234');
      const defaultPasswordHash = await this.hash('admin123');

      // Admin user
      await this.put('users', {
        id: 'usr_admin',
        username: 'admin',
        name: 'Master Admin',
        pin_hash: defaultPinHash,
        password_hash: defaultPasswordHash,
        role: 'Admin',
        status: 'active',
        created_at: new Date().toISOString()
      });

      // Default Vehicle Types
      const defaultTypes = [
        { id: 'vt_bike', name: 'Bike', icon: '🏍️', base_rate: 30, hourly_rate: 20, grace_period_mins: 10, daily_max: 150, night_rate: 40 },
        { id: 'vt_rickshaw', name: 'Rickshaw', icon: '🛺', base_rate: 40, hourly_rate: 30, grace_period_mins: 10, daily_max: 200, night_rate: 50 },
        { id: 'vt_car', name: 'Car', icon: '🚗', base_rate: 60, hourly_rate: 50, grace_period_mins: 10, daily_max: 300, night_rate: 80 },
        { id: 'vt_van', name: 'Van / SUV', icon: '🚐', base_rate: 80, hourly_rate: 70, grace_period_mins: 10, daily_max: 450, night_rate: 100 },
        { id: 'vt_truck', name: 'Truck / Bus', icon: '🚚', base_rate: 150, hourly_rate: 100, grace_period_mins: 15, daily_max: 800, night_rate: 200 }
      ];

      for (const vt of defaultTypes) {
        await this.put('vehicle_types', vt);
      }

      // Default Lot Settings
      const defaultSettings = [
        { key: 'lot_name', value: 'ParkPro Central Parking' },
        { key: 'lot_address', value: 'Main Commercial Hub, Gate #1' },
        { key: 'phone', value: '+92-300-1234567' },
        { key: 'currency', value: 'PKR' },
        { key: 'printer_width', value: '58' },
        { key: 'capacity', value: '100' },
        { key: 'receipt_footer', value: 'Thank you for parking with ParkPro. Park at own risk.' },
        { key: 'qr_secret', value: 'parkpro_offline_secret_key_2026' }
      ];

      for (const s of defaultSettings) {
        await this.put('settings', s);
      }
    }
  }

  // Generic Transactional Operations
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Business Logic Queries
  async getActiveSessionByPlate(plateNumber) {
    const formattedPlate = plateNumber.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('parking_sessions', 'readonly');
      const store = tx.objectStore('parking_sessions');
      const index = store.index('plate_number');
      const req = index.getAll(formattedPlate);

      req.onsuccess = () => {
        const active = (req.result || []).find(s => s.status === 'parked');
        resolve(active || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getCurrentlyParked() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('parking_sessions', 'readonly');
      const store = tx.objectStore('parking_sessions');
      const index = store.index('status');
      const req = index.getAll('parked');

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getTodayKPIs() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    const allSessions = await this.getAll('parking_sessions');
    const settings = await this.getAll('settings');
    const capSetting = settings.find(s => s.key === 'capacity');
    const totalCapacity = parseInt(capSetting?.value || '100', 10);

    let activeCount = 0;
    let entriesToday = 0;
    let exitsToday = 0;
    let revenueToday = 0;
    let totalDurationMs = 0;
    let durationCount = 0;

    for (const session of allSessions) {
      if (session.status === 'parked') {
        activeCount++;
      }
      if (session.entry_time >= startIso) {
        entriesToday++;
      }
      if (session.exit_time && session.exit_time >= startIso) {
        exitsToday++;
        revenueToday += (session.total_amount || 0);

        const dur = new Date(session.exit_time) - new Date(session.entry_time);
        if (dur > 0) {
          totalDurationMs += dur;
          durationCount++;
        }
      }
    }

    const avgDurationMins = durationCount > 0 ? Math.round(totalDurationMs / (durationCount * 60000)) : 0;
    const occupancyPercent = totalCapacity > 0 ? Math.min(100, Math.round((activeCount / totalCapacity) * 100)) : 0;

    return {
      activeCount,
      entriesToday,
      exitsToday,
      revenueToday,
      avgDurationMins,
      occupancyPercent,
      totalCapacity
    };
  }

  // Sync Queue Operation
  async enqueueSync(tableName, recordId, operation, payload) {
    const item = {
      table_name: tableName,
      record_id: recordId,
      operation: operation, // 'INSERT' | 'UPDATE' | 'DELETE'
      payload: JSON.stringify(payload),
      created_at: new Date().toISOString(),
      attempts: 0,
      status: 'pending'
    };
    return this.put('sync_queue', item);
  }
}

// Global database instance
window.db = new ParkProDB();
