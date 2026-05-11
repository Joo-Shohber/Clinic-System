import { Request, Response } from "express";
import * as adminService from "./admin.service";
import { Role } from "../../types/enums";

export async function getStats(_req: Request, res: Response): Promise<void> {
  const stats = await adminService.getStats();
  res.status(200).json({ success: true, data: stats });
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const {
    role,
    page = "1",
    limit = "10",
  } = req.query as {
    role?: Role;
    page?: string;
    limit?: string;
  };

  const result = await adminService.listUsers({
    role,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.status(200).json({ success: true, data: result });
}

export async function getPendingDoctors(
  _req: Request,
  res: Response,
): Promise<void> {
  const doctors = await adminService.getPendingDoctors();
  res.status(200).json({ success: true, data: { doctors } });
}
