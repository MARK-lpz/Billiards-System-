import { useState, useEffect, useCallback, useRef } from 'react';
import { NotificationContext } from './NotificationContext';
import { apiFetch } from '../../utils/apiFetch';
import { SITE_HOST, APP_API_BASE } from '../../utils/siteAddress';

const NOTIFICATION_API_URL = import.meta.env.VITE_NOTIFICATION_API_URL || (
  !import.meta.env.DEV && window.location.hostname === SITE_HOST
    ? `${APP_API_BASE}notifications.php`
    : '/api/notifications.php'
);

// How often a signed-in screen asks the server for new notices. A tab out of
// sight does not ask at all, and asks at once when it comes back into view.
const POLL_MS = 15000;

// The browser queues older versions kept notices in (one also held guests'
// tournament registration details); emptied wherever they are still left.
const OLD_QUEUE_KEYS = ['adminNotifications', 'employeeNotifications'];

/**
 * The staff bells' notices, kept on the server (api/notifications.php), and the
 * one toast on screen. What the server sends is the list: a notice read or
 * dismissed on another screen, or removed as old, changes here too. Only the
 * signed-in role's notices are kept, so another role signing in on this screen
 * starts from its own.
 */
export function NotificationProvider({
  children,
  canReceiveAdminNotifications = false,
  canReceiveEmployeeNotifications = false,
}) {
  const recipient = canReceiveAdminNotifications ? 'admin' : canReceiveEmployeeNotifications ? 'employee' : null;
  const [received, setReceived] = useState({ recipient: null, list: [] });
  const notifications = received.recipient === recipient ? received.list : [];
  // Read or dismissed here, maybe not yet on the server: a poll in between must not undo it.
  const marked = useRef({ read: new Set(), dismissed: new Set() });
  // The one short pop-up note on screen (see Toast.jsx); a newer one replaces it.
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      OLD_QUEUE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage may be off (private window); there is nothing to empty then.
    }
  }, []);

  useEffect(() => {
    if (!recipient) return undefined;
    // What the last role marked is theirs; both bells share notice ids.
    marked.current = { read: new Set(), dismissed: new Set() };
    // A request still out when the role changes must not fill the next role's bell.
    let active = true;
    const isVisible = () => document.visibilityState !== 'hidden';

    const load = async () => {
      if (!isVisible()) return;
      try {
        const response = await apiFetch(`${NOTIFICATION_API_URL}?recipient=${recipient}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!active || !Array.isArray(data.notifications)) return;

        const { read, dismissed } = marked.current;
        const list = data.notifications
          .filter((notice) => !dismissed.has(notice.id))
          .map((notice) => (read.has(notice.id) ? { ...notice, unread: false } : notice));
        setReceived((previous) =>
          previous.recipient === recipient && JSON.stringify(previous.list) === JSON.stringify(list)
            ? previous
            : { recipient, list }
        );
      } catch (error) {
        console.warn('Unable to load server notifications', error);
      }
    };
    const handleVisibility = () => {
      if (isVisible()) load();
    };

    load();
    const interval = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [recipient]);

  // Marks notices on the server: one request, however many there are.
  const updateRemoteNotifications = (ids, action) => {
    if (!recipient || !ids.length) return;
    ids.forEach((id) => marked.current[action === 'read' ? 'read' : 'dismissed'].add(id));

    apiFetch(NOTIFICATION_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, recipient, action }),
    }).catch((error) => console.warn('Unable to update server notification', error));
  };

  const updateList = (change) =>
    setReceived((previous) => (previous.recipient === recipient ? { recipient, list: change(previous.list) } : previous));

  const markAllAsRead = () => {
    const unreadIds = notifications.filter((notification) => notification.unread).map((notification) => notification.id);
    updateList((list) => list.map((n) => ({ ...n, unread: false })));
    updateRemoteNotifications(unreadIds, 'read');
  };

  const markAsRead = (id) => {
    updateList((list) => list.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    updateRemoteNotifications([id], 'read');
  };

  const deleteNotification = (id) => {
    updateList((list) => list.filter((n) => n.id !== id));
    updateRemoteNotifications([id], 'dismiss');
  };

  // Kept the same between renders: the app re-renders every few seconds as it
  // syncs, and a new dismissToast each time restarted the toast's timer for good.
  const showToast = useCallback((nextToast) => {
    setToast({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...nextToast });
  }, []);

  // By id, so a timer left over from an older toast cannot close a newer one.
  const dismissToast = useCallback((id) => {
    setToast((current) => (current && current.id === id ? null : current));
  }, []);

  // What this user just did ("Coca Cola added to inventory."): a short toast,
  // not a bell item, since it is theirs and already in the Audit Trail. The
  // bells' notices come from the server only.
  // `tone: "error"` for something that did not fully work.
  const addNotification = ({ message, title, tone, icon }) =>
    showToast({
      message,
      title,
      tone,
      icon: icon || (tone === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check2-circle'),
    });

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAllAsRead,
        markAsRead,
        deleteNotification,
        toast,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
