import type { ApiResponse, ApiError } from '@budgetguard/shared';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public error: ApiError,
  ) {
    super(error.message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  private baseUrl: string;
  private getToken?: () => string | null | Promise<string | null>;

  constructor(
    baseUrl: string,
    getToken?: () => string | null | Promise<string | null>,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
  }

  private async buildHeaders(
    customHeaders?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.buildHeaders(customHeaders);

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error: ApiError = json.error ?? {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'Request failed',
      };
      throw new ApiClientError(response.status, error);
    }

    return json as ApiResponse<T>;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    customHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    let url = path;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }
    return this.request<T>('GET', url, undefined, customHeaders);
  }

  async post<T>(
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, customHeaders);
  }

  async patch<T>(
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, customHeaders);
  }

  async delete<T>(
    path: string,
    customHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, customHeaders);
  }
}
