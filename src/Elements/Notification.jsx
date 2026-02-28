import { useState } from "react";
import "../styles/Notification.css";

export default function Notification({ notifications }) {
  const [show, setShow] = useState(false);
  const unreadCount = notifications.filter(n => n.unread).length;

  const handleMarkAllRead = () => {
    console.log("Mark all as read");
    // Add your logic here to mark all notifications as read
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
        <div className="dropdown-menu notification-dropdown">
          <div className="dropdown-header">
            <h3>Notifications</h3>
            <button className="mark-read-btn" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
          </div>
          <div className="notification-list">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`notification-item ${notif.unread ? 'unread' : ''}`}
                onClick={() => console.log('Notification clicked:', notif.id)}
              >
                <div className="notification-content">
                  <p className="notification-message">{notif.message}</p>
                  <span className="notification-time">{notif.time}</span>
                </div>
                {notif.unread && <span className="unread-dot"></span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}