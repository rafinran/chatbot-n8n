import type { Request, Response } from "express";
import * as authService from "../services/auth.service.ts";
import type { RegisterDto, LoginDto } from "../dto/auth.dto.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

export const register = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { username, email, fullName, password } = req.body as RegisterDto;

  if (!username || !email || !fullName || !password) {
    return res.status(400).json({ error: "Semua field wajib diisi." });
  }

  const user = await authService.registerUser({ username, email, fullName, password });
  const token = authService.signToken(user.id, user.username);
  authService.setAuthCookie(res, token);

  res.status(201).json({
    message: "Registrasi berhasil.",
    user: authService.formatUser(user),
  });
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { username, password } = req.body as LoginDto;

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi." });
  }

  const user = await authService.loginUser({ username, password });
  const token = authService.signToken(user.id, user.username);
  authService.setAuthCookie(res, token);

  res.json({ message: "Login berhasil.", user: authService.formatUser(user) });
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await authService.logoutUser(req.user.id);
  res.clearCookie("access_token");
  res.json({ message: "Logout berhasil." });
});

export const me = asyncHandler((req: Request, res: Response): void => {
  res.json(authService.formatUser(req.user));
});
