import CustomError from "exceptions/base-error.exception";
export default class ForbiddenError extends CustomError {
  private static readonly _statusCode = 403;
  private readonly _code: number;
  private readonly _logging: boolean;

  constructor(params?: {
    code?: number;
    message?: string;
    logging?: boolean;
    context?: { [key: string]: any };
  }) {
    const { code, message, logging } = params || {};

    super(message || "Forbidden");
    this._code = code || ForbiddenError._statusCode;
    this._logging = logging || false;

    Object.setPrototypeOf(this, ForbiddenError.prototype);
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
