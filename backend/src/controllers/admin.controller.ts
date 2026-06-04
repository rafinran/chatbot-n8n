import type { Request, Response } from "express";
import * as adminService from "../services/admin.service.ts";
import type { UpdateStatusDto } from "../dto/admin.dto.ts";
import { env } from "../config/env.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

export const uploadDocument = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  if (!req.file) {
    return res.status(400).json({ error: "File tidak ditemukan." });
  }

  const doc = await adminService.createDocument(req.file, req.user.id);

  res.status(201).json({
    message: "Dokumen berhasil diupload dan sedang diindeks.",
    document: { id: doc.id, originalName: doc.originalName, status: doc.status, createdAt: doc.createdAt },
  });
});

export const getDocuments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const documents = await adminService.listDocuments();
  res.json({ documents });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid." });

  await adminService.deleteDocument(id);
  res.json({ message: "Dokumen berhasil dihapus." });
});

export const updateDocumentStatus = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const secret = req.headers["x-indexer-secret"];
  if (secret !== env.indexerSecret) {
    return res.status(403).json({ error: "Forbidden." });
  }

  const id = parseInt(String(req.params.id));
  const dto = req.body as UpdateStatusDto;

  if (!["indexed", "failed"].includes(dto.status)) {
    return res.status(400).json({ error: "Status tidak valid." });
  }

  await adminService.updateDocumentStatus(id, dto);
  res.json({ message: "Status diperbarui." });
});
