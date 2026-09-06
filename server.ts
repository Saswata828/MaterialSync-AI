import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { globalEngine } from "./src/engine/harmonizer.js";

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Middlewares
  app.use(express.json({ limit: "10mb" }));

  // Initialize harmonization engine
  globalEngine.initialize();

  // API Endpoints
  app.get("/api/materials", (_req, res) => {
    res.json(globalEngine.getMaterials());
  });

  app.get("/api/matches", (_req, res) => {
    res.json(globalEngine.getMatches());
  });

  app.get("/api/common-mappings", (_req, res) => {
    res.json(globalEngine.getMappings());
  });

  app.get("/api/audit-log", (_req, res) => {
    res.json(globalEngine.getAuditLogs());
  });

  app.get("/api/stats", (_req, res) => {
    res.json(globalEngine.getStats());
  });

  app.post("/api/review", (req, res) => {
    const { matchId, action, reason, user } = req.body;
    const result = globalEngine.reviewDecision(matchId, action, reason, user);
    if (result.error) {
      return res.status(404).json(result);
    }
    res.json(result);
  });

  app.post("/api/upload", (req, res) => {
    const { csvContent } = req.body;
    const result = globalEngine.uploadCsv(csvContent);
    if (result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  app.post("/api/admin/bulk-approve", (req, res) => {
    const minConfidence = req.body.minConfidence || 85;
    const result = globalEngine.bulkApprove(minConfidence);
    res.json(result);
  });

  app.post("/api/reset", (_req, res) => {
    globalEngine.reset();
    res.json({ success: true });
  });

  // Vite static file handler or Dev Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MaterialSync AI] Server listening on http://localhost:${PORT}`);
  });
}

startServer();
