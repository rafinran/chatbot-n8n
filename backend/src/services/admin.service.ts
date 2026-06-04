import fs from "fs";
import path from "path";
import prisma from "../db.ts";
import { env } from "../config/env.ts";
import type { UpdateStatusDto } from "../dto/admin.dto.ts";

export const DOCS_DIR = path.join(process.cwd(), "docs-inbox");

export function ensureDocsDir(): void {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
}

export async function createDocument(file: Express.Multer.File, uploadedById: number) {
  const doc = await prisma.document.create({
    data: {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      status: "processing",
      uploadedById,
    },
  });

  // Pindah file ke folder trigger untuk indexer
  const triggerDir = path.join(DOCS_DIR, `doc_${doc.id}`);
  fs.mkdirSync(triggerDir);
  fs.renameSync(file.path, path.join(triggerDir, file.filename));

  return doc;
}

export async function listDocuments() {
  return prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { username: true, fullName: true } } },
  });
}

export async function deleteDocument(id: number): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw { status: 404, message: "Dokumen tidak ditemukan." };

  // Minta indexer hapus dari Qdrant
  try {
    await fetch(`${env.indexerUrl}/delete/${id}`, { method: "DELETE" });
  } catch (err: any) {
    console.warn("[ADMIN] Indexer delete warning:", err.message);
  }

  await prisma.document.delete({ where: { id } });
}

export async function updateDocumentStatus(id: number, dto: UpdateStatusDto) {
  return prisma.document.update({
    where: { id },
    data: { status: dto.status, errorMessage: dto.errorMessage || null },
  });
}
