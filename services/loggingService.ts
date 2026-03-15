
import { CANFrame } from '../types';

/**
 * Service to handle background logging of CAN data to a spreadsheet.
 * In a real-world scenario, this would call a backend API that interacts with Google Sheets.
 */
export const loggingService = {
  /**
   * Logs a batch of CAN frames to the spreadsheet.
   * Using batches to reduce network overhead.
   */
  async logFrames(frames: CANFrame[]) {
    if (frames.length === 0) return;

    try {
      // In a real implementation, this URL would be your backend endpoint
      // e.g., process.env.VITE_LOGGING_API_URL
      const response = await fetch('/api/log-telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: Date.now(),
          frames: frames.map(f => ({
            id: f.id,
            dlc: f.dlc,
            data: f.data.join(''),
            timestamp: f.timestamp,
            direction: f.direction
          }))
        }),
      });

      if (!response.ok) {
        console.warn('Logging Service: Failed to sync with spreadsheet.');
      }
    } catch (error) {
      // Silent fail to not interrupt the UI
      console.error('Logging Service Error:', error);
    }
  }
};
