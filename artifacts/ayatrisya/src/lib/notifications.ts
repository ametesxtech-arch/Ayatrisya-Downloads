export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'upcoming' | 'completed' | 'missed' | 'failed' | 'info';
  timestamp: string;
  read: boolean;
  taskId?: string;
  actionUrl?: string;
}

export interface NotificationPreferences {
  inApp: boolean;
  desktop: boolean;
  email: boolean;
  sound: boolean;
}

const PREF_KEY = 'ayatrisya-notification-prefs';
const NOTIF_STORE_KEY = 'ayatrisya-in-app-notifications';

export const defaultNotificationPrefs: NotificationPreferences = {
  inApp: true,
  desktop: false,
  email: false,
  sound: true,
};

let listeners: Array<(notifications: AppNotification[]) => void> = [];

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return defaultNotificationPrefs;
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return defaultNotificationPrefs;
    return { ...defaultNotificationPrefs, ...JSON.parse(raw) };
  } catch {
    return defaultNotificationPrefs;
  }
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage full/blocked
  }
}

export function getInAppNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIF_STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveInAppNotifications(notifs: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIF_STORE_KEY, JSON.stringify(notifs.slice(0, 50))); // Keep last 50
    listeners.forEach((fn) => fn(notifs));
  } catch {
    // storage error
  }
}

export function subscribeNotifications(
  fn: (notifications: AppNotification[]) => void
): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
  } catch (err) {
    console.warn('Could not request notification permission:', err);
  }
  return false;
}

export function hasDesktopNotificationPermission(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Dispatches an in-app and (if enabled & granted) desktop notification.
 */
export async function dispatchNotification(
  title: string,
  body: string,
  type: AppNotification['type'] = 'info',
  meta: { taskId?: string; actionUrl?: string } = {}
): Promise<AppNotification> {
  const prefs = getNotificationPreferences();
  const notification: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    body,
    type,
    timestamp: new Date().toISOString(),
    read: false,
    taskId: meta.taskId,
    actionUrl: meta.actionUrl,
  };

  if (prefs.inApp) {
    const existing = getInAppNotifications();
    saveInAppNotifications([notification, ...existing]);
  }

  // Play subtle chime if sound enabled
  if (prefs.sound && typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(type === 'failed' || type === 'missed' ? 330 : 587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio autoplay blocked or not supported
    }
  }

  // Desktop native notification
  if (prefs.desktop && typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Desktop notification display failed:', err);
      }
    }
  }

  return notification;
}

export function markNotificationAsRead(id: string): void {
  const list = getInAppNotifications().map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  saveInAppNotifications(list);
}

export function clearAllNotifications(): void {
  saveInAppNotifications([]);
}
