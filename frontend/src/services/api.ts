import type { Feature, FeatureCollection, Geometry } from 'geojson';
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
  const { data } = await client.get<UserProfile>('/user-service/api/v1/users/me');
  return data;
};

export const fetchAlerts = async () => {
  try {
    const { data } = await client.get('/map-service/api/v1/alerts');
    return data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

export const fetchRegions = async (userId: string) => {
  const { data } = await client.get<Region[]>(`/map-service/api/v1/regions/${userId}`);
  return data;
};

export interface CityProperties {
  name: string;
  state: string;
  cwa?: string;
}

export type CityFeature = Feature<Geometry, CityProperties>;

export type CityFeatureCollection = FeatureCollection<Geometry, CityProperties>;

export interface ConditionSubscription {
  id: number;
  user_id: string;
  label: string;
  condition_type: 'temperature_hot' | 'temperature_cold' | 'precipitation' | 'wind';
  threshold_value: number;
  threshold_unit: string;
  comparison: string;
  latitude: number;
  longitude: number;
  radius_km?: number | null;
  channel_overrides: Record<string, boolean>;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string | null;
}

export const listConditionSubscriptions = async (userId: string) => {
  const { data } = await client.get<ConditionSubscription[]>(
    `/custom-alerts/api/v1/conditions/subscriptions/${userId}`,
  );
  return data;
};

export interface ConditionSubscriptionCreatePayload {
  user_id: string;
  label?: string;
  condition_type: ConditionSubscription['condition_type'];
  latitude: number;
  longitude: number;
  threshold_value?: number;
  threshold_unit?: string;
  comparison?: string;
  channel_overrides?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
  radius_km?: number;
}

export interface ConditionSubscriptionUpdatePayload {
  label?: string;
  threshold_value?: number;
  threshold_unit?: string;
  comparison?: string;
  channel_overrides?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}

export const createConditionSubscription = async (
  payload: ConditionSubscriptionCreatePayload,
) => {
  const { data } = await client.post<ConditionSubscription>(
    '/custom-alerts/api/v1/conditions/subscriptions',
    payload,
  );
  return data;
};

export const updateConditionSubscription = async (
  id: number,
  payload: ConditionSubscriptionUpdatePayload,
) => {
  const { data } = await client.put<ConditionSubscription>(
    `/custom-alerts/api/v1/conditions/subscriptions/${id}`,
    payload,
  );
  return data;
};

export const deleteConditionSubscription = async (id: number) => {
  await client.delete(`/custom-alerts/api/v1/conditions/subscriptions/${id}`);
};

export const runConditionEvaluation = async (dryRun = true) => {
  const { data } = await client.post<{ triggered: number }>(
    `/custom-alerts/api/v1/conditions/run?dry_run=${dryRun ? 'true' : 'false'}`,
  );
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
  const { data } = await client.post<Region>('/map-service/api/v1/regions', payload);
  return data;
};

export const updateRegion = async (id: number, payload: {
  name?: string;
  area_geojson?: any;
  properties?: Record<string, unknown>;
}) => {
  const { data } = await client.patch<Region>(`/map-service/api/v1/regions/${id}`, payload);
  return data;
};

export const deleteRegion = async (id: number) => {
  await client.delete(`/map-service/api/v1/regions/${id}`);
};

export const listCities = async () => {
  const { data } = await client.get<CityFeatureCollection>('/map-service/api/v1/cities');
  return data;
};

export default client;

export interface Region {
  id: number;
  user_id: string;
  name?: string;
  area_geojson: any;
  properties?: Record<string, unknown>;
  created_at: string;
}

export interface AlertHistoryItem {
  id: number;
  user_id: string;
  title: string;
  summary?: string | null;
  severity?: string | null;
  source: string;
  source_id?: string | null;
  channels: Record<string, boolean>;
  triggered_at: string;
  created_at: string;
  payload?: Record<string, unknown> | null;
}

export interface AlertHistoryResponse {
  items: AlertHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export const listAlertHistory = async (params: {
  userId: string;
  page?: number;
  pageSize?: number;
  source?: string;
  severity?: string;
  channel?: string;
  search?: string;
}) => {
  const { userId, page = 1, pageSize = 20, source, severity, channel, search } = params;
  const { data } = await client.get<AlertHistoryResponse>('/map-service/api/v1/alerts/history', {
    params: {
      user_id: userId,
      page,
      page_size: pageSize,
      source,
      severity,
      channel,
      search,
    },
  });
  return data;
};
