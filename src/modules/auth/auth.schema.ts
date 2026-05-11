import { z } from "zod";
import { Role } from "../../types/enums";

export const RegisterDto = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain a number"),
  role: z.enum([Role.PATIENT, Role.DOCTOR]).default(Role.PATIENT),
});

export const LoginDto = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const VerifyEmailDto = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const ResendOtpDto = z.object({
  email: z.string().email(),
});

export const ForgetPasswordDto = z.object({
  email: z.string().email(),
});

export const ResetPasswordDto = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain a number"),
});

export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain a number"),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;
export type ChangePasswordDtoType = z.infer<typeof ChangePasswordDto>;
