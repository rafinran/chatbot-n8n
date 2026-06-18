import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.ts";
import { imageUploadLimit } from "../middleware/rateLimitImage.ts";
import * as chatController from "../controllers/chat.controller.ts";
import { UPLOAD_MAX_SIZE_MB } from "../config/env.ts";

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip || "unknown",
  message: { error: "Terlalu banyak permintaan. Silakan tunggu sebentar." },
});

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Hapus file upload lama (> 7 hari) saat server start
(function cleanOldUploads() {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  try {
    fs.readdirSync(UPLOAD_DIR).forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      if (Date.now() - fs.statSync(filePath).mtimeMs > SEVEN_DAYS) {
        fs.unlinkSync(filePath);
      }
    });
  } catch { /* ignore */ }
})();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: UPLOAD_MAX_SIZE_MB * 1024 * 1024 },
});

const router = Router();

// Chat messaging
router.post("/", requireAuth, chatLimiter, imageUploadLimit, upload.single("image"), chatController.sendMessage);
router.post("/stream", requireAuth, chatLimiter, imageUploadLimit, upload.single("image"), chatController.sendMessageStream);
router.get("/history", requireAuth, chatController.getHistory);

// Conversation management
router.get("/conversations", requireAuth, chatController.listConversations);
router.post("/conversations", requireAuth, chatController.createConversation);
router.delete("/conversations/:id", requireAuth, chatController.deleteConversation);
router.patch("/conversations/:id", requireAuth, chatController.updateConversationTitle);

// Deprecated: clearHistory for backward compatibility (now deletes active conversation)
router.delete("/history", requireAuth, chatController.clearHistory);

// Manual escalation from thumbs down
router.post("/escalate", requireAuth, chatController.escalateChat);

export default router;

