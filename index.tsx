
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global Error Handler for Boot Diagnostics
const showBootError = (message: string, stack?: string) => {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'boot-error-overlay';
  errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;color:#1e293b;padding:40px 20px;z-index:9999;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;';
  errorDiv.innerHTML = `
    <div style="background:#fee2e2;color:#991b1b;padding:20px;border-radius:12px;max-width:400px;width:100%;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
      <h1 style="font-size:18px;font-weight:900;margin:0 0 10px 0;letter-spacing:0.05em;">BOOT_CRITICAL_FAULT</h1>
      <p style="font-size:14px;margin:0 0 20px 0;opacity:0.8;line-height:1.5;">${message}</p>
      <div style="text-align:left;background:rgba(0,0,0,0.05);padding:10px;border-radius:6px;font-family:monospace;font-size:10px;overflow:auto;max-height:150px;margin-bottom:20px;">
        ${stack || 'No stack trace available'}
      </div>
      <button onclick="location.reload()" style="width:100%;padding:14px;background:#4f46e5;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;box-shadow:0 4px 6px -1px rgba(79, 70, 229, 0.4);">RETRY_BOOT</button>
      <p style="font-size:10px;margin-top:20px;color:#64748b;">If this persists, please clear app cache or check network connection.</p>
    </div>
  `;
  
  if (!document.getElementById('boot-error-overlay')) {
    document.body.appendChild(errorDiv);
  }
};

window.onerror = function(message, source, lineno, colno, error) {
  const msg = String(message);
  const stack = error?.stack || "";

  // Ignore Vite WebSocket errors which are expected in this environment
  if (msg.includes('WebSocket') || stack.includes('vite/client')) {
    console.warn('Ignoring expected Vite WebSocket error:', msg);
    return false;
  }

  showBootError(msg, stack);
  return false;
};

window.onunhandledrejection = function(event) {
  const reason = event.reason;
  const message = reason?.message || String(reason);
  const stack = reason?.stack || "";

  // Ignore Vite WebSocket errors which are expected in this environment
  if (message.includes('WebSocket') || stack.includes('vite/client')) {
    console.warn('Ignoring expected Vite WebSocket error:', message);
    return;
  }

  showBootError('Unhandled Promise Rejection', stack || message);
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
