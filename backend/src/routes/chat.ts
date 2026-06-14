import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.ts";
import * as chatController from "../controllers/chat.controller.ts";
import { UPLOAD_MAX_SIZE_MB } from "../config/env.ts";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Hapus file upload lama (> 1 jam) saat server start
(function cleanOldUploads() {
  const ONE_HOUR = 60 * 60 * 1000;
  try {
    fs.readdirSync(UPLOAD_DIR).forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      if (Date.now() - fs.statSync(filePath).mtimeMs > ONE_HOUR) {
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
router.post("/",        requireAuth, upload.single("image"), chatController.sendMessage);
router.get("/history",  requireAuth, chatController.getHistory);

// Conversation management
router.get("/conversations",           requireAuth, chatController.listConversations);
router.post("/conversations",          requireAuth, chatController.createConversation);
router.delete("/conversations/:id",    requireAuth, chatController.deleteConversation);
router.patch("/conversations/:id",     requireAuth, chatController.updateConversationTitle);

// Deprecated: clearHistory for backward compatibility (now deletes active conversation)
router.delete("/history", requireAuth, chatController.clearHistory);

export default router;
