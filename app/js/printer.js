/**
 * ParkPro Bluetooth ESC/POS Thermal Printer Driver
 * Dual-Mode: Web Bluetooth API (PWA/HTTPS) + Android Native Bridge (APK).
 * Supports 58mm (32 chars) and 80mm (48 chars) mobile thermal printers.
 */

class ParkProPrinter {
  constructor() {
    this.selectedPrinterMac = null;
    this.webBluetoothDevice = null;
    this.gattServer = null;
    this.printCharacteristic = null;
    this.paperWidth = '58'; // '58' or '80'
  }

  isNativeAvailable() {
    return !!(window.AndroidBridge && typeof window.AndroidBridge.printBluetooth === 'function');
  }

  isWebBluetoothAvailable() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  /**
   * Fetch paired Bluetooth devices
   */
  async getPairedPrinters() {
    if (this.isNativeAvailable()) {
      try {
        const jsonStr = window.AndroidBridge.getPairedBluetoothDevices();
        return JSON.parse(jsonStr || '[]');
      } catch (err) {
        console.error('[Printer] AndroidBridge getPairedBluetoothDevices failed:', err);
        return [];
      }
    } else if (this.isWebBluetoothAvailable()) {
      // In Web Bluetooth, paired devices can be queried via getDevices() if granted
      if (navigator.bluetooth.getDevices) {
        const devices = await navigator.bluetooth.getDevices();
        return devices.map(d => ({ name: d.name || 'Thermal Printer', address: d.id }));
      }
    }
    return [];
  }

