const MUTED_ALERTS_KEY = 'mutedNoaaAlerts';
const PINNED_AREAS_KEY = 'pinnedCustomAreas';

interface MutedEntry {
  id: string;
  mutedUntil: number;
}

export const loadMutedAlerts = (): MutedEntry[] => {
  try {
    const raw = localStorage.getItem(MUTED_ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MutedEntry[];
    const now = Date.now();
    return parsed.filter((entry) => entry.mutedUntil > now);
  } catch (error) {
    console.warn('Failed to read muted alerts from storage', error);
    return [];
  }
};

export const saveMutedAlerts = (entries: MutedEntry[]) => {
  try {
    localStorage.setItem(MUTED_ALERTS_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Failed to persist muted alerts', error);
  }
};

export const muteAlert = (id: string, hours = 24) => {
  const existing = loadMutedAlerts();
  const mutedUntil = Date.now() + hours * 60 * 60 * 1000;
  const filtered = existing.filter((entry) => entry.id !== id);
  filtered.push({ id, mutedUntil });
  saveMutedAlerts(filtered);
  return filtered;
};

export const clearMutedAlerts = () => {
  saveMutedAlerts([]);
};

export const isAlertMuted = (id: string): boolean => {
  return loadMutedAlerts().some((entry) => entry.id === id);
};

export const loadPinnedAreas = (): number[] => {
  try {
    const raw = localStorage.getItem(PINNED_AREAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as number[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read pinned areas from storage', error);
    return [];
  }
};

export const savePinnedAreas = (ids: number[]) => {
  try {
    localStorage.setItem(PINNED_AREAS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.warn('Failed to persist pinned areas', error);
  }
};

export const togglePinnedArea = (id: number) => {
  const existing = loadPinnedAreas();
  const next = existing.includes(id)
    ? existing.filter((item) => item !== id)
    : [...existing, id];
  savePinnedAreas(next);
  return next;
};
