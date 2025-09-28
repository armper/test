import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface LoginResponse {
  access_token: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name?: string;
  roles: string[];
  notification_preferences: Record<string, boolean>;
  default_location?: Record<string, unknown>;
}

const client = axios.create({
  baseURL: API_BASE_URL,
});

export const setAuthToken = (token?: string) => {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common.Authorization;
  }
};

export const login = async (email: string, password: string) => {
  const { data } = await client.post<LoginResponse>('/user-service/api/v1/auth/login', {
    email,
    password,
  });
  return data;
};

export const register = async (payload: { email: string; password: string }) => {
  await client.post('/user-service/api/v1/auth/register', payload);
};

export const fetchProfile = async () => {
  const { data } = await client.get<UserProfile>('/user-service/users/me');
  return data;
};

export const fetchAlerts = async () => {
  const { data } = await client.get('/alert-service/alerts');
  return data;
};

export const fetchRegions = async (userId: string) => {
  const { data } = await client.get(`/map-service/regions/${userId}`);
  return data;
};

export const fetchAdminSummary = async () => {
  const { data } = await client.get('/admin-service/summary');
  return data;
};

export const createRegion = async (payload: {
  user_id: string;
  name?: string;
  area_geojson: any;
  properties?: Record<string, unknown>;
}) => {
  const { data } = await client.post('/map-service/regions', payload);
  return data;
};

export const listCities = async () => {
  const { data } = await client.get('/map-service/cities');
  return data;
};

export default client;