  /**
   * Connect or request Bluetooth printer
   */
  async pairNewPrinter() {
    if (this.isWebBluetoothAvailable()) {
      try {
        this.webBluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [
            { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Standard ESC/POS Service
            { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
            { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] }
          ],
          optionalServices: ['generic_access', '000018f0-0000-1000-8000-00805f9b34fb']
        });

        this.gattServer = await this.webBluetoothDevice.gatt.connect();
        const service = await this.gattServer.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        this.printCharacteristic = await service.getCharacteristics().then(chars => chars[0]);

        this.selectedPrinterMac = this.webBluetoothDevice.id;
        console.log('[Printer] Connected to Web Bluetooth device:', this.webBluetoothDevice.name);
        return { name: this.webBluetoothDevice.name, address: this.webBluetoothDevice.id };
      } catch (err) {
        console.error('[Printer] Web Bluetooth pairing failed:', err);
        throw err;
      }
    } else {
      throw new Error('Web Bluetooth not available in this browser environment.');
    }
  }

  /**
   * Generate raw ESC/POS bytecode array for an entry ticket
   * @param {Object} session 
   * @param {Object} vehicleType 
   * @param {Object} settings 
   */
  generateEscPosReceipt(session, vehicleType, settings) {
    const is80 = (settings.printer_width || this.paperWidth) === '80';
    const cols = is80 ? 48 : 32;
    const divider = '-'.repeat(cols) + '\n';

    const lotName = settings.lot_name || 'ParkPro Parking';
    const address = settings.lot_address || 'Main Gate';
    const phone = settings.phone || '';
    const footer = settings.receipt_footer || 'Thank you for parking with ParkPro.';
    const currency = settings.currency || 'PKR';

    const entryDate = new Date(session.entry_time);
    const dateFormatted = entryDate.toLocaleDateString();
    const timeFormatted = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const encoder = new TextEncoder();
    const bytes = [];

    // Helpers to push ESC/POS command bytes
    const pushCmd = (...cmds) => bytes.push(...cmds);
    const pushText = (str) => {
      const encoded = encoder.encode(str);
      for (let i = 0; i < encoded.length; i++) bytes.push(encoded[i]);
    };

    // 1. Initialize Printer (ESC @)
    pushCmd(0x1B, 0x40);

    // 2. Center Align (ESC a 1)
    pushCmd(0x1B, 0x61, 0x01);

    // 3. Bold Header (ESC E 1)
    pushCmd(0x1B, 0x45, 0x01);
    pushText(lotName + '\n');
    pushCmd(0x1B, 0x45, 0x00); // Bold OFF

    if (address) pushText(address + '\n');
    if (phone) pushText('Tel: ' + phone + '\n');

    pushText(divider);

    // 4. Center: License Plate in Double-Height & Double-Width (GS ! 0x11)
    pushText('VEHICLE LICENSE PLATE\n');
    pushCmd(0x1D, 0x21, 0x11); // Double size
    pushCmd(0x1B, 0x45, 0x01); // Bold ON
    pushText(session.plate_number + '\n');
    pushCmd(0x1D, 0x21, 0x00); // Normal size
    pushCmd(0x1B, 0x45, 0x00); // Bold OFF

    pushText(divider);

    // 5. Left Align Ticket Details (ESC a 0)
    pushCmd(0x1B, 0x61, 0x00);
    pushText(`TICKET NO  : ${session.ticket_no}\n`);
    pushText(`CATEGORY   : ${vehicleType.name}\n`);
    pushText(`TIME IN    : ${dateFormatted} ${timeFormatted}\n`);
    pushText(`BASE RATE  : ${vehicleType.base_rate} ${currency} (1st hr)\n`);
    pushText(`HOURLY     : ${vehicleType.hourly_rate} ${currency}/hr\n`);
    pushText(`GRACE PER. : ${vehicleType.grace_period_mins} mins\n`);

    pushText(divider);

    // 6. Center Align QR Code (ESC a 1)
    pushCmd(0x1B, 0x61, 0x01);
    pushText('SCAN AT EXIT FOR QUICK CHECKOUT\n\n');

    // Standard ESC/POS QR Code Model 2 Commands
    const qrPayload = `${session.ticket_no}|${session.plate_number}|${session.qr_signature}`;
    const qrBytes = encoder.encode(qrPayload);
    const storeLen = qrBytes.length + 3;
    const pL = storeLen % 256;
    const pH = Math.floor(storeLen / 256);

    // GS ( k : QR Code Model 2
    pushCmd(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // GS ( k : Set QR module size to 6 dots
    pushCmd(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06);
    // GS ( k : Set error correction level M
    pushCmd(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);
    // GS ( k : Store QR data
    pushCmd(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < qrBytes.length; i++) bytes.push(qrBytes[i]);
    // GS ( k : Print QR code
    pushCmd(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

    pushText('\n' + divider);

    // 7. Footer
    pushCmd(0x1B, 0x61, 0x01);
    pushText(footer + '\n');
    pushText('ParkPro Mobile System\n');

    // 8. Feed 3 Lines & Paper Cut (GS V 0)
    pushCmd(0x1B, 0x64, 0x03);
    pushCmd(0x1D, 0x56, 0x00);

    return new Uint8Array(bytes);
  }

  /**
   * Dispatches receipt bytes to paired printer
   */
  async printTicket(session, vehicleType, settings) {
    const rawBytes = this.generateEscPosReceipt(session, vehicleType, settings);

    // Mode A: Android Native Bridge (High-speed RFCOMM SPP socket)
    if (this.isNativeAvailable()) {
      let mac = this.selectedPrinterMac;
      if (!mac) {
        const paired = await this.getPairedPrinters();
        if (paired.length > 0) {
          mac = paired[0].address;
          this.selectedPrinterMac = mac;
        } else {
          throw new Error('No paired Bluetooth printer found. Please pair printer in Android Bluetooth settings.');
        }
      }

      // Base64 encode for AndroidBridge interface
      let binary = '';
      for (let i = 0; i < rawBytes.byteLength; i++) {
        binary += String.fromCharCode(rawBytes[i]);
      }
      const base64Payload = btoa(binary);

      const success = window.AndroidBridge.printBluetooth(mac, base64Payload);
      if (!success) {
        throw new Error('AndroidBridge failed to send bytes to printer: ' + mac);
      }
      return true;
    }

    // Mode B: Web Bluetooth API
    if (this.isWebBluetoothAvailable()) {
      if (!this.printCharacteristic) {
        await this.pairNewPrinter();
      }

      // Write chunks of 100 bytes (GATT MTU safety limit)
      const CHUNK_SIZE = 100;
      for (let i = 0; i < rawBytes.length; i += CHUNK_SIZE) {
        const chunk = rawBytes.slice(i, i + CHUNK_SIZE);
        await this.printCharacteristic.writeValue(chunk);
      }
      return true;
    }

    console.warn('[Printer] No physical Bluetooth bridge available. Falling back to digital ticket preview.');
    return false;
  }
}

// Global Printer Instance
window.parkproPrinter = new ParkProPrinter();
