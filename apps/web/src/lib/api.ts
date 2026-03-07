import { ApiClient } from '@budgetguard/api-client/client.js';

const API_BASE_URL = '/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api = new ApiClient(API_BASE_URL, () => accessToken);
