export interface DocumentResponseDto {
  id: number;
  originalName: string;
  status: string;
  createdAt: Date;
}

export interface UpdateStatusDto {
  status: "indexed" | "failed";
  errorMessage?: string;
}

export const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);
