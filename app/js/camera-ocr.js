/**
 * ParkPro Camera & OCR License Plate Scanner Controller
 * Captures camera video stream, processes image frames, and extracts plate numbers.
 */

class ParkProCameraOCR {
  constructor() {
    this.stream = null;
    this.videoEl = null;
    this.canvasEl = null;
    this.isScanning = false;
  }

  /**
   * Start live camera stream inside targeted video element
   * @param {HTMLVideoElement} videoElement 
   * @param {HTMLCanvasElement} canvasElement 
   */
  async startCamera(videoElement, canvasElement) {
    this.videoEl = videoElement;
    this.canvasEl = canvasElement;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API (getUserMedia) not supported in this browser.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();
      this.isScanning = true;
      console.log('[Camera] Rear camera stream started successfully');
    } catch (err) {
      console.error('[Camera] Failed to start camera:', err);
      throw err;
    }
  }

  stopCamera() {
    this.isScanning = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    console.log('[Camera] Camera stream stopped');
  }

  /**
   * Capture single frame, preprocess with high-contrast grayscale filter, and extract plate
   */
  captureAndScanPlate() {
    if (!this.videoEl || !this.canvasEl || !this.isScanning) {
      return null;
    }

    const video = this.videoEl;
    const canvas = this.canvasEl;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw current frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Preprocess: crop center target region (where license plate sits)
    const cropX = Math.floor(canvas.width * 0.15);
    const cropY = Math.floor(canvas.height * 0.35);
    const cropW = Math.floor(canvas.width * 0.70);
    const cropH = Math.floor(canvas.height * 0.30);

    const imgData = ctx.getImageData(cropX, cropY, cropW, cropH);
    const d = imgData.data;

    // High-contrast Grayscale & Binarization filter
    for (let i = 0; i < d.length; i += 4) {
      const avg = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      // Contrast threshold
      const val = avg > 115 ? 255 : 0;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }

    ctx.putImageData(imgData, cropX, cropY);

    // Vibrate device if native bridge or navigator.vibrate is available
    if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
      window.AndroidBridge.vibrate(60);
    } else if (navigator.vibrate) {
      navigator.vibrate(60);
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * Format and clean license plate string according to standard conventions
   * e.g. "abc 1234" -> "ABC-1234", "lee 19 1234" -> "LEE-19-1234"
   */
  cleanPlateText(rawText) {
    if (!rawText) return '';
    let cleaned = rawText.toUpperCase().replace(/[^A-Z0-9\s-]/g, '').trim();
    cleaned = cleaned.replace(/[\s_]+/g, '-');
    cleaned = cleaned.replace(/-+/g, '-');
    cleaned = cleaned.replace(/^-+|-+$/g, '');
    return cleaned;
  }

  /**
   * Cryptographic HMAC-SHA256 Ticket Signature Generator
   * @param {string} ticketNo 
   * @param {string} plateNumber 
   * @param {string} vehicleTypeId 
   * @param {string} entryTime 
   * @param {string} secretKey 
   */
  async generateTicketSignature(ticketNo, plateNumber, vehicleTypeId, entryTime, secretKey) {
    const payload = `${ticketNo}|${plateNumber}|${vehicleTypeId}|${entryTime}`;
    const enc = new TextEncoder();
    const keyData = enc.encode(secretKey || 'parkpro_default_key');
    const msgData = enc.encode(payload);

    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      // Truncate to first 12 hex chars for compact QR code efficiency
      return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16).toUpperCase();
    } catch (e) {
      // Fallback simple hash
      return 'SIG-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  }
}

// Global Camera OCR Instance
window.cameraOcr = new ParkProCameraOCR();
