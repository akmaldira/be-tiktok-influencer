import bcrypt from "bcrypt";
import { appConfig } from "config/env";
import UserEntity from "database/entities/user.entity";
import BadRequestError from "exceptions/bad-request.exception";
import { Request, Response } from "express";
import { sign } from "jsonwebtoken";
import {
  loginCredentialBodySpec,
  registerCredentialBodySpec,
} from "payload/request/auth.request";
import BaseResponse from "payload/response/base-response";
import tryCatchController from "utils/try-catch-controller";
import { parse } from "valibot";

export const loginController = tryCatchController(
  async (req: Request, res: Response) => {
    const body = parse(loginCredentialBodySpec, req.body);
    const user = await UserEntity.findOne({
      where: { email: body.email },
    });
    if (!user) {
      throw new BadRequestError({
        message: "Email or password is incorrect.",
      });
    }

    if (!user.password) {
      throw new BadRequestError({
        message: "Please login using your social account",
      });
    }

    const validPassword = await bcrypt.compare(body.password, user.password);

    if (!validPassword) {
      throw new BadRequestError({
        message: "Email or password is incorrect.",
      });
    }

    const token = sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      appConfig.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const response = BaseResponse.success({
      name: user.name,
      token,
    });

    return res.json(response);
  },
);

export const registerController = tryCatchController(
  async (req: Request, res: Response) => {
    const body = parse(registerCredentialBodySpec, req.body);
    const existingEmail = await UserEntity.findOne({
      where: { email: body.email },
    });

    if (existingEmail) {
      throw new BadRequestError({
        message: "Email already exists.",
      });
    }

    const hashPassword = await bcrypt.hash(body.password, 10);
    const user = UserEntity.create({
      name: body.name,
      email: body.email,
      password: hashPassword,
    });
    await user.save();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;

    const response = BaseResponse.success(result);

    return res.status(201).json(response);
  },
);

export const authUserController = tryCatchController(
  async (req: Request, res: Response) => {
    const user = await UserEntity.findOneOrFail({
      where: { id: req.user!.id },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    const response = BaseResponse.success(result);
    return res.json(response);
  },
);
