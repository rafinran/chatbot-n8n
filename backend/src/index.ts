import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

import { env } from "./config/env.ts";
import authRouter  from "./routes/auth.ts";
import chatRouter  from "./routes/chat.ts";
import adminRouter from "./routes/admin.ts";

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

app.use("/api/auth",  authRouter);
app.use("/api/chat",  chatRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_: Request, res: Response): void => {
  res.json({ status: "ok", env: env.nodeEnv });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  console.error(`[ERROR] ${status}:`, message);
  res.status(status).json({ error: message });
});

app.listen(env.port, "0.0.0.0", () => {
  console.log(`✅ Backend running on port ${env.port}`);
});
