
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/log-telemetry", (req, res) => {
    const { timestamp, frames } = req.body;
    
    // CONCEPTUAL: This is where you would call the Google Sheets API
    // For now, we log to the console to confirm the background process is working
    console.log(`[SPREADSHEET_SYNC] Received ${frames?.length} frames at ${new Date(timestamp).toISOString()}`);
    
    // In a real implementation:
    // await googleSheetsService.appendRows(frames);
    
    res.json({ status: "synced", count: frames?.length });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Spreadsheet Sync Endpoint: http://localhost:${PORT}/api/log-telemetry`);
  });
}

startServer();
