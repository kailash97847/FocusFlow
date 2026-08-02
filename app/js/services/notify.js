/**
 * services/notify.js — phase-end notifications (browser only).
 * Strictly progressive enhancement: the app is fully usable without it.
 */

export function createNotifier() {
  const supported = typeof Notification !== 'undefined';

  return {
    supported,
    get permission() {
      return supported ? Notification.permission : 'denied';
    },

    async requestPermission() {
      if (!supported) return 'denied';
      try {
        return await Notification.requestPermission();
      } catch {
        return Notification.permission; // older callback-only impls
      }
    },

    /** Show a notification if permitted. Returns true if shown. */
    notify(title, body) {
      if (!supported || Notification.permission !== 'granted') return false;
      try {
        new Notification(title, {
          body,
          icon: './assets/icon-192.png',
          badge: './assets/icon-192.png',
          tag: 'focusflow-phase', // replace instead of stacking
          silent: true,           // sound handled by audio service
        });
        return true;
      } catch {
        return false; // e.g. Safari on iOS requires SW push — degrade silently
      }
    },
  };
}
