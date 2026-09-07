import express from "express";
import path from "path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { globalEngine } from "./src/engine/harmonizer.js";

// Load environment variables from .env
dotenv.config();

// In-memory OTP storage
interface OtpRecord {
  email: string;
  otp: string;
  expiresAt: number;
}
const otpStore = new Map<string, OtpRecord>();

// Helper to configure Nodemailer transporter
function getEmailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASS || "").trim();
  const pass = rawPass.includes(" ") ? rawPass.replace(/\s+/g, "") : rawPass;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Middlewares
  app.use(express.json({ limit: "10mb" }));

  // Initialize harmonization engine
  globalEngine.initialize();

  // Authentication: Send Real OTP to Email
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ success: false, error: "Please provide a valid email address." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, error: "Invalid email format." });
      }

      const transporter = getEmailTransporter();
      if (!transporter) {
        return res.status(500).json({
          success: false,
          error: "Email service not configured. Please define SMTP_USER and SMTP_PASS (e.g. Gmail App Password) in your .env file to send real OTPs."
        });
      }

      // Generate 6-digit cryptographic-style OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      otpStore.set(cleanEmail, {
        email: cleanEmail,
        otp,
        expiresAt
      });

      const senderUser = (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
      const rawFrom = (process.env.SMTP_FROM || "").trim();
      const fromAddress = rawFrom.includes("@")
        ? rawFrom
        : rawFrom
        ? `"${rawFrom}" <${senderUser}>`
        : `"MaterialSync AI Portal" <${senderUser}>`;

      // Dispatch real email via Nodemailer
      await transporter.sendMail({
        from: fromAddress,
        to: cleanEmail,
        subject: `MaterialSync AI - Your Verification Code: ${otp}`,
        text: `Your MaterialSync AI verification code is ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 10px; background-color: #2563eb; color: #ffffff; font-weight: 900; font-size: 20px;">M</div>
              <h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">MaterialSync AI</h2>
              <p style="color: #64748b; font-size: 11px; margin: 0; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">National Standardization Portal</p>
            </div>
            
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Hello,<br><br>
              You requested access to the <strong>MaterialSync AI Portal</strong>. Use the 6-digit verification code below to verify your email and sign in:
            </p>

            <div style="text-align: center; margin: 28px 0;">
              <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 14px 28px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #15803d;">
                  ${otp}
                </span>
              </div>
              <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">Valid for the next 10 minutes</p>
            </div>

            <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin-bottom: 24px;">
              If you did not request this verification code, please disregard this message. Never share your one-time verification code with anyone.
            </p>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                Approved for National Material Harmonization by MoP&NG / Ministry of Power
              </p>
            </div>
          </div>
        `
      });

      console.log(`[MaterialSync Auth] Real OTP successfully sent to ${cleanEmail}`);
      res.json({ success: true, message: `Verification code sent to ${cleanEmail}.` });
    } catch (err: any) {
      console.error("[MaterialSync Auth] Failed to send OTP email:", err);
      res.status(500).json({
        success: false,
        error: `Failed to deliver email: ${err.message || "Unknown mailer error"}`
      });
    }
  });

  // Authentication: Verify OTP
  app.post("/api/auth/verify-otp", (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ success: false, error: "Email and OTP code are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const submittedOtp = otp.toString().trim();

      const record = otpStore.get(cleanEmail);
      if (!record) {
        return res.status(400).json({
          success: false,
          error: "No OTP was requested for this email, or it has expired. Please request a new code."
        });
      }

      if (Date.now() > record.expiresAt) {
        otpStore.delete(cleanEmail);
        return res.status(400).json({
          success: false,
          error: "Verification code has expired. Please request a new code."
        });
      }

      if (record.otp !== submittedOtp) {
        return res.status(400).json({
          success: false,
          error: "Invalid 6-digit verification code. Please check your inbox and try again."
        });
      }

      // Valid OTP: consume it so it cannot be reused
      otpStore.delete(cleanEmail);

      console.log(`[MaterialSync Auth] Real OTP successfully verified for ${cleanEmail}`);
      res.json({
        success: true,
        message: "Email verified successfully.",
        email: cleanEmail
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Internal server error." });
    }
  });

  // Authentication: Check server auth configuration status
  app.get("/api/auth/status", (_req, res) => {
    const user = (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
    const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASS || "").trim();
    res.json({
      smtpConfigured: Boolean(user && pass),
      smtpUser: user ? `${user.substring(0, 3)}***@***` : null
    });
  });

  // Core API Endpoints
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
