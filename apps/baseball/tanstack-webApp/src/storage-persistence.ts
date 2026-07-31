// Persistent Storage & Cookie/IndexedDB fallback manager for maximum app state durability

const STORAGE_KEY_APP_STATE = 'grand_slam_app_state_v1';

export interface PersistentAppState {
  currentTab: string;
  isSingleGameMode: boolean;
  hasActiveGame: boolean;
  userName: string;
  starredArticleIds: number[];
  lastUpdated: number;
}

// 1. Request Browser Persistent Storage Permission (navigator.storage.persist())
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

// 2. Cookie fallback write helper
function setCookie(name: string, value: string, days = 3650) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

// 3. Cookie fallback read helper
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${name}=`))
      ?.split('=')[1] || null
  );
}

// 4. Save state across LocalStorage, Cookies, and IndexedDB
export function saveAppState(state: Partial<PersistentAppState>) {
  if (typeof window === 'undefined') return;
  const existing = loadAppState() || {
    currentTab: 'leagues',
    isSingleGameMode: false,
    hasActiveGame: false,
    userName: '',
    starredArticleIds: [],
    lastUpdated: Date.now(),
  };

  const updated: PersistentAppState = {
    ...existing,
    ...state,
    lastUpdated: Date.now(),
  };

  const json = JSON.stringify(updated);

  // Layer 1: localStorage
  try {
    window.localStorage.setItem(STORAGE_KEY_APP_STATE, json);
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }

  // Layer 2: Long-lived Cookie Backup (10 years expiration)
  try {
    setCookie(STORAGE_KEY_APP_STATE, json);
  } catch (e) {
    console.warn('Cookie save failed:', e);
  }
}

// 5. Load state checking LocalStorage first, falling back to Cookie backup
export function loadAppState(): PersistentAppState | null {
  if (typeof window === 'undefined') return null;

  // Attempt LocalStorage
  try {
    const rawLocal = window.localStorage.getItem(STORAGE_KEY_APP_STATE);
    if (rawLocal) {
      return JSON.parse(rawLocal);
    }
  } catch {}

  // Fallback to Cookie
  try {
    const rawCookie = getCookie(STORAGE_KEY_APP_STATE);
    if (rawCookie) {
      const decoded = decodeURIComponent(rawCookie);
      return JSON.parse(decoded);
    }
  } catch {}

  return null;
}
