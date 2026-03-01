import type { KiteSuccessResponse, KiteErrorResponse, KiteErrorType } from '../types/kite.js';

export function successResponse<T>(data: T): KiteSuccessResponse<T> {
  return { status: 'success', data };
}

export function errorResponse(message: string, errorType: KiteErrorType = 'GeneralException'): KiteErrorResponse {
  return { status: 'error', message, error_type: errorType };
}

export function httpStatusForError(errorType: KiteErrorType): number {
  switch (errorType) {
    case 'TokenException':
      return 403;
    case 'InputException':
      return 400;
    case 'OrderException':
      return 400;
    case 'MarginException':
      return 400;
    case 'HoldingException':
      return 400;
    case 'NetworkException':
      return 502;
    case 'DataException':
      return 404;
    case 'GeneralException':
    default:
      return 500;
  }
}
