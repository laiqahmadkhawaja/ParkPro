package com.parkpro.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

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
    public String getPairedBluetoothDevices() {
        JSONArray devicesArray = new JSONArray();
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter != null && adapter.isEnabled()) {
                Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
                for (BluetoothDevice device : pairedDevices) {
                    JSONObject obj = new JSONObject();
                    obj.put("name", device.getName());
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
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();

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
            } catch (Exception ignored) {}
        }
    }
}
