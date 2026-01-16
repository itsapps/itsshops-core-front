import {
  CheckoutInputPayload,
  ApiErrorType,
  ApiErrorResponse,
  CheckoutCalculatePayment,
  CheckoutCreatePayment,
  ClientOrderResult,
  ClientOrdersResult,
  LoginResult,
  ConfirmUserResult,
  RecoverPasswordResult,
  ResetPasswordResult,
  LogoutUserResult,
  RegisterUserResult,
  RegisterUserInputPayload,
} from '../../../../shared/shared_types.mjs';
import { AppErrorType, AuthError, ClientError, IOError, ValidationError, GeneralError } from "./browser-errors";
import { clientRetry } from "../../../../shared/retries.mjs";
import { v4 as uuidv4 } from 'uuid';

type GetOrPost = "GET" | "POST";

export type JsonRequestSuccess<T> = {
  success: true;
  data: T;
};

export type JsonRequestFailure = {
  success: false;
  data: AuthError | ClientError | IOError | ValidationError | GeneralError;
};

export type JsonRequestResult<T> = JsonRequestSuccess<T> | JsonRequestFailure;

const createApiError = (data: ApiErrorResponse): AppErrorType => {
  const {type, ...errorData} = data
  switch (type) {
    case ApiErrorType.VALIDATION:
      return new ValidationError(errorData)
    case ApiErrorType.AUTH:
      return new AuthError(errorData)
    case ApiErrorType.IO:
      return new IOError(errorData)
    case ApiErrorType.GENERAL:
      return new GeneralError(errorData)
  }
}
const ensureError = (value: Error | Record<string, any>) => {
  if (value instanceof Error) return new ClientError({message: value.message})

  let stringified = '[Unable to stringify the thrown value]'
  try {
    stringified = JSON.stringify(value)
  } catch {}

  const error = new ClientError({message: stringified})
  return error
}

const jsonRequest = async <T = any>(
  method: GetOrPost,
  urlPath: string,
  payload: Record<string, any> = {}
): Promise<JsonRequestResult<T>> => {
  const requestId = uuidv4().replaceAll("-", "")
  const response = await fetch(urlPath, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Language": document.documentElement.lang,
      'X-Request-ID': requestId,
    },
    ...(method === "POST") && {body: JSON.stringify(payload)}
  });
  
  if (!response.ok) {
    const contentType = response.headers.get('Content-Type')
    if (contentType && contentType.includes('application/json')) {
      const data: ApiErrorResponse = await response.json();
      return {success: false, data: createApiError(data)}
    } else {
      return {success: false, data: new ClientError({message: response.statusText})}
    }
  }
  const data: T = await response.json();
  return {success: true, data}
}

export const retryJson = async <T = any>(
  method: GetOrPost,
  urlPath: string,
  payload: Record<string, any> = {}
): Promise<JsonRequestResult<T>> => {
  try {
    return await clientRetry(() => jsonRequest<T>(method, urlPath, payload));
  } catch (err) {
    const error = ensureError(err as Error)
    return {success: false, data: error}
  }
}

export const loginUser = async (email: string, password: string): Promise<JsonRequestResult<LoginResult>> => {
  return await retryJson('POST', '/api/user/login', {email, password})
};

export const logoutUser = async (): Promise<JsonRequestResult<LogoutUserResult>> => {
  return await retryJson('GET', '/api/user/logout')
};

export const registerUser = async (data: RegisterUserInputPayload): Promise<JsonRequestResult<RegisterUserResult>> => {
  return await retryJson('POST', '/api/user/register', data)
};

export const confirmUser = async (token: string): Promise<JsonRequestResult<ConfirmUserResult>> => {
  return await retryJson('POST', '/api/user/confirm', {token})
};

export const recoverUserPassword = async (email: string, captchaToken?: string): Promise<JsonRequestResult<RecoverPasswordResult>> => {
  return await retryJson('POST', '/api/user/recover', {email, captchaToken})
};

export const resetUserPassword = async (token: string, password: string, type?: string | null): Promise<JsonRequestResult<ResetPasswordResult>> => {
  return await retryJson('POST', '/api/user/reset', {token, password, ...(type && {type})})
};

export const getOrders = async (): Promise<JsonRequestResult<ClientOrdersResult>> => {
  return await retryJson('GET', '/api/user/orders')
};
export const getOrder = async (paymentIntentId: string): Promise<JsonRequestResult<ClientOrderResult>> => {
  return await retryJson('POST', '/api/order', {paymentIntentId})
};

export const calculatePayment = async (data: CheckoutInputPayload): Promise<JsonRequestResult<CheckoutCalculatePayment>> => {
  return await retryJson('POST', '/api/payment/create', {createPayment: false, ...data})
};
export const createPaymentIntent = async (data: CheckoutInputPayload): Promise<JsonRequestResult<CheckoutCreatePayment>> => {
  return await retryJson('POST', '/api/payment/create', {createPayment: true, ...data})
};