package com.parkpro.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AndroidBridge {
    private static final String TAG = "ParkProBridge";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final Context context;

    public AndroidBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public boolean isNativeBridgeAvailable() {
        return true;
    }

    @JavascriptInterface
    public void vibrate(int milliseconds) {
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(milliseconds);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error vibrating device", e);
        }
    }

    @JavascriptInterface
    public void openBluetoothSettings() {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening Bluetooth settings", e);
        }
    }

    @JavascriptInterface
    public String getPairedBluetoothDevices() {
        JSONArray devicesArray = new JSONArray();
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter != null && adapter.isEnabled()) {
                Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
                for (BluetoothDevice device : pairedDevices) {
                    JSONObject obj = new JSONObject();
                    obj.put("name", device.getName() != null ? device.getName() : "Thermal Printer");
                    obj.put("address", device.getAddress());
                    devicesArray.put(obj);
                }
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Bluetooth permission not granted", se);
        } catch (Exception e) {
            Log.e(TAG, "Error fetching paired Bluetooth devices", e);
        }
        return devicesArray.toString();
    }

    @JavascriptInterface
    public boolean printBluetooth(String macAddress, String base64Payload) {
        BluetoothSocket socket = null;
        OutputStream outputStream = null;
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                Log.e(TAG, "Bluetooth adapter disabled or not present");
                return false;
            }

            BluetoothDevice device = adapter.getRemoteDevice(macAddress);
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
            } catch (Exception connectEx) {
                Log.w(TAG, "Standard SPP connection failed, trying fallback reflection socket...", connectEx);
                Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                socket = (BluetoothSocket) m.invoke(device, 1);
                socket.connect();
            }

            outputStream = socket.getOutputStream();
            byte[] bytesToPrint = Base64.decode(base64Payload, Base64.DEFAULT);
            outputStream.write(bytesToPrint);
            outputStream.flush();

            Log.i(TAG, "Successfully printed ESC/POS ticket to: " + macAddress);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to print to Bluetooth device: " + macAddress, e);
            return false;
        } finally {
            try {
                if (outputStream != null) outputStream.close();
                if (socket != null) socket.close();
            } catch (Exception e) {
                Log.e(TAG, "Error closing Bluetooth socket/stream", e);
            }
        }
    }

    @JavascriptInterface
    public String recognizePlateFromBase64(String base64Data) {
        try {
            if (base64Data == null || base64Data.trim().isEmpty()) {
                return "";
            }
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] decoded = Base64.decode(base64Data, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            if (bitmap == null) {
                return "";
            }

            InputImage image = InputImage.fromBitmap(bitmap, 0);
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            Text result = Tasks.await(recognizer.process(image), 4, TimeUnit.SECONDS);

            if (result == null || result.getText().trim().isEmpty()) {
                return "";
            }

            return extractLicensePlate(result.getText());
        } catch (Exception e) {
            Log.e(TAG, "MLKit OCR recognition error", e);
            return "";
        }
    }

    private String extractLicensePlate(String rawText) {
        if (rawText == null || rawText.isEmpty()) return "";

        String[] lines = rawText.split("\\r?\\n");
        Pattern platePattern = Pattern.compile("([A-Z]{1,4}[-\\s]?[0-9]{1,4}(?:[-\\s]?[0-9]{1,4})?)");

        for (String line : lines) {
            String clean = line.toUpperCase().replaceAll("[^A-Z0-9\\s-]", "").trim();
            // Ignore common administrative or regional headers
            if (clean.equals("PUNJAB") || clean.equals("SINDH") || clean.equals("ICT") ||
                clean.equals("ISLAMABAD") || clean.equals("PAKISTAN") || clean.equals("GOVERNMENT") ||
                clean.equals("EXCISE") || clean.equals("KPK")) {
                continue;
            }

            Matcher matcher = platePattern.matcher(clean);
            if (matcher.find()) {
                String candidate = matcher.group(1).trim().replaceAll("\\s+", "-");
                // Plate must contain both letters and digits or be valid format
                if (candidate.matches(".*[A-Z].*") && candidate.matches(".*[0-9].*") && candidate.length() >= 4) {
                    return candidate;
                }
            }
        }

        // Fallback: check entire text for best plate-like sequence
        String fullClean = rawText.toUpperCase().replaceAll("[^A-Z0-9\\s-]", " ");
        Matcher fullMatcher = platePattern.matcher(fullClean);
        while (fullMatcher.find()) {
            String candidate = fullMatcher.group(1).trim().replaceAll("\\s+", "-");
            if (candidate.matches(".*[A-Z].*") && candidate.matches(".*[0-9].*") && candidate.length() >= 4) {
                return candidate;
            }
        }

        return "";
    }
}
