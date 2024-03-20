import { appConfig } from "config/env";
import { UserRole } from "database/entities/enum";
import ForbiddenError from "exceptions/forbidden.exception";
import UnauthorizedError from "exceptions/unauthorized.exception";
import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";

export default function authorizationMiddleware(roles?: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const bearerToken = req.headers.authorization;
      if (!bearerToken) {
        throw new UnauthorizedError({
          message: "Token is not provided. Please login first.",
        });
      }

      const token = bearerToken.replace("Bearer ", "");

      const user = verify(token, appConfig.JWT_SECRET) as {
        id: string;
        name: string;
        email: string;
        role: UserRole;
      };

      if (roles && !roles.includes(user.role)) {
        throw new ForbiddenError({
          message: "You are not authorized to access this resource",
        });
      }

      req.user = user;
      next();
    } catch (error: any) {
      if (error.name === "JsonWebTokenError") {
        throw new UnauthorizedError({
          message: "Invalid token. Please login again.",
        });
      }
      next(error);
    }
  };
}
