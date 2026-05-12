import { RequestHandler } from "express";
import { Role } from "../types/enums";
import { AppError } from "../types/errors";

export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next): void => {
    if (!req.user) {
      return next(new AppError("UNAUTHORIZED", 401, "Not authenticated"));
    }

    if (!roles.includes(req.user.role as Role)) {
      return next(
        new AppError(
          "FORBIDDEN",
          403,
          `Access denied. Required role: ${roles.join(" or ")}`,
        ),
      );
    }

    next();
  };
}
