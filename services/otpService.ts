
/**
 * OTP SERVICE - GATEWAY DISPATCH
 * Manages the communication between the terminal and the Google Email Gateway.
 */
import { SPREADSHEET_ID, APPS_SCRIPT_URL } from './authService.ts';

export const otpService = {
  /**
   * Dispatches the locally generated OTP to the Google Script for email delivery.
   * Uses 'status' = 'OTP_DISPATCHED' to match the provided Apps Script.
   */
  async dispatchOtp(email: string, code: string, userName: string, mobile: string) {
    const formData = new URLSearchParams();
    formData.append('status', 'OTP_DISPATCHED');
    formData.append('email', email);
    formData.append('emailCode', code);
    formData.append('userName', userName);
    formData.append('mobile', mobile);
    formData.append('sheetId', SPREADSHEET_ID);
    
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });
  }
};
