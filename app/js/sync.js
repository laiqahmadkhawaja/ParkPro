/**
 * ParkPro Background Delta Sync Engine
 * Synchronizes local IndexedDB transactions with the central PHP 8 REST backend.
 */

class ParkProSync {
  constructor() {
    this.apiBase = '';
    this.isSyncing = false;
    this.lastSyncTimestamp = localStorage.getItem('parkpro_last_sync') || '1970-01-01T00:00:00Z';
    this.syncInterval = null;
  }

  async getApiBase() {
    try {
      const setting = await window.db.get('settings', 'server_url');
      if (setting && setting.value && setting.value.trim().length > 0) {
        return setting.value.trim().replace(/\/$/, '');
      }
    } catch (e) {}
    const local = localStorage.getItem('parkpro_server_url');
    if (local && local.trim().length > 0) {
      return local.trim().replace(/\/$/, '');
    }
    // Only default to relative path if served directly from a normal HTTP web server
    if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('androidplatform.net')) {
      return '../server-php/api';
    }
    return '';
  }

  init() {
    // Listen for online events to trigger immediate sync
    window.addEventListener('online', () => {
      console.log('[Sync] Network reconnected. Triggering sync flush.');
      this.syncNow();
    });

    // Auto-sync heartbeat every 30 seconds
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.syncNow();
      }
    }, 30000);
  }

  async checkServerHealth() {
    const apiBase = await this.getApiBase();
    if (!apiBase) {
      return false;
    }
    try {
      const resp = await fetch(`${apiBase}/health.php`, { method: 'GET' });
      if (resp.ok) {
        const json = await resp.json();
        return json.status === 'online';
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  /**
   * Main Sync Cycle: Push local queued changes, then pull server changes
   */
  async syncNow() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const isServerUp = await this.checkServerHealth();
      if (!isServerUp) {
        this.isSyncing = false;
        return;
      }

      await this.pushPendingQueue();
      await this.pullRemoteDelta();
    } catch (err) {
      console.warn('[Sync] Sync cycle interrupted:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  async pushPendingQueue() {
    const queueItems = await window.db.getAll('sync_queue');
    const pending = queueItems.filter(i => i.status === 'pending');

    if (pending.length === 0) return;

    console.log(`[Sync] Pushing ${pending.length} pending operations to server...`);

    const apiBase = await this.getApiBase();
    if (!apiBase) return;
    const resp = await fetch(`${apiBase}/sync.php?action=push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: pending })
    });

    if (resp.ok) {
      const result = await resp.json();
      if (result.success && result.processed_ids) {
        for (const id of result.processed_ids) {
          // Remove processed items from local sync queue
          await window.db.delete('sync_queue', id);
        }
        console.log(`[Sync] Successfully flushed ${result.processed} items.`);
      }
    }
  }

  async pullRemoteDelta() {
    const apiBase = await this.getApiBase();
    if (!apiBase) return;
    const resp = await fetch(`${apiBase}/sync.php?action=pull&since=${encodeURIComponent(this.lastSyncTimestamp)}`);
    if (!resp.ok) return;

    const result = await resp.json();
    if (result.success && result.sessions && result.sessions.length > 0) {
      console.log(`[Sync] Pulled ${result.sessions.length} remote session updates.`);
      for (const s of result.sessions) {
        // Upsert into local database
        const local = await window.db.get('parking_sessions', s.id);
        // Only update if server record is newer and no local pending edits
        if (!local || (s.updated_at >= (local.updated_at || ''))) {
          await window.db.put('parking_sessions', s);
        }
      }

      this.lastSyncTimestamp = result.server_time || new Date().toISOString();
      localStorage.setItem('parkpro_last_sync', this.lastSyncTimestamp);

      // Refresh dashboard if visible
      if (typeof refreshDashboard === 'function') refreshDashboard();
    }
  }
}

// Global Sync Engine Instance
window.parkproSync = new ParkProSync();
