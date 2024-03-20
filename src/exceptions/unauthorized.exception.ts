import CustomError from "exceptions/base-error.exception";
export default class UnauthorizedError extends CustomError {
  private static readonly _statusCode = 401;
  private readonly _code: number;
  private readonly _logging: boolean;

  constructor(params?: {
    code?: number;
    message?: string;
    logging?: boolean;
    context?: { [key: string]: any };
  }) {
    const { code, message, logging } = params || {};

    super(message || "Unauthorized");
    this._code = code || UnauthorizedError._statusCode;
    this._logging = logging || false;

    Object.setPrototypeOf(this, UnauthorizedError.prototype);
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
