import {
  authUserController,
  loginController,
  registerController,
} from "controllers/auth.controller";
import { Router } from "express";
import authorizationMiddleware from "middlewares/authorization.middleware";

const authRoute = Router();

authRoute.post("/login", loginController);
authRoute.post("/register", registerController);
authRoute.get("/me", authorizationMiddleware(), authUserController);

export default authRoute;
