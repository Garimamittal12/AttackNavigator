import type {
  ApiError,
} from '@/types';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8000/api';

export { API_BASE_URL };

export class ApiClientError extends Error {
  status: number;
  detail: string;
  isOffline: boolean;

  constructor(message: string, status: number, isOffline: boolean) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = message;
    this.isOffline = isOffline;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
    });
  } catch {
    throw new ApiClientError(
      'Unable to reach AttackNavigator backend',
      0,
      true,
    );
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errorBody = (await response.json()) as ApiError;
      if (errorBody.detail) detail = errorBody.detail;
    } catch {
      // ignore parse error
    }
    throw new ApiClientError(detail, response.status, false);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiClientError('Invalid response from backend', response.status, false);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new ApiClientError(
      'Unable to reach AttackNavigator backend',
      0,
      true,
    );
  }

  if (!response.ok) {
    let detail = `Upload failed (${response.status})`;
    try {
      const errorBody = (await response.json()) as ApiError;
      if (errorBody.detail) detail = errorBody.detail;
    } catch {
      // ignore
    }
    throw new ApiClientError(detail, response.status, false);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiClientError('Invalid response from backend', response.status, false);
  }
}
