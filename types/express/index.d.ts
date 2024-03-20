import { UserRole } from "database/entities/enum";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  }
}
