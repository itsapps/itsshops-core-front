export type AppErrorOptions = {
  message?: string;
  meta?: Record<string, any>;
  requestId?: string;
};

export class AppError extends Error {
  meta: Record<string, any>;
  requestId?: string;

  constructor({ message = '', meta = {}, requestId }: AppErrorOptions = {}) {
    super(message);

    this.name = new.target.name;
    this.meta = meta;
    this.requestId = requestId;

    // Uncomment if needed in environments that support it
    // if (Error.captureStackTrace) {
    //   Error.captureStackTrace(this, new.target);
    // }
  }
}

export class ClientError extends AppError {}
export class IOError extends AppError {}
export class AuthError extends AppError {}
export class ValidationError extends AppError {}
export class GeneralError extends AppError {}

export type AppErrorType = IOError | AuthError | ValidationError | GeneralError;

