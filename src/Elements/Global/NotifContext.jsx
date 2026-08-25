import { useState, useEffect } from 'react';
import { NotificationContext } from './NotificationContext';

const ADMIN_NOTIFICATION_KEY = 'adminNotifications';
const EMPLOYEE_NOTIFICATION_KEY = 'employeeNotifications';
const NOTIFICATION_API_URL = import.meta.env.VITE_NOTIFICATION_API_URL || (
  !import.meta.env.DEV && window.location.hostname === 'breakandchill.com'
    ? 'https://app.breakandchill.com/api/notifications.php'
    : '/api/notifications.php'
);

const createNotification = (notification) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  time: 'Just now',
  unread: true,
  ...notification,
});

export function NotificationProvider({
  children,
  canReceiveAdminNotifications = false,
  canReceiveEmployeeNotifications = false,
}) {
  const [notifications, setNotifications] = useState([]);

  const mergeNotifications = (incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;

    setNotifications((prev) => {
      const existing = new Map(prev.map((notification) => [notification.id, notification]));
      incoming.forEach((notification) => {
        existing.set(notification.id, { ...existing.get(notification.id), ...notification });
      });
      return [...incoming.map((notification) => existing.get(notification.id)), ...prev.filter((notification) => !incoming.some((item) => item.id === notification.id))];
    });
  };

  const loadNotificationQueue = (storageKey) => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(stored) || stored.length === 0) return;

      mergeNotifications(stored);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Unable to load queued notifications', error);
    }
  };

  const queueNotification = (storageKey, notification) => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const existingNotifications = Array.isArray(stored) ? stored : [];
      localStorage.setItem(
        storageKey,
        JSON.stringify([notification, ...existingNotifications].slice(0, 100))
      );
    } catch (error) {
      console.warn('Unable to queue notification', error);
    }
  };

  const loadRemoteNotifications = async (recipient) => {
    try {
      const response = await fetch(`${NOTIFICATION_API_URL}?recipient=${recipient}`);
      if (!response.ok) return;

      const data = await response.json();
      mergeNotifications(data.notifications);
    } catch (error) {
      console.warn('Unable to load server notifications', error);
    }
  };

  const sendRemoteNotification = (notification, recipients) => {
    fetch(NOTIFICATION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...notification, recipients }),
    }).catch((error) => console.warn('Unable to send server notification', error));
  };

  const updateRemoteNotification = (id, action) => {
    const recipient = canReceiveAdminNotifications
      ? 'admin'
      : canReceiveEmployeeNotifications
        ? 'employee'
        : null;
    if (!recipient) return;

    fetch(NOTIFICATION_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, recipient, action }),
    }).catch((error) => console.warn('Unable to update server notification', error));
  };

  useEffect(() => {
    if (!canReceiveAdminNotifications) return undefined;

    const loadNotifications = () => {
      loadNotificationQueue(ADMIN_NOTIFICATION_KEY);
      loadRemoteNotifications('admin');
    };
    const handleStorage = (event) => {
      if (event.key === ADMIN_NOTIFICATION_KEY) loadNotifications();
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 3000);
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [canReceiveAdminNotifications]);

  useEffect(() => {
    if (!canReceiveEmployeeNotifications) return undefined;

    const loadNotifications = () => {
      loadNotificationQueue(EMPLOYEE_NOTIFICATION_KEY);
      loadRemoteNotifications('employee');
    };
    const handleStorage = (event) => {
      if (event.key === EMPLOYEE_NOTIFICATION_KEY) loadNotifications();
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 3000);
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [canReceiveEmployeeNotifications]);

  const addNotification = (notification) => {
    const newNotification = createNotification(notification);
    setNotifications(prev => [newNotification, ...prev]);
  };

  const queueAdminNotification = (notification) => {
    const newNotification = createNotification(notification);
    queueNotification(ADMIN_NOTIFICATION_KEY, newNotification);
    sendRemoteNotification(newNotification, ['admin']);
  };

  const queueStaffNotification = (notification) => {
    const newNotification = createNotification(notification);
    queueNotification(ADMIN_NOTIFICATION_KEY, newNotification);
    queueNotification(EMPLOYEE_NOTIFICATION_KEY, newNotification);
    sendRemoteNotification(newNotification, ['admin', 'employee']);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    notifications.forEach((notification) => updateRemoteNotification(notification.id, 'read'));
  };

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, unread: false } : n)
    );
    updateRemoteNotification(id, 'read');
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    updateRemoteNotification(id, 'dismiss');
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
        queueAdminNotification,
        queueStaffNotification,
        markAllAsRead, 
        markAsRead, 
        deleteNotification,
        clearAll 
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
