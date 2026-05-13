import { IUser, User } from "../../models/user.model";
import { AppError } from "../../types/errors";
import { REDIS_KEYS } from "../../services/cache.service";
import { createOTP, verifyOTP } from "../../services/otp.service";
import { emailService } from "../../services/email.service";
import { uploadImage, deleteImage } from "../../services/cloudinary.service";
import { JwtPayload } from "../../types/express";
import getEnv from "../../config/env";
import getRedis from "../../config/redis";
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
} from "./token.service";
import { RegisterDtoType, LoginDtoType } from "./auth.schema";

// ===== Register =====

export async function register(dto: RegisterDtoType) {
  const existing = await User.findOne({ email: dto.email });
  if (existing) {
    throw new AppError("EMAIL_TAKEN", 409, "Email already in use");
  }

  const user = await User.create({
    name: dto.name,
    email: dto.email,
    password: dto.password,
    role: dto.role,
  });

  const otp = await createOTP(REDIS_KEYS.otpEmailVerify(user.email));

  await emailService.send(user.email, "email_verification_otp", {
    otp,
    expiresInMinutes: getEnv().OTP_EXPIRES_MINUTES,
  });

  return { user, message: "Verification OTP sent to email" };
}

// ===== Verify Email =====

export async function verifyEmail(email: string, otp: string) {
  await verifyOTP(REDIS_KEYS.otpEmailVerify(email), otp);

  const user = await User.findOneAndUpdate(
    { email },
    { isEmailVerified: true },
    { new: true },
  );

  if (!user) {
    throw new AppError("NOT_FOUND", 404, "User not found");
  }

  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
    },
    tokens: { accessToken, refreshToken },
  };
}

// ===== Resend OTP =====

export async function resendOtp(email: string) {
  const user = await User.findOne({ email });
  if (!user) throw new AppError("NOT_FOUND", 404, "User not found");
  if (user.isEmailVerified) {
    throw new AppError("ALREADY_VERIFIED", 400, "Email already verified");
  }

  const otp = await createOTP(REDIS_KEYS.otpEmailVerify(email));
  await emailService.send(email, "email_verification_otp", {
    otp,
    expiresInMinutes: getEnv().OTP_EXPIRES_MINUTES,
  });

  return { message: "OTP resent successfully" };
}

// ===== Login =====

export async function login(dto: LoginDtoType) {
  const user = await User.findOne({ email: dto.email }).select("+password");
  if (!user) throw new AppError("UNAUTHORIZED", 401, "Invalid credentials");

  if (!user.isEmailVerified) {
    throw new AppError(
      "EMAIL_NOT_VERIFIED",
      403,
      "Please verify your email first",
    );
  }

  const isValid = await user.comparePassword(dto.password);
  if (!isValid) throw new AppError("UNAUTHORIZED", 401, "Invalid credentials");

  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
    },
    tokens: { accessToken, refreshToken },
  };
}

// ===== Forget Password =====

export async function forgetPassword(email: string) {
  const user = await User.findOne({ email });
  if (!user) return;

  const otp = await createOTP(REDIS_KEYS.otpPasswordReset(email));
  await emailService.send(email, "password_reset_otp", {
    otp,
    expiresInMinutes: getEnv().OTP_EXPIRES_MINUTES,
  });
}

// ===== Reset Password =====

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
) {
  await verifyOTP(REDIS_KEYS.otpPasswordReset(email), otp);

  const user = await User.findOne({ email });
  if (!user) throw new AppError("NOT_FOUND", 404, "User not found");

  user.password = newPassword;
  await user.save();

  await revokeAllUserTokens(user.id);

  return { message: "Password reset successful, Please Login" };
}

// ===== Refresh Tokens =====

export async function refreshTokens(refreshToken: string) {
  return rotateRefreshToken(refreshToken);
}

// ===== Logout =====

export async function logout(refreshToken: string) {
  try {
    const decoded = jwt.decode(refreshToken) as {
      userId?: string;
    } | null;
    if (decoded?.userId) {
      const redis = getRedis();
      await redis.del(REDIS_KEYS.allRefreshTokens(decoded.userId));
    }
  } catch {}
}

// ===== Change Profile Image =====

export async function changeProfileImage(userId: string, fileBuffer: Buffer) {
  const user = await User.findById(userId);
  if (!user) throw new AppError("NOT_FOUND", 404, "User not found");

  if (user.profilePhoto.publicId) {
    await deleteImage(user.profilePhoto.publicId);
  }

  const result = await uploadImage(fileBuffer, "clinic/profiles");
  user.profilePhoto = { url: result.secure_url, publicId: result.public_id };
  await user.save();

  return { profilePhoto: user.profilePhoto };
}

// ===== Delete User (Admin) =====

export async function deleteUser(targetUserId: string) {
  const user = await User.findById(targetUserId);
  if (!user) throw new AppError("NOT_FOUND", 404, "User not found");

  if (user.profilePhoto.publicId) {
    await deleteImage(user.profilePhoto.publicId);
  }

  await revokeAllUserTokens(targetUserId);
  await user.deleteOne();

  return { message: "User deleted successfully" };
}

// ===== Change Password =====

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError("NOT_FOUND", 404, "User not found");

  if (!user.password) {
    throw new AppError(
      "NO_PASSWORD",
      400,
      "This account uses Google sign-in. Use forget password to set a password.",
    );
  }

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    throw new AppError(
      "INVALID_PASSWORD",
      400,
      "Current password is incorrect",
    );
  }

  if (currentPassword === newPassword) {
    throw new AppError(
      "SAME_PASSWORD",
      400,
      "New password must be different from current password",
    );
  }

  user.password = newPassword;
  await user.save();

  await revokeAllUserTokens(userId);

  return { message: "Password changed successfully. Please login again." };
}

// ===== Google OAuth =====

export async function googleLogin(user: IUser) {
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });
  const refreshToken = await generateRefreshToken(user._id.toString());

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
    },
    tokens: { accessToken, refreshToken },
  };
}
