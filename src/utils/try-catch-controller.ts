import { NextFunction, Request, Response } from "express";

export default function tryCatchController(
  fn: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void | Response>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
