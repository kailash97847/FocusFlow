/**
 * services/notify.js — phase-end notifications.
 *
 * Two backends, auto-detected at runtime:
 *   1. Capacitor LocalNotifications (native Android/iOS shell) — supports
 *      scheduled alerts that fire even when the app is backgrounded/killed,
 *      which is exactly what a focus timer needs.
 *   2. Web Notification API (browser PWA) — progressive enhancement only.
 *
 * Everything degrades silently: the in-app chime + ring always fire.
 */

const PHASE_NOTIFICATION_ID = 9001;

export function createNotifier() {
  const cap = globalThis.Capacitor;
  const local = cap?.Plugins?.LocalNotifications ?? null;
  const isNative = !!local;
  const webSupported = typeof Notification !== 'undefined';

  let cachedPermission = webSupported && !isNative ? Notification.permission : 'default';

  /** Best-effort async wrapper — never lets a plugin error reach the app. */
  const safe = (p) => Promise.resolve(p).catch(() => {});

  return {
    supported: isNative || webSupported,
    isNative,
    get permission() {
      return cachedPermission;
    },

    /** Refresh cached permission state (call once at startup). */
    async init() {
      if (isNative) {
        const res = await safe(local.checkPermissions());
        if (res?.display) cachedPermission = res.display === 'granted' ? 'granted' : res.display;
      }
      return cachedPermission;
    },

    async requestPermission() {
      if (isNative) {
        const res = await safe(local.requestPermissions());
        cachedPermission = res?.display === 'granted' ? 'granted' : 'denied';
        return cachedPermission;
      }
      if (!webSupported) return 'denied';
      try {
        cachedPermission = await Notification.requestPermission();
      } catch {
        cachedPermission = Notification.permission;
      }
      return cachedPermission;
    },

    /**
     * Native only: schedule the phase-end alert for an absolute timestamp so
     * it fires even when the WebView is suspended or the process is dead.
     * No-op (safe) on the web backend.
     */
    async schedulePhaseEnd({ at, title, body }) {
      if (!isNative) return false;
      await safe(local.cancel({ notifications: [{ id: PHASE_NOTIFICATION_ID }] }));
      if (cachedPermission !== 'granted') return false;
      await safe(local.schedule({
        notifications: [{
          id: PHASE_NOTIFICATION_ID,
          title,
          body,
          schedule: { at: new Date(at), allowWhileIdle: true },
          smallIcon: 'ic_stat_notify',
          iconColor: '#6366F1',
          channelId: 'focusflow_phases',
        }],
      }));
      return true;
    },

    /** Native only: cancel any pending phase-end alert. */
    async cancelScheduled() {
      if (!isNative) return;
      await safe(local.cancel({ notifications: [{ id: PHASE_NOTIFICATION_ID }] }));
    },

    /** Show a notification right now (phase completion in the foreground). */
    notify(title, body) {
      if (isNative) {
        if (cachedPermission !== 'granted') return false;
        safe(local.schedule({
          notifications: [{
            id: Date.now() % 100000 + 1,
            title,
            body,
            schedule: { at: new Date(Date.now() + 60) },
            smallIcon: 'ic_stat_notify',
            iconColor: '#6366F1',
            channelId: 'focusflow_phases',
          }],
        }));
        return true;
      }
      if (!webSupported || Notification.permission !== 'granted') return false;
      try {
        new Notification(title, {
          body,
          icon: './assets/icon-192.png',
          badge: './assets/icon-192.png',
          tag: 'focusflow-phase',
          silent: true,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}
