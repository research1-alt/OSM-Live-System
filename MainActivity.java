
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
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
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
    private static final UUID HM10_SERVICE_UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    private static final UUID TX_CHAR_UUID = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID RX_CHAR_UUID = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID HM10_CHAR_UUID = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb");
    private static final UUID CLIENT_CHARACTERISTIC_CONFIG = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isScanning = false;
    private boolean isConnecting = false;
    private boolean isConnected = false;
    private String lastDeviceAddress = null;
    private static final String PREFS_NAME = "OSM_BLE_PREFS";
    private static final String KEY_LAST_ADDR = "last_device_addr";

    // Data buffering for high-speed CAN
    private final StringBuilder bleDataBuffer = new StringBuilder();
    private long lastBleFlushTime = 0;
    private static final int BLE_FLUSH_INTERVAL_MS = 8; // 125Hz flush rate for higher resolution

    // Persistent stream for real-time logging
    private OutputStream activeLogOutputStream = null;

    // Temporary storage for file data during picker transition
    private String pendingFileData = "";

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

    private final ActivityResultLauncher<Intent> createFileLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Uri uri = result.getData().getData();
                    if (uri != null) {
                        if (!pendingFileData.isEmpty()) {
                            writeDataToUri(uri, pendingFileData);
                            pendingFileData = ""; // Clear buffer
                        } else {
                            try {
                                activeLogOutputStream = getContentResolver().openOutputStream(uri, "w");
                                evaluateJs("window.onNativeLogFileReady(true)");
                            } catch (Exception e) {
                                Log.e(TAG, "Failed to open stream: " + e.getMessage());
                                evaluateJs("window.onNativeLogFileReady(false)");
                            }
                        }
                    }
                } else {
                    evaluateJs("window.onNativeLogFileReady(false)");
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
        
        webView.loadUrl("https://ais-dev-toqlyfvcyq4ckq54q77wf3-127120545089.asia-southeast1.run.app");
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
        s.setGeolocationEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Handle file downloads (Base64 data URLs from the web app)
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url.startsWith("data:")) {
                try {
                    // 1. Extract base64 data
                    String base64Data = url.substring(url.indexOf(",") + 1);
                    byte[] fileBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                    
                    // 2. Determine filename
                    String extension = mimetype.contains("csv") ? ".csv" : ".trc";
                    String fileName = "OSM_LOG_" + System.currentTimeMillis() + extension;
                    
                    // 3. Save to Downloads folder
                    File path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File file = new File(path, fileName);
                    
                    try (FileOutputStream os = new FileOutputStream(file)) {
                        os.write(fileBytes);
                        os.flush();
                    }
                    
                    // 4. Notify user
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Log Saved to Downloads: " + fileName, Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Download Failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
            }
        });

        webView.addJavascriptInterface(new NativeBleBridge(), "NativeBleBridge");
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidInterface");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest r) { runOnUiThread(() -> r.grant(r.getResources())); }
            
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });
    }

    private void writeDataToUri(Uri uri, String data) {
        try {
            OutputStream os = getContentResolver().openOutputStream(uri);
            if (os != null) {
                os.write(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                os.flush();
                os.close();
                Toast.makeText(this, "Export Saved Successfully", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            sendToJs("FILE_WRITE_ERROR: " + e.getMessage());
        }
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
                isConnecting = false;
                isConnected = false;
                
                // Immediately notify UI that we are starting the connection process
                evaluateJs("window.onNativeBleStatus('connecting')");
                
                // Check if Location is enabled (Required for BLE on many Android versions)
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                boolean gpsEnabled = false;
                try { gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch(Exception ignored) {}
                if (!gpsEnabled) {
                    sendToJs("WARN: Location services are OFF. BLE discovery might fail.");
                }

                // Add a small delay after cleanup to let the stack breathe
                mainHandler.postDelayed(() -> {
                    if (bluetoothAdapter == null) {
                        sendToJs("ERROR: Bluetooth Hardware not detected on this system.");
                        return;
                    }

                    if (!bluetoothAdapter.isEnabled()) {
                        sendToJs("STATE: Bluetooth is OFF. Requesting activation...");
                        Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                        if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                            enableBtLauncher.launch(enableBtIntent);
                        } else {
                            sendToJs("ERROR: Missing BLUETOOTH_CONNECT permission.");
                        }
                        return;
                    }

                    // Check for cached device for "Instant Connect"
                    if (lastDeviceAddress == null) {
                        lastDeviceAddress = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(KEY_LAST_ADDR, null);
                    }

                    if (lastDeviceAddress != null) {
                        sendToJs("LINK: Attempting fast reconnect to " + lastDeviceAddress + "...");
                        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(lastDeviceAddress);
                        if (device != null) {
                            connectToDevice(device);
                            
                            // Set a timeout for fast reconnect, if it fails, start scanning
                            mainHandler.postDelayed(() -> {
                                if (bluetoothGatt == null && !isScanning) {
                                    sendToJs("WARN: Fast reconnect failed. Falling back to scan...");
                                    startScan();
                                }
                            }, 3000);
                            return;
                        }
                    }

                    startScan();
                }, 400); // 400ms delay after cleanup
            });
        }

        private void startScan() {
            bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
            if (bluetoothLeScanner == null) {
                sendToJs("ERROR: BLE Scanner unavailable. Try toggling Bluetooth OFF/ON.");
                return;
            }

            ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                    .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
                    .setNumOfMatches(ScanSettings.MATCH_NUM_ONE_ADVERTISEMENT)
                    .build();

            java.util.List<android.bluetooth.le.ScanFilter> filters = new java.util.ArrayList<>();
            filters.add(new android.bluetooth.le.ScanFilter.Builder().setServiceUuid(new android.os.ParcelUuid(UART_SERVICE_UUID)).build());
            filters.add(new android.bluetooth.le.ScanFilter.Builder().setServiceUuid(new android.os.ParcelUuid(HM10_SERVICE_UUID)).build());

            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                try {
                    isScanning = true;
                    bluetoothLeScanner.startScan(filters, settings, scanCallback);
                    sendToJs("SCANNING: Hunting for OSM hardware (Filtered)...");
                    
                    mainHandler.postDelayed(() -> {
                        if (isScanning && bluetoothGatt == null) {
                            stopCurrentScan();
                            sendToJs("WARN: No OSM device found with filters. Retrying without filters...");
                            startUnfilteredScan();
                        }
                    }, 5000);
                } catch (Exception e) {
                    startUnfilteredScan();
                }
            } else {
                sendToJs("ERROR: Missing BLUETOOTH_SCAN permission.");
            }
        }

        private void startUnfilteredScan() {
            if (bluetoothLeScanner == null) return;
            
            ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build();

            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                try {
                    isScanning = true;
                    bluetoothLeScanner.startScan(null, settings, scanCallback);
                    sendToJs("SCANNING: Broad search active...");
                    
                    mainHandler.postDelayed(() -> {
                        if (isScanning && bluetoothGatt == null) {
                            stopCurrentScan();
                            sendToJs("TIMEOUT: No compatible device found. Check if device is advertising.");
                            evaluateJs("window.onNativeBleStatus('disconnected')");
                        }
                    }, 10000);
                } catch (Exception e) {
                    sendToJs("EXCEPTION: " + e.getMessage());
                }
            }
        }

        @JavascriptInterface
        public void disconnectBle() {
            runOnUiThread(() -> cleanupBluetooth());
        }

        @JavascriptInterface
        public void sendData(String data) {
            if (bluetoothGatt != null) {
                BluetoothGattService service = bluetoothGatt.getService(UART_SERVICE_UUID);
                BluetoothGattCharacteristic rxChar = null;
                
                if (service != null) {
                    rxChar = service.getCharacteristic(RX_CHAR_UUID);
                } else {
                    service = bluetoothGatt.getService(HM10_SERVICE_UUID);
                    if (service != null) {
                        rxChar = service.getCharacteristic(HM10_CHAR_UUID);
                    }
                }

                if (rxChar != null) {
                    rxChar.setValue(data.getBytes());
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        bluetoothGatt.writeCharacteristic(rxChar);
                    }
                }
            }
        }
    }

    private void cleanupBluetooth() {
        stopCurrentScan();
        isConnecting = false;
        isConnected = false;
        if (bluetoothGatt != null) {
            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                try {
                    bluetoothGatt.disconnect();
                    bluetoothGatt.close();
                } catch (Exception e) {
                    Log.e(TAG, "Error during cleanup: " + e.getMessage());
                }
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

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                String name = device.getName();
                String address = device.getAddress();
                Log.d(TAG, "Found device: " + name + " [" + address + "]");
                
                // Log every found device to the JS debug log to help user identify their device
                String deviceLabel = (name != null ? name : "Unnamed") + " (" + address + ")";
                
                if (!isConnecting && name != null && (name.toUpperCase().contains("OSM") || name.toUpperCase().contains("ESP32") || name.toUpperCase().contains("CAN") || name.toUpperCase().contains("MASTER"))) {
                    isConnecting = true;
                    sendToJs("MATCH_FOUND: " + name + ". Establishing dedicated link...");
                    stopCurrentScan();
                    connectToDevice(device);
                } else if (!isConnecting) {
                    // Just log discovered devices that don't match
                    sendToJs("DISCOVERED: " + deviceLabel);
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
        runOnUiThread(() -> {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                sendToJs("LINK: Contacting hardware (" + device.getAddress() + ")...");
                isConnecting = true;
                isConnected = false;
                
                // Connection timeout guard
                mainHandler.postDelayed(() -> {
                    if (isConnecting && !isConnected) {
                        sendToJs("ERROR: Connection handshake timed out. Purging stack...");
                        cleanupBluetooth();
                    }
                }, 15000); // Increased to 15s

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    bluetoothGatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
                } else {
                    bluetoothGatt = device.connectGatt(this, false, gattCallback);
                }
                
                if (bluetoothGatt == null) {
                    isConnecting = false;
                    sendToJs("ERROR: Failed to create GATT client.");
                    return;
                }
                
                // Attempt to refresh cache
                refreshDeviceCache(bluetoothGatt);
            }
        });
    }

    private void refreshDeviceCache(BluetoothGatt gatt) {
        if (gatt == null) return;
        try {
            java.lang.reflect.Method localMethod = gatt.getClass().getMethod("refresh", new Class[0]);
            if (localMethod != null) {
                boolean result = (Boolean) localMethod.invoke(gatt, new Object[0]);
                Log.d(TAG, "GATT Cache Refresh: " + result);
            }
        } catch (Exception e) {
            Log.e(TAG, "An exception occurred while refreshing device cache: " + e.getMessage());
        }
    }

    private boolean isAtStartOfLine = true;

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            Log.d(TAG, "onConnectionStateChange: status=" + status + " newState=" + newState);
            
            if (status != BluetoothGatt.GATT_SUCCESS) {
                String errorMsg = "GATT_ERROR: " + decodeGattStatus(status);
                
                sendToJs(errorMsg + ". Resetting...");
                isConnecting = false;
                isConnected = false;
                
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    gatt.close();
                }
                if (gatt == bluetoothGatt) {
                    bluetoothGatt = null;
                }
                evaluateJs("window.onNativeBleStatus('error')");
                return;
            }

            if (newState == BluetoothProfile.STATE_CONNECTED) {
                isConnecting = false;
                isConnected = true;
                sendToJs("LINK: Handshake initiated.");
                
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    // Request high priority for better stability during discovery
                    gatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH);
                    
                    // Delay MTU to allow internal stack preparation
                    mainHandler.postDelayed(() -> {
                        if (bluetoothGatt != null && ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                            sendToJs("LINK: Requesting MTU...");
                            boolean success = bluetoothGatt.requestMtu(512);
                            if (!success) {
                                sendToJs("WARN: MTU request rejected. Discovering services with default MTU...");
                                mainHandler.postDelayed(() -> {
                                    if (bluetoothGatt != null && ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                                        bluetoothGatt.discoverServices();
                                    }
                                }, 600);
                            }
                        }
                    }, 800); // Increased delay for stack stability
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                isConnecting = false;
                isConnected = false;
                sendToJs("LINK: Terminated.");
                evaluateJs("window.onNativeBleStatus('disconnected')");
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    gatt.close();
                }
                if (gatt == bluetoothGatt) {
                    bluetoothGatt = null;
                }
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            sendToJs("LINK: MTU Synced to " + mtu + " bytes.");
            // Crucial: Wait before discovering services after MTU change
            mainHandler.postDelayed(() -> {
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    sendToJs("LINK: Discovering services...");
                    gatt.discoverServices();
                }
            }, 600); // Increased delay
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                sendToJs("LINK: Services Discovered.");
                BluetoothGattService service = gatt.getService(UART_SERVICE_UUID);
                BluetoothGattCharacteristic txChar = null;
                
                if (service != null) {
                    txChar = service.getCharacteristic(TX_CHAR_UUID);
                } else {
                    sendToJs("WARN: NUS Service not found. Trying HM-10...");
                    service = gatt.getService(HM10_SERVICE_UUID);
                    if (service != null) {
                        txChar = service.getCharacteristic(HM10_CHAR_UUID);
                    }
                }

                if (service != null && txChar != null) {
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        gatt.setCharacteristicNotification(txChar, true);
                        BluetoothGattDescriptor descriptor = txChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG);
                        if (descriptor != null) {
                            descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                            boolean success = gatt.writeDescriptor(descriptor);
                            if (!success) {
                                sendToJs("ERROR: Failed to initiate descriptor write.");
                            } else {
                                sendToJs("BRIDGE: Configuring notifications...");
                            }
                        }
                    }
                } else {
                    sendToJs("ERROR: No compatible UART Service found. Available services:");
                    for (BluetoothGattService s : gatt.getServices()) {
                        sendToJs(" - " + s.getUuid().toString());
                    }
                }
            } else {
                sendToJs("ERROR: Service discovery failed with status " + status);
            }
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt gatt, BluetoothGattDescriptor descriptor, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                if (CLIENT_CHARACTERISTIC_CONFIG.equals(descriptor.getUuid())) {
                    sendToJs("BRIDGE: Live stream active.");
                    String deviceName = null;
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        deviceName = gatt.getDevice().getName();
                    }
                    if (deviceName == null) deviceName = "Unknown BLE";
                    evaluateJs("window.onNativeBleStatus('connected', '" + deviceName + "')");
                }
            } else {
                sendToJs("ERROR: Descriptor write failed with status " + status);
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, @NonNull BluetoothGattCharacteristic characteristic) {
            UUID uuid = characteristic.getUuid();
            if (TX_CHAR_UUID.equals(uuid) || HM10_CHAR_UUID.equals(uuid)) {
                byte[] val = characteristic.getValue();
                if (val != null) {
                    double arrivalTime = SystemClock.elapsedRealtimeNanos() / 1000000.0;
                    String data = new String(val, java.nio.charset.StandardCharsets.UTF_8);
                    
                    synchronized (bleDataBuffer) {
                        if (isAtStartOfLine) {
                            // Send high-precision timestamp using US locale to ensure dot decimal separator
                            bleDataBuffer.append("TS:").append(String.format(java.util.Locale.US, "%.3f", arrivalTime)).append("\n");
                        }
                        bleDataBuffer.append(data);
                        isAtStartOfLine = data.endsWith("\n") || data.endsWith("\r");
                    }
                    
                    long currentTime = SystemClock.elapsedRealtime();
                    if (currentTime - lastBleFlushTime >= BLE_FLUSH_INTERVAL_MS) {
                        flushBleDataToJs();
                        lastBleFlushTime = currentTime;
                    }
                }
            }
        }

        private void flushBleDataToJs() {
            final String dataToFlush;
            synchronized (bleDataBuffer) {
                if (bleDataBuffer.length() == 0) return;
                dataToFlush = bleDataBuffer.toString();
                bleDataBuffer.setLength(0);
            }

            runOnUiThread(() -> {
                if (webView != null) {
                    String escaped = dataToFlush.replace("\\", "\\\\")
                                               .replace("'", "\\'")
                                               .replace("\n", "\\n")
                                               .replace("\r", "");
                    webView.evaluateJavascript("if(window.onNativeBleData){window.onNativeBleData('" + escaped + "');}", null);
                }
            });
        }
    };

    private void sendToJs(String msg) { 
        Log.d(TAG, "JS_LOG: " + msg);
        evaluateJs("window.onNativeBleLog('" + msg.replace("'", "\\'") + "')"); 
    }
    private void evaluateJs(String script) { 
        runOnUiThread(() -> { 
            if (webView != null) {
                Log.d(TAG, "Evaluating JS: " + script);
                webView.evaluateJavascript(script, null); 
            }
        }); 
    }

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
        public void requestLogFile(String suggestedName) {
            runOnUiThread(() -> {
                pendingFileData = ""; // Ensure we are in streaming mode
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_TITLE, suggestedName);
                createFileLauncher.launch(intent);
            });
        }

        @JavascriptInterface
        public void appendLogData(String data) {
            if (activeLogOutputStream != null) {
                try {
                    activeLogOutputStream.write(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    activeLogOutputStream.flush(); // Flush after each batch for data integrity
                } catch (Exception e) {
                    Log.e(TAG, "Append Error: " + e.getMessage());
                }
            }
        }

        @JavascriptInterface
        public void closeLogFile() {
            if (activeLogOutputStream != null) {
                try {
                    activeLogOutputStream.flush();
                    activeLogOutputStream.close();
                } catch (Exception ignored) {}
                activeLogOutputStream = null;
            }
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Log Saved", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void saveFile(String data, String fileName) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(Uri.parse("content://media/external/downloads"), v);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) { os.write(data.getBytes(java.nio.charset.StandardCharsets.UTF_8)); os.flush(); onSaveComplete(fileName); }
                        }
                    }
                } else {
                    File path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!path.exists()) path.mkdirs();
                    File file = new File(path, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) { fos.write(data.getBytes(java.nio.charset.StandardCharsets.UTF_8)); fos.flush(); }
                    MediaScannerConnection.scanFile(MainActivity.this, new String[]{file.getAbsolutePath()}, null, null);
                    onSaveComplete(fileName);
                }
            } catch (Exception e) { sendToJs("FILE_ERROR: " + e.getMessage()); }
        }

        @JavascriptInterface
        public void saveFileWithPicker(String data, String fileName, String mimeType) {
            runOnUiThread(() -> {
                pendingFileData = data;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mimeType);
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                createFileLauncher.launch(intent);
            });
        }

        private void onSaveComplete(String fileName) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Exported: " + fileName, Toast.LENGTH_SHORT).show());
        }
    }

    private String decodeGattStatus(int status) {
        switch (status) {
            case 0: return "GATT_SUCCESS";
            case 2: return "GATT_READ_NOT_PERMITTED";
            case 3: return "GATT_WRITE_NOT_PERMITTED";
            case 5: return "GATT_INSUFFICIENT_AUTHENTICATION";
            case 6: return "GATT_REQUEST_NOT_SUPPORTED";
            case 7: return "GATT_INVALID_OFFSET";
            case 8: return "GATT_INSUFFICIENT_AUTHORIZATION (Timeout)";
            case 13: return "GATT_INVALID_ATTRIBUTE_LENGTH";
            case 15: return "GATT_INSUFFICIENT_ENCRYPTION";
            case 19: return "GATT_CONN_TERMINATED_BY_PEER";
            case 22: return "GATT_CONN_TERMINATED_BY_LOCAL_HOST";
            case 34: return "GATT_CONN_LMP_TIMEOUT";
            case 62: return "GATT_CONN_FAILED_ESTABLISHMENT";
            case 133: return "GATT_ERROR (133 - Stack Busy/Internal Failure)";
            case 257: return "GATT_FAILURE";
            default: return "GATT_STATUS_CODE_" + status;
        }
    }
}
