import express      from "express";
import cors         from "cors";
import cookieParser from "cookie-parser";
import dotenv       from "dotenv";
import authRouter   from "./routes/auth.js";
import chatRouter   from "./routes/chat.js";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin:      process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, "0.0.0.0" ,() => {
  console.log(`✅ Backend running on port ${PORT}`)
});
