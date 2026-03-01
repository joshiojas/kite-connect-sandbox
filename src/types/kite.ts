export interface KiteSuccessResponse<T = unknown> {
  status: 'success';
  data: T;
}

export interface KiteErrorResponse {
  status: 'error';
  message: string;
  error_type: KiteErrorType;
}

export type KiteResponse<T = unknown> = KiteSuccessResponse<T> | KiteErrorResponse;

export type KiteErrorType =
  | 'TokenException'
  | 'InputException'
  | 'OrderException'
  | 'MarginException'
  | 'HoldingException'
  | 'NetworkException'
  | 'DataException'
  | 'GeneralException';

export interface KiteSession {
  user_type: string;
  email: string;
  user_name: string;
  user_shortname: string;
  broker: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
  avatar_url: string | null;
  user_id: string;
  api_key: string;
  access_token: string;
  public_token: string;
  enctoken: string;
  refresh_token: string;
  silo: string;
  login_time: string;
  meta: {
    demat_consent: string;
  };
}

export interface KiteUserProfile {
  user_id: string;
  user_type: string;
  email: string;
  user_name: string;
  user_shortname: string;
  broker: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
  avatar_url: string | null;
  meta: {
    demat_consent: string;
  };
}
