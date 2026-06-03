import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/auth.ts";

const router = Router();

// Folder sementara — Python service yang ambil dari sini
const DOCS_DIR = path.join(process.cwd(), "docs-inbox");
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DOCS_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Format file tidak didukung: ${file.mimetype}`));
    }
  },
});

// POST /api/admin/documents — upload dokumen baru
router.post(
  "/documents",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response): Promise<any> => {
    if (!req.file) {
      return res.status(400).json({ error: "File tidak ditemukan." });
    }

    try {
      const doc = await prisma.document.create({
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          status: "processing",
          uploadedById: req.user.id,
        },
      });

      // Kirim sinyal ke Python indexer via file trigger
      // Python service polling DOCS_DIR dan auto-proses file baru
      // Document ID disimpan di nama folder supaya bisa update status
      const triggerDir = path.join(DOCS_DIR, `doc_${doc.id}`);
      fs.mkdirSync(triggerDir);
      fs.renameSync(req.file.path, path.join(triggerDir, req.file.filename));

      res.status(201).json({
        message: "Dokumen berhasil diupload dan sedang diindeks.",
        document: {
          id: doc.id,
          originalName: doc.originalName,
          status: doc.status,
          createdAt: doc.createdAt,
        },
      });
    } catch (err: any) {
      // Hapus file kalau DB create gagal
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error("[ADMIN] Upload error:", err.message);
      res.status(500).json({ error: "Gagal menyimpan dokumen." });
    }
  }
);

// GET /api/admin/documents — list semua dokumen
router.get(
  "/documents",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { username: true, fullName: true } } },
    });
    res.json({ documents });
  }
);

// DELETE /api/admin/documents/:id — hapus dokumen dari DB dan Qdrant
router.delete(
  "/documents/:id",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid." });

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan." });

    // Minta Python indexer hapus dari Qdrant via internal API
    try {
      const indexerUrl = process.env.INDEXER_URL || "http://indexer:5000";
      await fetch(`${indexerUrl}/delete/${id}`, { method: "DELETE" });
    } catch (err: any) {
      console.warn("[ADMIN] Indexer delete warning:", err.message);
      // Tetap lanjut hapus dari DB meski indexer tidak bisa dijangkau
    }

    await prisma.document.delete({ where: { id } });
    res.json({ message: "Dokumen berhasil dihapus." });
  }
);

// PATCH /api/admin/documents/:id/status — dipanggil Python indexer setelah selesai
router.patch(
  "/documents/:id/status",
  async (req: Request, res: Response): Promise<any> => {
    // Endpoint internal — hanya bisa dipanggil dari dalam Docker network
    // Tidak pakai JWT, tapi pakai shared secret
    const secret = req.headers["x-indexer-secret"];
    if (secret !== process.env.INDEXER_SECRET) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const id = parseInt(String(req.params.id));
    const { status, errorMessage } = req.body;

    if (!["indexed", "failed"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid." });
    }

    await prisma.document.update({
      where: { id },
      data: { status, errorMessage: errorMessage || null },
    });

    res.json({ message: "Status diperbarui." });
  }
);

export default router;
