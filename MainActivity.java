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
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.app.PendingIntent;
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
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
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

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import java.util.HashMap;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private BluetoothGatt bluetoothGatt;
    private PowerManager.WakeLock wakeLock;
    private static final int PERMISSION_REQUEST_CODE = 1234;
    private static final String TAG = "OSM_NATIVE_BLE";
    private static final String CHANNEL_ID = "OSM_LIVE_SERVICE";
    private static final int NOTIFICATION_ID = 888;

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
    private final StringBuilder serialDataBuffer = new StringBuilder();
    private final StringBuilder lineBuffer = new StringBuilder();
    private final StringBuilder serialLineBuffer = new StringBuilder();
    private long lastBleFlushTime = 0;
    private long lastSerialFlushTime = 0;
    private static final int BLE_FLUSH_INTERVAL_MS = 8; // 125Hz flush rate for higher resolution
    private static final int SERIAL_FLUSH_INTERVAL_MS = 8; // 125Hz flush rate for serial

    // Persistent stream for real-time logging
    private OutputStream activeLogOutputStream = null;

    // Temporary storage for file data during picker transition
    private String pendingFileData = "";

    // USB Serial Variables
    private UsbManager usbManager;
    private UsbDevice usbDevice;
    private UsbDeviceConnection usbConnection;
    private UsbInterface usbInterface;
    private UsbEndpoint endpointIn;
    private UsbEndpoint endpointOut;
    private boolean isSerialConnected = false;
    private Thread serialReadThread;

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

    private static final String ACTION_USB_PERMISSION = "com.example.osmlive.USB_PERMISSION";
    private PendingIntent permissionIntent;

    private static int lastRequestedBaudRate = 115200;

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (ACTION_USB_PERMISSION.equals(action)) {
                synchronized (this) {
                    UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        if (device != null) {
                            // Permission granted, try connecting again with stored baud rate
                            new NativeSerialBridge().connectSerial(lastRequestedBaudRate);
                        }
                    } else {
                        Log.d(TAG, "permission denied for device " + device);
                        evaluateJs("window.onNativeSerialStatus('error', 'USB Permission Denied')");
                    }
                }
            }
        }
    };

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webView);

        permissionIntent = PendingIntent.getBroadcast(this, 0, new Intent(ACTION_USB_PERMISSION), PendingIntent.FLAG_IMMUTABLE);
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(usbReceiver, filter);
        }

        initBluetooth();
        createNotificationChannel();
        checkAndRequestPermissions();
        setupWebView();

        // Updated to current App URL
        webView.loadUrl("https://ais-dev-etfeddvfdw7dqilh4njlaq-127120545089.asia-southeast1.run.app");
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
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "OSM Live Background Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps the CAN link active during phone calls and background tasks.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    private void startForegroundService() {
        Intent serviceIntent = new Intent(this, OSMBackgroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        
        // Acquire WakeLock to keep CPU running indefinitely while connected
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null && (wakeLock == null || !wakeLock.isHeld())) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OSM:DataCollectionLock");
            // No timeout - we will release it manually on disconnect
            wakeLock.acquire();
            Log.d(TAG, "WakeLock Acquired Indefinitely");
        }
    }

    private void stopForegroundService() {
        Intent serviceIntent = new Intent(this, OSMBackgroundService.class);
        stopService(serviceIntent);
        
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    // Inner class for the background service
    public static class OSMBackgroundService extends Service {
        @Override
        public int onStartCommand(Intent intent, int flags, int startId) {
            Intent notificationIntent = new Intent(this, MainActivity.class);
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

            Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("OSM Live Active")
                    .setContentText("Collecting real-time CAN data...")
                    .setSmallIcon(android.R.drawable.stat_notify_sync)
                    .setContentIntent(pendingIntent)
                    .setOngoing(true)
                    .build();

            startForeground(NOTIFICATION_ID, notification);
            return START_STICKY;
        }

        @Override
        public IBinder onBind(Intent intent) { return null; }
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

                    // 2. Determine filename - Try to extract from contentDisposition or use a smart default
                    String fileName = null;
                    if (contentDisposition != null && contentDisposition.contains("filename=")) {
                        try {
                            fileName = contentDisposition.substring(contentDisposition.indexOf("filename=") + 9).split(";")[0].replace("\"", "");
                        } catch (Exception ignored) {}
                    }

                    if (fileName == null || fileName.isEmpty()) {
                        String extension = mimetype.contains("csv") ? ".csv" : ".trc";
                        fileName = "OSM_LOG_" + System.currentTimeMillis() + extension;
                    }

                    // 3. Save to Downloads folder
                    File path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File file = new File(path, fileName);

                    try (FileOutputStream os = new FileOutputStream(file)) {
                        os.write(fileBytes);
                        os.flush();
                    }

                    // 4. Notify user
                    final String finalFileName = fileName;
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Log Saved to Downloads: " + finalFileName, Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Download Failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
            }
        });

        webView.addJavascriptInterface(new NativeBleBridge(), "NativeBleBridge");
        webView.addJavascriptInterface(new NativeSerialBridge(), "NativeSerialBridge");
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidInterface");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String errorMsg = "BOOT_FAULT: " + error.getDescription();
                    Log.e("OSM_WEBVIEW", errorMsg);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, errorMsg, Toast.LENGTH_LONG).show());
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d("OSM_WEBVIEW", "Page Loaded: " + url);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest r) { runOnUiThread(() -> r.grant(r.getResources())); }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d("OSM_CONSOLE", cm.message() + " -- From line " + cm.lineNumber() + " of " + cm.sourceId());
                return true;
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

    @SuppressWarnings("unused")
    public class NativeSerialBridge {
        @JavascriptInterface
        public void connectSerial(int baudRate) {
            lastRequestedBaudRate = baudRate;
            runOnUiThread(() -> {
                usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
                HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
                
                if (deviceList.isEmpty()) {
                    evaluateJs("window.onNativeSerialStatus('error', 'No USB devices found. Connect ESP32 via OTG.')");
                    return;
                }

                // Try to find a device that looks like a serial port
                usbDevice = null;
                for (UsbDevice device : deviceList.values()) {
                    // Just take the first one for now
                    usbDevice = device;
                    break;
                }

                if (usbDevice == null) {
                    evaluateJs("window.onNativeSerialStatus('error', 'No compatible USB device found')");
                    return;
                }
                
                // Check for permission
                if (!usbManager.hasPermission(usbDevice)) {
                    usbManager.requestPermission(usbDevice, permissionIntent);
                    evaluateJs("window.onNativeSerialStatus('connecting', 'Requesting USB Permission...')");
                    return;
                }

                try {
                    usbConnection = usbManager.openDevice(usbDevice);
                    if (usbConnection == null) {
                        evaluateJs("window.onNativeSerialStatus('error', 'Failed to open USB connection')");
                        return;
                    }

                    // Find the correct interface (one with bulk endpoints)
                    usbInterface = null;
                    endpointIn = null;
                    endpointOut = null;

                    for (int i = 0; i < usbDevice.getInterfaceCount(); i++) {
                        UsbInterface iface = usbDevice.getInterface(i);
                        UsbEndpoint epIn = null;
                        UsbEndpoint epOut = null;

                        for (int j = 0; j < iface.getEndpointCount(); j++) {
                            UsbEndpoint ep = iface.getEndpoint(j);
                            if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                                if (ep.getDirection() == UsbConstants.USB_DIR_IN) epIn = ep;
                                else epOut = ep;
                            }
                        }

                        if (epIn != null && epOut != null) {
                            usbInterface = iface;
                            endpointIn = epIn;
                            endpointOut = epOut;
                            break;
                        }
                    }

                    if (usbInterface == null) {
                        evaluateJs("window.onNativeSerialStatus('error', 'No serial interface found on device')");
                        return;
                    }

                    if (!usbConnection.claimInterface(usbInterface, true)) {
                        evaluateJs("window.onNativeSerialStatus('error', 'Failed to claim USB interface')");
                        return;
                    }

                    // Basic Serial Configuration (CDC ACM)
                    byte[] lineCoding = new byte[] {
                        (byte) (baudRate & 0xFF),
                        (byte) ((baudRate >> 8) & 0xFF),
                        (byte) ((baudRate >> 16) & 0xFF),
                        (byte) ((baudRate >> 24) & 0xFF),
                        0, // 1 stop bit
                        0, // no parity
                        8  // 8 data bits
                    };
                    usbConnection.controlTransfer(0x21, 0x20, 0, 0, lineCoding, lineCoding.length, 1000);
                    // Set DTR and RTS to true (required by many ESP32 boards to start)
                    usbConnection.controlTransfer(0x21, 0x22, 0x03, 0, null, 0, 1000);

                    isSerialConnected = true;
                    startSerialReadThread();
                    evaluateJs("window.onNativeSerialStatus('connected', '')");
                    Log.d(TAG, "Serial Connected: " + usbDevice.getDeviceName() + " @ " + baudRate);
                    
                    // Start background service for USB Serial too
                    startForegroundService();

                } catch (Exception e) {
                    evaluateJs("window.onNativeSerialStatus('error', '" + e.getMessage() + "')");
                }
            });
        }

        @JavascriptInterface
        public void disconnectSerial() {
            runOnUiThread(() -> {
                cleanupSerial();
                stopForegroundService();
                evaluateJs("window.onNativeSerialStatus('disconnected', '')");
            });
        }

        @JavascriptInterface
        public void sendSerialData(String data) {
            if (isSerialConnected && usbConnection != null && endpointOut != null) {
                byte[] bytes = data.getBytes();
                usbConnection.bulkTransfer(endpointOut, bytes, bytes.length, 1000);
            }
        }
    }

    private void startSerialReadThread() {
        serialReadThread = new Thread(() -> {
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO);
            byte[] buffer = new byte[4096]; 
            while (isSerialConnected) {
                int bytesRead = usbConnection.bulkTransfer(endpointIn, buffer, buffer.length, 1000);
                if (bytesRead > 0) {
                    // Capture arrival time as soon as bulkTransfer returns
                    double arrivalTime = SystemClock.elapsedRealtimeNanos() / 1000000.0;
                    String data = new String(buffer, 0, bytesRead, java.nio.charset.StandardCharsets.UTF_8);
                    
                    synchronized (serialDataBuffer) {
                        for (int i = 0; i < data.length(); i++) {
                            char c = data.charAt(i);
                            if (c == '\n' || c == '\r') {
                                if (serialLineBuffer.length() > 0) {
                                    String line = serialLineBuffer.toString().trim();
                                    if (!line.isEmpty()) {
                                        // Append the arrival time of the block this line was part of
                                        serialDataBuffer.append(line).append("|T:").append(String.format(java.util.Locale.US, "%.3f", arrivalTime)).append("\n");
                                    }
                                    serialLineBuffer.setLength(0);
                                }
                            } else {
                                serialLineBuffer.append(c);
                            }
                        }
                    }

                    long currentTime = SystemClock.elapsedRealtime();
                    if (currentTime - lastSerialFlushTime >= SERIAL_FLUSH_INTERVAL_MS) {
                        flushSerialDataToJs();
                        lastSerialFlushTime = currentTime;
                    }
                }
            }
        });
        serialReadThread.start();
    }

    private void flushSerialDataToJs() {
        final String dataToFlush;
        synchronized (serialDataBuffer) {
            if (serialDataBuffer.length() == 0) return;
            dataToFlush = serialDataBuffer.toString();
            serialDataBuffer.setLength(0);
        }

        runOnUiThread(() -> {
            if (webView != null) {
                String escaped = dataToFlush.replace("\\", "\\\\")
                        .replace("'", "\\'")
                        .replace("\n", "\\n")
                        .replace("\r", "");
                webView.evaluateJavascript("if(window.onNativeSerialData){window.onNativeSerialData('" + escaped + "');}", null);
            }
        });
    }

    private void cleanupSerial() {
        isSerialConnected = false;
        if (serialReadThread != null) {
            try { serialReadThread.join(500); } catch (Exception ignored) {}
        }
        if (usbConnection != null) {
            if (usbInterface != null) usbConnection.releaseInterface(usbInterface);
            usbConnection.close();
        }
        usbConnection = null;
        usbInterface = null;
        endpointIn = null;
        endpointOut = null;
    }

    @SuppressWarnings("unused")
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
                
                // Start background service to prevent app from being killed
                runOnUiThread(() -> startForegroundService());

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
                
                // Stop background service
                runOnUiThread(() -> stopForegroundService());
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
                        for (int i = 0; i < data.length(); i++) {
                            char c = data.charAt(i);
                            if (c == '\n' || c == '\r') {
                                if (lineBuffer.length() > 0) {
                                    String line = lineBuffer.toString().trim();
                                    if (!line.isEmpty()) {
                                        // Tag every single line with its exact arrival time
                                        // Format: ORIGINAL_LINE|T:TIMESTAMP
                                        bleDataBuffer.append(line).append("|T:").append(String.format(java.util.Locale.US, "%.3f", arrivalTime)).append("\n");
                                    }
                                    lineBuffer.setLength(0);
                                }
                            } else {
                                lineBuffer.append(c);
                            }
                        }
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

    @SuppressWarnings("unused")
    public class WebAppInterface {
        @JavascriptInterface
        public boolean isNativeApp() { return true; }

        @JavascriptInterface
        public void requestBatteryOptimizationExclusion() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent();
                    String packageName = getPackageName();
                    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                        intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + packageName));
                        startActivity(intent);
                        sendToJs("SYSTEM: Requesting Battery Optimization Exclusion...");
                    } else {
                        sendToJs("SYSTEM: App is already excluded from battery optimizations.");
                    }
                }
            });
        }

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
                String mimeType = fileName.endsWith(".csv") ? "text/csv" : "application/octet-stream";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
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
                
                // Fix for .trc.csv issue: Be more specific about MIME type if it's a wildcard
                String finalMimeType = mimeType;
                if ("*/*".equals(mimeType)) {
                    if (fileName.endsWith(".trc")) finalMimeType = "application/octet-stream";
                    else if (fileName.endsWith(".csv")) finalMimeType = "text/csv";
                }
                
                intent.setType(finalMimeType);
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
