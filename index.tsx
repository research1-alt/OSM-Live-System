
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global Error Handler for Boot Diagnostics
window.onerror = function(message, source, lineno, colno, error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;color:red;padding:20px;z-index:9999;font-family:monospace;overflow:auto;';
  errorDiv.innerHTML = `
    <h1 style="font-size:14px;font-weight:bold;">BOOT_CRITICAL_FAULT</h1>
    <p style="font-size:12px;">${message}</p>
    <pre style="font-size:10px;margin-top:10px;">${error?.stack || 'No stack trace'}</pre>
    <button onclick="location.reload()" style="margin-top:20px;padding:10px;background:#4f46e5;color:white;border:none;border-radius:5px;">RETRY_BOOT</button>
  `;
  document.body.appendChild(errorDiv);
  return false;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
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
