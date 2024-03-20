import { appConfig } from "config/env";
import BadRequestError from "exceptions/bad-request.exception";
import CustomError from "exceptions/base-error.exception";
import { NextFunction, Request, Response } from "express";
import BaseResponse from "payload/response/base-response";
import { ValiError } from "valibot";

export default function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof CustomError) {
    const { statusCode, error, logging } = err;
    if (logging || appConfig.DEBUG) {
      console.error(
        JSON.stringify(
          {
            code: err.statusCode,
            error: err.error,
            stack: err.stack,
          },
          null,
          2,
        ),
      );
    }

    const response = BaseResponse.error(error);
    return res.status(statusCode).json(response);
  }

  if (err instanceof ValiError) {
    const errorMessage = err.issues[0].message;

    const badRequestError = new BadRequestError({
      message: errorMessage,
    });

    if (appConfig.DEBUG) {
      console.error(
        JSON.stringify(
          {
            code: 400,
            error: badRequestError.error,
            stack: err.stack,
          },
          null,
          2,
        ),
      );
    }

    const response = BaseResponse.error(badRequestError.error);
    return res.status(400).json(response);
  }

  if (appConfig.DEBUG) {
    console.error(err);
  }

  if (err instanceof Error) {
    const response = BaseResponse.error({ message: err.message });
    return res.status(500).json(response);
  }

  const response = BaseResponse.error({ message: "Something went wrong" });
  return res.status(500).json(response);
}
