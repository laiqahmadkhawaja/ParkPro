/**
 * ParkPro Bilingual Localization & Enterprise Security Engine
 * English/Urdu (RTL) language translation, Vehicle Blacklist & VIP passes.
 */

const PARKPRO_TRANSLATIONS = {
  en: {
    brand_title: 'ParkPro',
    online: 'ONLINE',
    offline: 'OFFLINE',
    scan_plate: 'SCAN PLATE',
    exit_scan: 'EXIT SCAN',
    kpi_parked: 'Currently Parked',
    kpi_revenue: "Today's Revenue",
    kpi_entries: "Today's Entries",
    kpi_exits: "Today's Exits",
    lot_capacity: 'Parking Lot Capacity',
    recent_parked: 'Recent Parked Vehicles',
    view_all: 'View All →',
    nav_dashboard: 'Dashboard',
    nav_vehicles: 'Vehicles',
    nav_reports: 'Reports',
    nav_settings: 'Settings',
    modal_entry_title: 'New Vehicle Entry',
    select_type: '1. SELECT VEHICLE TYPE',
    scan_enter_plate: '2. SCAN OR ENTER PLATE',
    open_camera: '📷 OPEN CAMERA',
    close_camera: '⏹️ CLOSE CAMERA',
    snap_ocr: '⚡ SNAP & READ PLATE',
    btn_print_entry: 'PRINT TICKET & SAVE ENTRY',
    modal_exit_title: 'Vehicle Exit & Settlement',
    scan_qr_btn: '📷 SCAN TICKET QR',
    lost_ticket_btn: 'LOST TICKET',
    checkout_btn: 'CHECKOUT',
    confirm_payment: 'COLLECT PAYMENT & OPEN GATE',
    search_placeholder: 'Search by Plate (e.g. ABC) or Ticket #...',
    slots_free: 'Free Slots',
    duplicate_alert: 'DUPLICATE ENTRY BLOCKED! Plate is already inside under Ticket #',
    blacklist_alert: '🚨 SECURITY ALERT: THIS VEHICLE IS ON THE BLACKLIST / FLAGGED REGISTRY!'
  },
  ur: {
    brand_title: 'پارک پرو',
    online: 'آن لائن',
    offline: 'آف لائن',
    scan_plate: 'نمبر پلیٹ اسکین',
    exit_scan: 'گاڑی کا خروج',
    kpi_parked: 'پارک شدہ گاڑیاں',
    kpi_revenue: 'آج کی آمدن',
    kpi_entries: 'آج کے داخلے',
    kpi_exits: 'آج کے اخراج',
    lot_capacity: 'پارکنگ کی کل گنجائش',
    recent_parked: 'تازہ ترین پارک شدہ گاڑیاں',
    view_all: 'تمام دیکھیں ←',
    nav_dashboard: 'ڈیش بورڈ',
    nav_vehicles: 'گاڑیاں',
    nav_reports: 'رپورٹس',
    nav_settings: 'ترتیبات',
    modal_entry_title: 'نئی گاڑی کا داخلہ',
    select_type: '۱. گاڑی کی قسم منتخب کریں',
    scan_enter_plate: '۲. نمبر پلیٹ اسکین یا درج کریں',
    open_camera: '📷 کیمرہ کھولیں',
    close_camera: '⏹️ کیمرہ بند کریں',
    snap_ocr: '⚡ پلیٹ پڑھیں',
    btn_print_entry: 'رسید پرنٹ اور داخلہ محفوظ کریں',
    modal_exit_title: 'گاڑی کی واپسی اور بل ادائیگی',
    scan_qr_btn: '📷 کیو آر کوڈ اسکین کریں',
    lost_ticket_btn: 'گمشدہ ٹکٹ',
    checkout_btn: 'بل چیک کریں',
    confirm_payment: 'رقم وصول کریں اور گیٹ کھولیں',
    search_placeholder: 'پلیٹ نمبر یا ٹکٹ نمبر سے تلاش کریں...',
    slots_free: 'خالی جگہ',
    duplicate_alert: 'داخلہ ناممکن! یہ گاڑی پہلے سے پارکنگ میں موجود ہے۔ ٹکٹ نمبر: ',
    blacklist_alert: '🚨 سیکیورٹی الرٹ: یہ گاڑی بلیک لسٹ / مشکوک فہرست میں شامل ہے!'
  }
};

class ParkProI18n {
  constructor() {
    this.currentLang = localStorage.getItem('parkpro_lang') || 'en';
  }

  init() {
    this.setLanguage(this.currentLang);
  }

  t(key) {
    const dict = PARKPRO_TRANSLATIONS[this.currentLang] || PARKPRO_TRANSLATIONS.en;
    return dict[key] || key;
  }

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('parkpro_lang', lang);

    const isUrdu = lang === 'ur';
    document.documentElement.setAttribute('dir', isUrdu ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);

    if (isUrdu) {
      document.body.classList.add('rtl-mode');
    } else {
      document.body.classList.remove('rtl-mode');
    }

    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });

    const langToggleBtn = document.getElementById('btnLangToggle');
    if (langToggleBtn) {
      langToggleBtn.textContent = isUrdu ? 'EN' : 'اردو';
    }
  }

  toggleLanguage() {
    this.setLanguage(this.currentLang === 'en' ? 'ur' : 'en');
  }

  // --- Blacklist Check ---
  async checkBlacklist(plateNumber) {
    const clean = plateNumber.trim().toUpperCase();
    const blacklist = await window.db.get('settings', 'blacklist_registry');
    if (!blacklist || !blacklist.value) return null;

    try {
      const list = JSON.parse(blacklist.value);
      return list.find(item => item.plate.toUpperCase() === clean) || null;
    } catch (e) {
      return null;
    }
  }

  // --- VIP Whitelist Pass Check ---
  async checkVipPass(plateNumber) {
    const clean = plateNumber.trim().toUpperCase();
    const vipListSetting = await window.db.get('settings', 'vip_whitelist');
    if (!vipListSetting || !vipListSetting.value) return null;

    try {
      const list = JSON.parse(vipListSetting.value);
      const now = new Date().toISOString().slice(0, 10);
      return list.find(item => item.plate.toUpperCase() === clean && item.expires_at >= now) || null;
    } catch (e) {
      return null;
    }
  }
}

// Global i18n Instance
window.parkproI18n = new ParkProI18n();
