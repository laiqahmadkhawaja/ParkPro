/**
 * ParkPro Authentication & RBAC Engine
 * Provides offline PIN authentication, session management, and role-based UI gating.
 */

class ParkProAuth {
  constructor() {
    this.currentUser = null;
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
    this.inactivityTimer = null;
    this.INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    this.pinBuffer = '';
    this.selectedUserId = null;
  }

  async init() {
    this.resetInactivityTimer();
    this.setupUserActivityListeners();

    // Check if first-run setup is required
    const setupCompleted = await window.db.get('settings', 'setup_completed');
    if (!setupCompleted || setupCompleted.value !== 'true') {
      this.showSetupWizard();
      return;
    }

    // Check if a session was previously active in sessionStorage
    const savedUserJson = sessionStorage.getItem('parkpro_current_user');
    if (savedUserJson) {
      try {
        const savedUser = JSON.parse(savedUserJson);
        const userInDb = await window.db.get('users', savedUser.id);
        if (userInDb && userInDb.status === 'active') {
          this.setCurrentUser(userInDb);
          return;
        }
      } catch (e) {
        sessionStorage.removeItem('parkpro_current_user');
      }
    }

    // Otherwise show PIN login
    this.showPinModal();
  }

  setupUserActivityListeners() {
    const reset = () => this.resetInactivityTimer();
    ['click', 'touchstart', 'keypress', 'mousemove'].forEach(evt => {
      window.addEventListener(evt, reset, { passive: true });
    });
  }

  resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.currentUser) {
      this.inactivityTimer = setTimeout(() => {
        console.log('[Auth] Inactivity timeout reached. Locking screen.');
        this.lock();
      }, this.INACTIVITY_TIMEOUT_MS);
    }
  }

  lock() {
    this.currentUser = null;
    sessionStorage.removeItem('parkpro_current_user');
    this.pinBuffer = '';
    this.applyRbac();
    this.showPinModal();
  }

  logout() {
    this.lock();
  }

  setCurrentUser(user) {
    this.currentUser = user;
    sessionStorage.setItem('parkpro_current_user', JSON.stringify({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    }));

    this.failedAttempts = 0;
    this.pinBuffer = '';
    this.hidePinModal();
    this.updateUserHeader();
    this.applyRbac();
    this.resetInactivityTimer();

    // Audit log
    window.db.put('audit_logs', {
      user_id: user.id,
      action: 'LOGIN',
      details: `User ${user.username} logged in with role ${user.role}`,
      timestamp: new Date().toISOString()
    });
  }

  updateUserHeader() {
    const userChip = document.getElementById('userProfileChip');
    const userNameSpan = document.getElementById('userNameHeader');
    const userRoleSpan = document.getElementById('userRoleHeader');

    if (this.currentUser && userChip) {
      userChip.style.display = 'inline-flex';
      userNameSpan.textContent = this.currentUser.name;
      userRoleSpan.textContent = this.currentUser.role.toUpperCase();
      userRoleSpan.className = `role-tag ${this.currentUser.role.toLowerCase()}`;
    } else if (userChip) {
      userChip.style.display = 'none';
    }
  }

  applyRbac() {
    const role = this.currentUser?.role || 'Guest';
    document.body.setAttribute('data-current-role', role);

    // Elements with data-role attribute define minimum role or allowed roles
    document.querySelectorAll('[data-allowed-roles]').forEach(el => {
      const allowed = el.getAttribute('data-allowed-roles').split(',').map(r => r.trim());
      if (allowed.includes(role)) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  }

  async verifyPin(userId, pin) {
    if (Date.now() < this.lockoutUntil) {
      const waitSeconds = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      throw new Error(`Too many failed attempts. Locked out for ${waitSeconds}s.`);
    }

    const user = await window.db.get('users', userId);
    if (!user || user.status !== 'active') {
      throw new Error('User not found or account deactivated.');
    }

    const enteredPinHash = await window.db.hash(pin);
    if (user.pin_hash === enteredPinHash) {
      this.failedAttempts = 0;
      this.setCurrentUser(user);
      return true;
    } else {
      this.failedAttempts++;
      if (this.failedAttempts >= 5) {
        this.lockoutUntil = Date.now() + 60 * 1000; // 60s lockout
        throw new Error('5 failed attempts. Device locked for 60 seconds.');
      }
      throw new Error(`Invalid PIN. (${5 - this.failedAttempts} attempts left)`);
    }
  }

  async showPinModal() {
    const modal = document.getElementById('pinLoginModal');
    if (!modal) return;

    modal.classList.add('active');
    this.pinBuffer = '';
    this.renderPinDots();

    // Render users grid for quick 1-tap user selection
    const users = await window.db.getAll('users');
    const userGrid = document.getElementById('pinUserSelector');
    if (userGrid) {
      userGrid.innerHTML = '';
      users.filter(u => u.status === 'active').forEach((u, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pin-user-btn ${idx === 0 ? 'selected' : ''}`;
        btn.innerHTML = `<span class="user-avatar">${u.name.charAt(0)}</span><span class="user-name">${u.name}</span><span class="user-role-badge">${u.role}</span>`;
        btn.onclick = () => {
          document.querySelectorAll('.pin-user-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.selectedUserId = u.id;
          this.pinBuffer = '';
          this.renderPinDots();
        };
        userGrid.appendChild(btn);
      });

      if (users.length > 0) {
        this.selectedUserId = users[0].id;
      }
    }
  }

  hidePinModal() {
    const modal = document.getElementById('pinLoginModal');
    if (modal) modal.classList.remove('active');
  }

  showSetupWizard() {
    const wizardModal = document.getElementById('setupWizardModal');
    if (wizardModal) {
      wizardModal.classList.add('active');
    }
  }

  hideSetupWizard() {
    const wizardModal = document.getElementById('setupWizardModal');
    if (wizardModal) {
      wizardModal.classList.remove('active');
    }
  }

  appendPinDigit(digit) {
    if (this.pinBuffer.length >= 4) return;
    this.pinBuffer += digit;
    this.renderPinDots();

    if (this.pinBuffer.length === 4) {
      // Auto-submit PIN upon 4th digit
      setTimeout(async () => {
        try {
          if (!this.selectedUserId) {
            alert('Please select a user first.');
            this.pinBuffer = '';
            this.renderPinDots();
            return;
          }
          await this.verifyPin(this.selectedUserId, this.pinBuffer);
        } catch (err) {
          alert(err.message);
          this.pinBuffer = '';
          this.renderPinDots();
        }
      }, 100);
    }
  }

  deletePinDigit() {
    if (this.pinBuffer.length > 0) {
      this.pinBuffer = this.pinBuffer.slice(0, -1);
      this.renderPinDots();
    }
  }

  clearPin() {
    this.pinBuffer = '';
    this.renderPinDots();
  }

  renderPinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      if (idx < this.pinBuffer.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }
}

// Global Auth Instance
window.auth = new ParkProAuth();
