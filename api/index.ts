import express from 'express';
import { globalEngine } from '../src/engine/harmonizer.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Ensure engine is initialized
globalEngine.initialize();

// 1. Fetch materials list
app.get('/api/materials', (req, res) => {
  res.json(globalEngine.getMaterials());
});

// 2. Fetch matches candidates list
app.get('/api/matches', (req, res) => {
  res.json(globalEngine.getMatches());
});

// 3. Fetch approved common material mappings
app.get('/api/common-mappings', (req, res) => {
  res.json(globalEngine.getMappings());
});

// 4. Fetch audit log entries
app.get('/api/audit-log', (req, res) => {
  res.json(globalEngine.getAuditLogs());
});

// 5. Fetch dashboard metrics
app.get('/api/stats', (req, res) => {
  res.json(globalEngine.getStats());
});

// 6. Handle Approve / Reject / Needs More Info actions
app.post('/api/review', (req, res) => {
  const { matchId, action, reason, user } = req.body;
  const result = globalEngine.reviewDecision(matchId, action, reason, user);
  if (result.error) {
    return res.status(404).json(result);
  }
  res.json(result);
});

// 7. Custom CSV Upload Endpoint
app.post('/api/upload', (req, res) => {
  const { csvContent } = req.body;
  const result = globalEngine.uploadCsv(csvContent);
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 8. Bulk Approval Endpoint
app.post('/api/admin/bulk-approve', (req, res) => {
  const minConfidence = req.body.minConfidence || 85;
  const result = globalEngine.bulkApprove(minConfidence);
  res.json(result);
});

// 9. Reset Endpoint
app.post('/api/reset', (req, res) => {
  globalEngine.reset();
  res.json({ success: true });
});

export default app;
