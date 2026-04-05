import { useState, useEffect } from 'react';
import { NotificationContext } from './NotificationContext';

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadNotifications = () => {
      const stored = JSON.parse(localStorage.getItem('adminNotifications') || '[]');
      if (stored.length > 0) {
        setNotifications(prev => [...stored, ...prev]);
        localStorage.removeItem('adminNotifications');
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 3000);
    return () => clearInterval(interval);
  }, []);

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      time: "Just now",
      unread: true,
      ...notification
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, unread: false } : n)
    );
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
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