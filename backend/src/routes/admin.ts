import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireAdmin } from "../middleware/auth.ts";
import * as adminController from "../controllers/admin.controller.ts";
import * as adminUserController from "../controllers/adminUser.controller.ts";
import { ALLOWED_MIMETYPES } from "../dto/admin.dto.ts";
import { DOCS_MAX_SIZE_MB } from "../config/env.ts";
import { DOCS_DIR, ensureDocsDir } from "../services/admin.service.ts";

ensureDocsDir();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DOCS_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: DOCS_MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Format file tidak didukung: ${file.mimetype}`));
    }
  },
});

const router = Router();

router.post("/documents",              requireAuth, requireAdmin, upload.single("file"), adminController.uploadDocument);
router.get("/documents",               requireAuth, requireAdmin, adminController.getDocuments);
router.post("/documents/:id/reindex",  requireAuth, requireAdmin, adminController.reindexDocument);
router.delete("/documents/:id",        requireAuth, requireAdmin, adminController.deleteDocument);
router.patch("/documents/:id/status",  adminController.updateDocumentStatus);

router.get("/users",               requireAuth, requireAdmin, adminUserController.getUsers);
router.patch("/users/:id/status",  requireAuth, requireAdmin, adminUserController.toggleUserStatus);
router.patch("/users/:id/role",    requireAuth, requireAdmin, adminUserController.updateUserRole);

export default router;
