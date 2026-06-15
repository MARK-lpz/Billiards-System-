import { useState } from "react";
import "../../styles/Notification.css";
import { useNotifications } from "./useNotifications";


export default function Notification({ notifications: externalNotifications }) {
  const [show, setShow] = useState(false);
  const { notifications: contextNotifications, markAllAsRead, markAsRead, deleteNotification } = useNotifications();
  const notifications = externalNotifications || contextNotifications;

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

  const updateEmployeeRequest = (requestId, status) => {
    const storedRequests = JSON.parse(localStorage.getItem("employeePasswordRequests") || "[]");
    const updatedRequests = storedRequests.map((request) =>
      request.id === requestId
        ? {
            ...request,
            status,
            reviewedAt: new Date().toISOString(),
          }
        : request
    );

    localStorage.setItem("employeePasswordRequests", JSON.stringify(updatedRequests));
  };

  const handlePasswordRequestAction = (notification, status, event) => {
    event.stopPropagation();
    if (!notification.requestId) return;

    updateEmployeeRequest(notification.requestId, status);
    markAsRead(notification.id);
    deleteNotification(notification.id);
  };

  const getRequestStatus = (requestId) => {
    if (!requestId) return null;

    try {
      const storedRequests = JSON.parse(localStorage.getItem("employeePasswordRequests") || "[]");
      return storedRequests.find((request) => request.id === requestId)?.status || null;
    } catch {
      return null;
    }
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
                      {notif.type === "password-reset" &&
                        getRequestStatus(notif.requestId) === "pending-admin-approval" && (
                          <div className="notification-actions">
                            <button
                              type="button"
                              className="notification-action-btn approve"
                              onClick={(event) =>
                                handlePasswordRequestAction(notif, "approved", event)
                              }
                            >
                              Grant
                            </button>
                            <button
                              type="button"
                              className="notification-action-btn reject"
                              onClick={(event) =>
                                handlePasswordRequestAction(notif, "rejected", event)
                              }
                            >
                              Reject
                            </button>
                          </div>
                        )}
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
