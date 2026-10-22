/**
 * ParkPro QR Code Verifier & Exit Camera Scanner
 * Decodes camera video stream, parses ticket QR payloads, and verifies HMAC-SHA256 signatures.
 */

class ParkProQrVerifier {
  constructor() {
    this.stream = null;
    this.videoEl = null;
    this.isScanning = false;
    this.barcodeDetector = null;
    this.scanInterval = null;

    if ('BarcodeDetector' in window) {
      try {
        this.barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('[QR] BarcodeDetector initialization note:', e);
      }
    }
  }

  /**
   * Start live QR code camera reader
   * @param {HTMLVideoElement} videoElement 
   * @param {Function} onCodeDetected Callback when valid QR code is scanned
   */
  async startQrScanner(videoElement, onCodeDetected) {
    this.videoEl = videoElement;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not available in this browser.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();
      this.isScanning = true;

      // Start detection loop if BarcodeDetector is available
      if (this.barcodeDetector) {
        this.scanInterval = setInterval(async () => {
          if (!this.isScanning || !this.videoEl) return;
          try {
            const barcodes = await this.barcodeDetector.detect(this.videoEl);
            if (barcodes.length > 0) {
              const rawVal = barcodes[0].rawValue;
              this.triggerHaptic();
              this.stopQrScanner();
              if (onCodeDetected) onCodeDetected(rawVal);
            }
          } catch (scanErr) {
            // Ignore frame scan drops
          }
        }, 250);
      }
    } catch (err) {
      console.error('[QR] Failed to start QR camera:', err);
      throw err;
    }
  }

  stopQrScanner() {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  triggerHaptic() {
    if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
      window.AndroidBridge.vibrate(80);
    } else if (navigator.vibrate) {
      navigator.vibrate(80);
    }
  }

  /**
   * Parse QR payload and verify cryptographic signature
   * @param {string} qrString format: "ticketNo|plateNumber|qrSignature"
   */
  async verifyTicket(qrString) {
    if (!qrString || typeof qrString !== 'string') {
      return { valid: false, reason: 'Invalid or empty QR payload.' };
    }

    const parts = qrString.trim().split('|');
    const ticketNo = parts[0];
    const plateNumber = parts[1];
    const scannedSignature = parts[2] || '';

    // Search active session in local database
    const parkedList = await window.db.getCurrentlyParked();
    const session = parkedList.find(s => s.ticket_no === ticketNo || s.plate_number === plateNumber);

    if (!session) {
      return { valid: false, reason: `No active parked vehicle found for Ticket #${ticketNo} or Plate ${plateNumber}.` };
    }

    // Retrieve secret key
    const secretSetting = await window.db.get('settings', 'qr_secret');
    const secretKey = secretSetting?.value || 'parkpro_offline_secret_key_2026';

    // Recompute expected HMAC-SHA256 signature
    const expectedSignature = await window.cameraOcr.generateTicketSignature(
      session.ticket_no,
      session.plate_number,
      session.vehicle_type_id,
      session.entry_time,
      secretKey
    );

    // Check signature match
    const signatureMatches = (scannedSignature === session.qr_signature) || (scannedSignature === expectedSignature);

    if (!signatureMatches && scannedSignature) {
      return {
        valid: false,
        tampered: true,
        session,
        reason: 'CRITICAL WARNING: Tampered QR code detected! Ticket signature does not match database record.'
      };
    }

    return {
      valid: true,
      tampered: false,
      session
    };
  }
}

// Global QR Verifier Instance
window.qrVerifier = new ParkProQrVerifier();
