import { Request, Response } from "express";
import * as doctorService from "./doctor.service";

export async function getMyDoctorProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const doctor = await doctorService.getMyDoctorProfile(req.user.userId);
  res.status(200).json({ success: true, data: { doctor } });
}

export async function createDoctor(req: Request, res: Response): Promise<void> {
  const doctor = await doctorService.createDoctor(req.user.userId, req.body);
  res.status(201).json({ success: true, data: { doctor } });
}

export async function listDoctors(req: Request, res: Response): Promise<void> {
  const result = await doctorService.listDoctors(req.query as any);
  res.status(200).json({ success: true, data: result });
}

export async function getDoctorById(
  req: Request,
  res: Response,
): Promise<void> {
  const doctor = await doctorService.getDoctorById(req.params.id as string);
  res.status(200).json({ success: true, data: { doctor } });
}

export async function updateDoctor(req: Request, res: Response): Promise<void> {
  const doctor = await doctorService.updateDoctor(
    req.params.id as string,
    req.user.userId,
    req.body,
  );
  res.status(200).json({ success: true, data: { doctor } });
}

export async function verifyDoctor(req: Request, res: Response): Promise<void> {
  const doctor = await doctorService.verifyDoctor(req.params.id as string, req.body);
  res.status(200).json({ success: true, data: { doctor } });
}

export async function getAvailableSlots(
  req: Request,
  res: Response,
): Promise<void> {
  const slots = await doctorService.getAvailableSlots(
    req.params.id as string,
    req.query.date as string,
  );
  res.status(200).json({ success: true, data: { slots } });
}
