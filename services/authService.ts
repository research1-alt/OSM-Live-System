
import { hashPassword } from '../utils/crypto.ts';

// MISSION CRITICAL: Centralized Apps Script Gateway
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcBlWlN6AJC7d3cZ9JKeHiYzLu-8xmnrrziPWQaqVHbzbcy6hvsnGydmfS8tGXWkbBRA/exec';
const STORAGE_VERSION = 'v1.2.0';
export const ALLOWED_DOMAIN = '@omegaseikimobility.com';
export const ADMIN_EMAIL = 'research1@omegaseikimobility.com';

// MISSION CRITICAL: Targeted Spreadsheet Registry
export const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xItnaIxqCiXgP3IOuWxVZlVGRD543WV1IU2r67PEl3w/edit';
export const SPREADSHEET_ID = '1xItnaIxqCiXgP3IOuWxVZlVGRD543WV1IU2r67PEl3w';

export interface User {
  email: string;
  userName: string;
  mobile: string;
  password?: string; // Hashed
}

export const authService = {
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
      const resp = await fetch(`${APPS_SCRIPT_URL}?action=get_user&email=${encodeURIComponent(email)}&sheetId=${SPREADSHEET_ID}`);
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
      const resp = await fetch(`${APPS_SCRIPT_URL}?action=check_session&email=${encodeURIComponent(email)}&sheetId=${SPREADSHEET_ID}`);
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
    formData.append('status', 'SESSION_SYNC');
    formData.append('email', email);
    formData.append('userName', userName);
    formData.append('sessionId', sessionId);
    formData.append('sheetId', SPREADSHEET_ID);
    
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });
  },

  /**
   * Cloud Commitment: Final Registry Save.
   */
  async registerUserInCloud(user: User) {
    const formData = new URLSearchParams();
    formData.append('status', 'VERIFIED_SIGNUP');
    formData.append('email', user.email);
    formData.append('userName', user.userName);
    formData.append('mobile', user.mobile);
    formData.append('password', user.password || ''); 
    formData.append('sheetId', SPREADSHEET_ID);
    
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });
  },

  /**
   * Cloud Logging: Audit Gemini queries and analysis.
   */
  async logQuery(user: User, prompt: string, analysis: string, isUnclear: boolean, sessionId: string) {
    const formData = new URLSearchParams();
    formData.append('status', 'USER_QUERY'); 
    formData.append('email', user.email);
    formData.append('userName', user.userName);
    formData.append('query', prompt);
    formData.append('analysis', analysis);
    formData.append('isUnclear', isUnclear ? 'TRUE' : 'FALSE');
    formData.append('sessionId', sessionId);
    formData.append('sheetId', SPREADSHEET_ID);
    
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
      });
    } catch (error) {
      console.error("Cloud logging failed:", error);
    }
  }
};
