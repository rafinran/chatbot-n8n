import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

import { env } from "./config/env.ts";
import prisma from "./db.ts";
import authRouter  from "./routes/auth.ts";
import chatRouter  from "./routes/chat.ts";
import adminRouter from "./routes/admin.ts";
import reportRouter from "./routes/report.ts";

const app: Express = express();

const ALLOWED_ORIGINS = env.frontendUrl.split(",").map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (curl, Postman, internal Docker)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} tidak diizinkan.`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  optionsSuccessStatus: 204,
}));

app.use(express.json());
app.use(cookieParser());

// Static serving untuk upload gambar chat (7 hari retensi)
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/auth",  authRouter);
app.use("/api/chat",  chatRouter);
app.use("/api/admin", adminRouter);
app.use("/api/reports", reportRouter);

app.get("/api/health", async (_req: Request, res: Response): Promise<void> => {
  const checks: Record<string, string> = {
    database: "ok",
    indexer:  "ok",
  };

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch {
    checks.database = "error";
  }

  try {
    const r = await fetch(`${env.indexerUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) checks.indexer = "error";
  } catch {
    checks.indexer = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json({ status: allOk ? "ok" : "degraded", checks });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  console.error(`[ERROR] ${status}:`, message);
  res.status(status).json({ error: message });
});

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`✅ Backend running on port ${env.port}`);
});

// ── Keep-alive ping to n8n webhook (every 5 minutes) to prevent cold start ──
const N8N_KEEPALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes

function pingN8nWebhook() {
  fetch(env.n8nWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "[KEEPALIVE]",
      user_id: "0",
      user_email: "system@keepalive",
    }),
  }).catch((err) => {
    // Silently fail - this is just a keep-alive ping
    console.warn("[KEEPALIVE] n8n ping failed:", err.message);
  });
}

// Start keep-alive after server is running
setTimeout(() => {
  console.log("[KEEPALIVE] Starting n8n webhook keep-alive pings (every 5 minutes)");
  pingN8nWebhook();
  setInterval(pingN8nWebhook, N8N_KEEPALIVE_INTERVAL);
}, 5000);

// ── Cleanup upload gambar > 7 hari ──
const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // setiap 6 jam
function cleanUploads() {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  try {
    fs.readdirSync(UPLOAD_DIR).forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      if (Date.now() - fs.statSync(filePath).mtimeMs > SEVEN_DAYS) {
        fs.unlinkSync(filePath);
      }
    });
  } catch { /* ignore */ }
}
setTimeout(() => {
  console.log("[CLEANUP] Starting upload cleanup (every 6 hours, files > 7 days)");
  cleanUploads();
  setInterval(cleanUploads, CLEANUP_INTERVAL);
}, 10_000);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
