import { Router } from "express";
import { requireAuth } from "../middleware/auth.ts";
import * as authController from "../controllers/auth.controller.ts";

const router = Router();

router.post("/register", authController.register);
router.post("/login",    authController.login);
router.post("/logout",   requireAuth, authController.logout);
router.get("/me",        requireAuth, authController.me);

export default router;
