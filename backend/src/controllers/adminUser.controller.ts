import type { Request, Response } from "express";
import * as adminUserService from "../services/adminUser.service.ts";
import { ToggleUserStatusSchema, UpdateUserRoleSchema } from "../dto/admin.dto.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await adminUserService.listUsers();
  res.json({ users });
});

export const toggleUserStatus = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid." });

  const parsed = ToggleUserStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  await adminUserService.toggleUserStatus(id, parsed.data.isActive);
  res.json({ message: "Status user diperbarui." });
});

export const updateUserRole = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid." });

  const parsed = UpdateUserRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  await adminUserService.updateUserRole(id, parsed.data.role);
  res.json({ message: "Role user diperbarui." });
});