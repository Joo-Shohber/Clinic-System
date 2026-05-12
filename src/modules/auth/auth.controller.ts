import { Request, Response } from "express";
import passport from "passport";
import * as authService from "./auth.service";
import getEnv from "../../config/env";
import { IUser } from "../../models/user.model";

const REFRESH_TOKEN_COOKIE = "refreshToken";

function setRefreshTokenCookie(res: Response, token: string): void {
  const env = getEnv();
  const maxAge = parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN);
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
  });
}

function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
}

// ===== Register =====
export async function registerHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await authService.register(req.body);

  if (req.file) {
    await authService.changeProfileImage(result.user.id, req.file.buffer);
  }

  res.status(201).json({ success: true, data: result.message });
}

// ===== Verify Email =====
export async function verifyEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email, otp } = req.body;
  const result = await authService.verifyEmail(email, otp);

  setRefreshTokenCookie(res, result.tokens.refreshToken);
  res.status(200).json({
    success: true,
    data: { user: result.user, accessToken: result.tokens.accessToken },
  });
}

// ===== Resend OTP =====
export async function resendOtpHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await authService.resendOtp(req.body.email);
  res.status(200).json({ success: true, data: result });
}

// ===== Login =====
export async function loginHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);

  setRefreshTokenCookie(res, result.tokens.refreshToken);
  res.status(200).json({
    success: true,
    data: { user: result.user, accessToken: result.tokens.accessToken },
  });
}

// ===== Forget Password =====
export async function forgetPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await authService.forgetPassword(req.body.email);
  res.status(200).json({ success: true, message: "If email exists, OTP sent" });
}

// ===== Reset Password =====
export async function resetPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email, otp, newPassword } = req.body;
  const result = await authService.resetPassword(email, otp, newPassword);
  res.status(200).json({ success: true, data: result });
}

// ===== Refresh Token =====
export async function refreshHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

  if (!refreshToken) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "No refresh token provided" },
    });
    return;
  }

  const result = await authService.refreshTokens(refreshToken);
  setRefreshTokenCookie(res, result.refreshToken);
  res
    .status(200)
    .json({ success: true, data: { accessToken: result.accessToken } });
}

// ===== Logout =====
export async function logoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
  if (refreshToken) await authService.logout(refreshToken);

  clearRefreshTokenCookie(res);
  res.status(200).json({ success: true, message: "Logged out successfully" });
}

// ===== Change Profile Image =====
export async function changeProfileImageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.file) {
    res.status(422).json({
      success: false,
      error: { code: "NO_FILE", message: "No image uploaded" },
    });
    return;
  }

  const result = await authService.changeProfileImage(
    req.user.userId,
    req.file.buffer,
  );
  res.status(200).json({ success: true, data: result });
}

// ===== Change Password =====
export async function changePasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  const result = await authService.changePassword(
    req.user.userId,
    currentPassword,
    newPassword,
  );

  res.status(200).json({ success: true, data: result });
}

// ===== Delete User (Admin) =====
export async function deleteUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await authService.deleteUser(req.params.id as string);
  res.status(200).json({ success: true, data: result });
}

// ===== Google OAuth =====
export const googleAuthHandler = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

export async function googleCallbackHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await authService.googleLogin(req.user as unknown as IUser);
  setRefreshTokenCookie(res, result.tokens.refreshToken);

  res.status(200).json({
    success: true,
    data: { user: result.user, accessToken: result.tokens.accessToken },
  });
}
