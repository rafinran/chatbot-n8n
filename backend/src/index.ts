import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js";
import chatRouter from "./routes/chat.js";

dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || "8000", 10);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:80",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    optionsSuccessStatus: 204
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);

app.get("/api/health", (_: Request, res: Response): void => {
  res.json({ status: "ok" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
