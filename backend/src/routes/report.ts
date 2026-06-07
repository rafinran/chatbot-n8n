import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.ts";
import { sendReport } from "../controllers/report.controller.ts";

const router = Router();

// POST /api/reports/send?type=weekly  (atau ?type=daily)
// Hanya admin yang bisa kirim report
router.post("/send", requireAuth, requireAdmin, sendReport);

export default router;
