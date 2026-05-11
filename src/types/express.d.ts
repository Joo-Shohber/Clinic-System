import { Role } from "./enums";

export interface JwtPayload {
  userId: string;
  role: Role;
  jti: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user: JwtPayload;
    requestId: string;
  }
}
