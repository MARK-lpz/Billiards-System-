import { useState } from "react";
import "../../styles/Notification.css";
import { useNotifications } from "./useNotifications";


export default function Notification() {
  const [show, setShow] = useState(false);
  const { notifications, markAllAsRead, markAsRead, deleteNotification } = useNotifications();

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleNotificationClick = (id) => {
    markAsRead(id);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    deleteNotification(id);
  };

  return (
    <div className="dropdown-container">
      <button 
        className="header-icon-btn" 
        onClick={() => setShow(!show)}
      >
        <i className="bi bi-bell"></i>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {show && (
        <>
          <div className="notification-overlay" onClick={() => setShow(false)} />
          <div className="dropdown-menu notification-dropdown">
            <div className="dropdown-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  className="mark-read-btn" 
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </button>
              )}
            </div>

          <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <i className="bi bi-bell-slash"></i>
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`menu-item ${notif.unread ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notif.id)}
                  >
                    <div className="notification-content">
                      <p className="notification-message">{notif.message}</p>
                      <span className="notification-time">{notif.time}</span>
                    </div>
                    <button 
                      className="notification-delete"
                      onClick={(e) => handleDelete(notif.id, e)}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                    {notif.unread && <div className="notification-dot" />}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}