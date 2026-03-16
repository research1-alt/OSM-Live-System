
import { hashPassword } from '../utils/crypto';

// MISSION CRITICAL: Centralized Apps Script Gateway
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbysv4xnhNT1egv9JzV4aRJ3-7kNAUiG-1uAtZDSHXenCL3IS-arVGmg6xz4eBcW0P86fg/exec';
const STORAGE_VERSION = 'v1.2.0';
export const ALLOWED_DOMAIN = '@omegaseikimobility.com';
export const ADMIN_EMAIL = 'research1@omegaseikimobility.com';

// MISSION CRITICAL: Targeted Spreadsheet Registry
export const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1KW0uw5qyQVVFgF6dwaL38lMVRWgYFOwgQvIxjElOe_A/edit?gid=0#gid=0';
export const SPREADSHEET_ID = '1KW0uw5qyQVVFgF6dwaL38lMVRWgYFOwgQvIxjElOe_A';

export interface User {
  email: string;
  userName: string;
  mobile: string;
  password?: string; // Hashed
}

export const authService = {
  /**
   * Robust fetch with retry logic and exponential backoff.
   */
  async safeFetch(url: string, options: any = {}, retries = 3, backoff = 1000): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          mode: options.method === 'POST' ? 'no-cors' : options.mode
        });
        return true;
      } catch (e) {
        console.warn(`Fetch attempt ${i + 1} failed. Retrying in ${backoff}ms...`, e);
        if (i === retries - 1) {
          // If all retries fail, queue the request for later
          this.queueRequest(url, options);
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2;
      }
    }
    return false;
  },

  /**
   * Queues a failed request in localStorage.
   */
  queueRequest(url: string, options: any) {
    try {
      const queueData = localStorage.getItem('osm_sync_queue');
      const queue = JSON.parse(queueData || '[]');
      queue.push({ url, options, timestamp: Date.now() });
      // Limit queue size to 50 items to prevent storage bloat
      if (queue.length > 50) queue.shift();
      localStorage.setItem('osm_sync_queue', JSON.stringify(queue));
    } catch (e) {
      console.error("Failed to queue request:", e);
    }
  },

  /**
   * Processes the sync queue.
   */
  async processQueue() {
    try {
      const queueData = localStorage.getItem('osm_sync_queue');
      const queue = JSON.parse(queueData || '[]');
      if (queue.length === 0) return;

      console.log(`Processing ${queue.length} queued sync requests...`);
      const remainingQueue = [];

      for (const item of queue) {
        try {
          const success = await fetch(item.url, {
            ...item.options,
            mode: item.options.method === 'POST' ? 'no-cors' : item.options.mode
          });
          if (!success) remainingQueue.push(item);
        } catch (e) {
          remainingQueue.push(item);
        }
      }

      localStorage.setItem('osm_sync_queue', JSON.stringify(remainingQueue));
    } catch (e) {
      console.error("Failed to process sync queue:", e);
    }
  },

  /**
   * Identifies if a user has admin privileges.
   */
  isAdmin(email: string): boolean {
    return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
  },

  /**
   * Dual-Layer Check: Cloud First, then Local fallback.
   */
  async fetchUserFromCloud(email: string): Promise<any> {
    try {
      const url = `${APPS_SCRIPT_URL}?action=get_user&email=${encodeURIComponent(email)}&sheetId=${SPREADSHEET_ID}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      return null;
    }
  },

  /**
   * Conflict Detection check for Heartbeat.
   */
  async fetchRemoteSessionId(email: string): Promise<string> {
    try {
      const url = `${APPS_SCRIPT_URL}?action=check_session&email=${encodeURIComponent(email)}&sheetId=${SPREADSHEET_ID}`;
      const resp = await fetch(url);
      if (!resp.ok) return "NOT_FOUND";
      return (await resp.text()).trim();
    } catch (e) {
      return "ERROR";
    }
  },

  /**
   * Cloud Handshake: Syncs the active Session ID.
   */
  async syncSessionToCloud(email: string, userName: string, sessionId: string) {
    const formData = new URLSearchParams();
    formData.append('action', 'SESSION_SYNC');
    formData.append('email', email);
    formData.append('userName', userName);
    formData.append('sessionId', sessionId);
    formData.append('sheetId', SPREADSHEET_ID);
    
    const url = `${APPS_SCRIPT_URL}?${formData.toString()}`;
    await this.safeFetch(url, {
      method: 'POST',
      body: formData
    });
  },

  /**
   * Cloud Commitment: Final Registry Save.
   */
  async registerUserInCloud(user: User) {
    const formData = new URLSearchParams();
    formData.append('action', 'VERIFIED_SIGNUP');
    formData.append('email', user.email);
    formData.append('userName', user.userName);
    formData.append('mobile', user.mobile);
    formData.append('password', user.password || ''); 
    formData.append('sheetId', SPREADSHEET_ID);
    
    const url = `${APPS_SCRIPT_URL}?${formData.toString()}`;
    await this.safeFetch(url, {
      method: 'POST',
      body: formData
    });
  },

  /**
   * Cloud Logging: Audit Gemini queries and analysis.
   */
  async logQuery(user: User, prompt: string, analysis: string, isUnclear: boolean, sessionId: string) {
    const formData = new URLSearchParams();
    formData.append('action', 'USER_QUERY'); 
    formData.append('email', user.email);
    formData.append('userName', user.userName);
    formData.append('query', prompt);
    formData.append('analysis', analysis);
    formData.append('isUnclear', isUnclear ? 'TRUE' : 'FALSE');
    formData.append('sessionId', sessionId);
    formData.append('sheetId', SPREADSHEET_ID);
    
    const url = `${APPS_SCRIPT_URL}?${formData.toString()}`;
    try {
      await this.safeFetch(url, {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.error("Cloud logging failed:", error);
    }
  },

  /**
   * Cloud Logging: Audit Hardware Identification and Activity.
   */
  async logHardwareIdentification(user: User, hardwareId: string, sessionId: string, location: string, status: string = 'CONNECTED') {
    const formData = new URLSearchParams();
    formData.append('action', 'HARDWARE_LOG');
    formData.append('email', user.email);
    formData.append('userName', user.userName);
    formData.append('hardwareId', hardwareId);
    formData.append('hardware_id', hardwareId); // Compatibility alias
    formData.append('location', location);
    formData.append('sessionId', sessionId);
    formData.append('status', status);
    formData.append('sheetId', SPREADSHEET_ID);
    formData.append('timestamp', new Date().toISOString());
    
    const url = `${APPS_SCRIPT_URL}?${formData.toString()}`;
    
    // Use beacon for disconnections to ensure it fires even if tab closes
    if (status === 'DISCONNECTED' && navigator.sendBeacon) {
      navigator.sendBeacon(url, formData);
      return;
    }

    try {
      await this.safeFetch(url, {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.error("Hardware logging failed:", error);
    }
  }
};
