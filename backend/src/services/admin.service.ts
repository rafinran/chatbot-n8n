import fs from "fs";
import path from "path";
import prisma from "../db.ts";
import { env } from "../config/env.ts";
import type { UpdateStatusDto } from "../dto/admin.dto.ts";

export const DOCS_DIR = path.join(process.cwd(), "docs-inbox");
const STORAGE_DIR = path.join(process.cwd(), "documents");

export function ensureDocsDir(): void {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
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

  const triggerDir = path.join(DOCS_DIR, `doc_${doc.id}`);
  fs.mkdirSync(triggerDir);
  const destPath = path.join(triggerDir, file.filename);
  fs.copyFileSync(file.path, destPath);
  fs.writeFileSync(path.join(triggerDir, "meta.txt"), file.originalname);

  const storagePath = path.join(STORAGE_DIR, `${doc.id}_${file.originalname}`);
  fs.copyFileSync(file.path, storagePath);
  fs.unlinkSync(file.path);

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

export async function reindexDocument(id: number, uploadedById: number) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw { status: 404, message: "Dokumen tidak ditemukan." };

  await prisma.document.update({
    where: { id },
    data: { status: "processing", errorMessage: null },
  });

  const triggerDir = path.join(DOCS_DIR, `doc_${doc.id}`);
  fs.mkdirSync(triggerDir, { recursive: true });
  const sourcePath = path.join(STORAGE_DIR, `${doc.id}_${doc.originalName}`);
  if (!fs.existsSync(sourcePath)) {
    await prisma.document.update({
      where: { id },
      data: { status: "failed", errorMessage: "File asli tidak ditemukan di penyimpanan." },
    });
    throw { status: 404, message: "File asli tidak ditemukan di penyimpanan. Silakan upload ulang." };
  }

  const destPath = path.join(triggerDir, doc.originalName);
  fs.copyFileSync(sourcePath, destPath);
  fs.writeFileSync(path.join(triggerDir, "meta.txt"), doc.originalName);
  return doc;
}

