export type BaseErrorContent = {
  message: string;
  context?: { [key: string]: any };
};

export default abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly error: BaseErrorContent;
  abstract readonly logging: boolean;

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, BaseError.prototype);
  }
}
