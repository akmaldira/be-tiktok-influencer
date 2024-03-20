import CustomError from "./base-error.exception";

export default class BadRequestError extends CustomError {
  private static readonly _statusCode = 400;
  private readonly _code: number;
  private readonly _logging: boolean;

  constructor(params?: {
    code?: number;
    message?: string;
    logging?: boolean;
    context?: { [key: string]: any };
  }) {
    const { code, message, logging } = params || {};

    super(message || "Bad request");
    this._code = code || BadRequestError._statusCode;
    this._logging = logging || false;

    Object.setPrototypeOf(this, BadRequestError.prototype);
  }

  get error() {
    return { message: this.message };
  }

  get statusCode() {
    return this._code;
  }

  get logging() {
    return this._logging;
  }
}
