import { Router } from "express";
import { requireAuth } from "../middleware/auth.ts";
import * as authController from "../controllers/auth.controller.ts";

const router = Router();

// Existing routes
router.post("/register", authController.register);
router.post("/login",    authController.login);
router.post("/logout",   requireAuth, authController.logout);
router.get("/me",        requireAuth, authController.me);

// Password reset routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password",  authController.resetPassword);

// Email verification routes
router.post("/verify-email",          authController.verifyEmail);
router.post("/resend-verification",   authController.resendVerificationEmail);

export default router;
