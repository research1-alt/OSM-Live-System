
package com.example.osmlive;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private BluetoothGatt bluetoothGatt;
    private static final int PERMISSION_REQUEST_CODE = 1234;
    private static final String TAG = "OSM_NATIVE_BLE";
    private static final String CHANNEL_ID = "OSM_FILE_EXPORTS";

    private static final UUID UART_SERVICE_UUID = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID TX_CHAR_UUID = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID CLIENT_CHARACTERISTIC_CONFIG = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isScanning = false;

    private final ActivityResultLauncher<Intent> enableBtLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK) {
                    sendToJs("STATE: Bluetooth authorized.");
                    new NativeBleBridge().startBleLink();
                } else {
                    sendToJs("ERROR: Bluetooth activation denied.");
                }
            }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webView);

        initBluetooth();
        createNotificationChannel();
        checkAndRequestPermissions();
        setupWebView();
        
        webView.loadUrl("https://live-data-rust.vercel.app/");
        setupBackNavigation();
    }

    private void initBluetooth() {
        BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "File Exports", NotificationManager.IMPORTANCE_DEFAULT);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private void checkAndRequestPermissions() {
        String[] perms;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms = new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.ACCESS_FINE_LOCATION};
        } else {
            perms = new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
        }
        
        List<String> needed = new ArrayList<>();
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) needed.add(p);
        }
        if (!needed.isEmpty()) ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.addJavascriptInterface(new NativeBleBridge(), "NativeBleBridge");
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidInterface");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest r) { runOnUiThread(() -> r.grant(r.getResources())); }
        });
    }

    public class NativeBleBridge {
        @JavascriptInterface
        public void openBluetoothSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                sendToJs("MANUAL_ACTION: Toggle Bluetooth OFF/ON to reset system stack.");
            });
        }

        @JavascriptInterface
        public void startBleLink() {
            runOnUiThread(() -> {
                cleanupBluetooth();
                
                if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                    Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        enableBtLauncher.launch(enableBtIntent);
                    }
                    return;
                }

                bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
                if (bluetoothLeScanner == null) {
                    sendToJs("ERROR: System Scanner not found. Bluetooth service busy.");
                    return;
                }

                ScanSettings settings = new ScanSettings.Builder()
                        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                        .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                        .build();

                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                    try {
                        isScanning = true;
                        bluetoothLeScanner.startScan(null, settings, scanCallback);
                        sendToJs("SCANNING: Hunting for OSM hardware...");
                        
                        mainHandler.postDelayed(() -> {
                            if (isScanning) {
                                stopCurrentScan();
                                sendToJs("TIMEOUT: Bridge not found in 20s.");
                                evaluateJs("window.onNativeBleStatus('disconnected')");
                            }
                        }, 20000);
                    } catch (Exception e) {
                        sendToJs("EXCEPTION: " + e.getMessage());
                    }
                }
            });
        }

        @JavascriptInterface
        public void disconnectBle() {
            runOnUiThread(() -> cleanupBluetooth());
        }

        private void cleanupBluetooth() {
            stopCurrentScan();
            if (bluetoothGatt != null) {
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    bluetoothGatt.disconnect();
                    bluetoothGatt.close();
                }
                bluetoothGatt = null;
            }
            sendToJs("STATE: Resources Purged.");
            evaluateJs("window.onNativeBleStatus('disconnected')");
        }

        private void stopCurrentScan() {
            if (bluetoothLeScanner != null && isScanning) {
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                    try { bluetoothLeScanner.stopScan(scanCallback); } catch (Exception ignored) {}
                }
            }
            isScanning = false;
        }
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                String name = device.getName();
                if (name != null && (name.contains("OSM") || name.contains("ESP32") || name.contains("CAN"))) {
                    sendToJs("MATCH: " + name + " found.");
                    new NativeBleBridge().stopCurrentScan();
                    connectToDevice(device);
                }
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            isScanning = false;
            String msg = (errorCode == SCAN_FAILED_APPLICATION_REGISTRATION_FAILED) 
                         ? "Code 2: Stack Full. Manual Reset Req." 
                         : "Error Code " + errorCode;
            sendToJs("SCAN_FAILED: " + msg);
            evaluateJs("window.onNativeBleStatus('error')");
        }
    };

    private void connectToDevice(BluetoothDevice device) {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
            sendToJs("LINK: Contacting hardware...");
            bluetoothGatt = device.connectGatt(this, false, gattCallback);
        }
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                sendToJs("LINK: Handshake initiated.");
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    // Delay MTU to allow internal stack preparation
                    mainHandler.postDelayed(() -> {
                        if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                            gatt.requestMtu(512);
                        }
                    }, 1000);
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                sendToJs("LINK: Terminated.");
                evaluateJs("window.onNativeBleStatus('disconnected')");
                if (bluetoothGatt != null) {
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        bluetoothGatt.close();
                    }
                    bluetoothGatt = null;
                }
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            sendToJs("LINK: MTU Sync (" + mtu + " bytes)");
            // Crucial: Wait before discovering services after MTU change
            mainHandler.postDelayed(() -> {
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    gatt.discoverServices();
                }
            }, 600);
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                BluetoothGattService service = gatt.getService(UART_SERVICE_UUID);
                if (service != null) {
                    BluetoothGattCharacteristic txChar = service.getCharacteristic(TX_CHAR_UUID);
                    if (txChar != null) {
                        if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                            gatt.setCharacteristicNotification(txChar, true);
                            BluetoothGattDescriptor descriptor = txChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG);
                            if (descriptor != null) {
                                descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                                gatt.writeDescriptor(descriptor);
                                sendToJs("BRIDGE: Live stream active.");
                                evaluateJs("window.onNativeBleStatus('connected')");
                            }
                        }
                    }
                } else {
                    sendToJs("ERROR: NUS Service not found on hardware.");
                }
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, @NonNull BluetoothGattCharacteristic characteristic) {
            if (TX_CHAR_UUID.equals(characteristic.getUuid())) {
                byte[] val = characteristic.getValue();
                if (val != null) {
                    String data = new String(val);
                    evaluateJs("window.onNativeBleData('" + data.replace("\n", "\\n").replace("\r", "") + "')");
                }
            }
        }
    };

    private void sendToJs(String msg) { evaluateJs("window.onNativeBleLog('" + msg + "')"); }
    private void evaluateJs(String script) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(script, null); }); }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() { if (webView.canGoBack()) webView.goBack(); else finish(); }
        });
    }

    public class WebAppInterface {
        @JavascriptInterface
        public boolean isNativeApp() { return true; }

        @JavascriptInterface
        public void saveFile(String data, String fileName) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(Uri.parse("content://media/external/downloads"), v);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) { os.write(data.getBytes()); os.flush(); onSaveComplete(fileName); }
                        }
                    }
                } else {
                    File path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!path.exists()) path.mkdirs();
                    File file = new File(path, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) { fos.write(data.getBytes()); fos.flush(); }
                    MediaScannerConnection.scanFile(MainActivity.this, new String[]{file.getAbsolutePath()}, null, null);
                    onSaveComplete(fileName);
                }
            } catch (Exception e) { sendToJs("FILE_ERROR: " + e.getMessage()); }
        }

        private void onSaveComplete(String fileName) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Exported: " + fileName, Toast.LENGTH_SHORT).show());
        }
    }
}
