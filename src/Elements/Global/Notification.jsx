import { useState } from "react";
import "../../styles/Notification.css";
import "../../styles/StaffBell.css";
import { useNotifications } from "./useNotifications";
import { noticeTime } from "../../utils/notices";

const OTHERS_SHOWN = 30;

/**
 * The staff bell, shared by the admin's and the employee's dashboards
 * (AdminBell, EmployeeBell). On top, the `sections` each role focuses on, every
 * item opening its module:
 *   { key, title, icon, newCount, empty, items: [{ key, unread, icon, title, meta, state, onOpen, actions }] }
 * `actions` (optional): buttons under the item, [{ label, icon, tone, onClick }].
 * Under them, when `others` ({ title, filter, openerOf }) is given, the rest of
 * the notices the role still gets (`filter` picks them), which can be read or
 * dismissed as before. `openerOf(notice)` (optional) gives what opening one
 * does, e.g. go to its page, or null to only mark it read. The badge counts
 * everything new in both.
 */
export default function Notification({ sections = [], others = null, onMarkAllSeen, title = "Notifications" }) {
  const [show, setShow] = useState(false);
  // On a narrow screen the list spans the screen just under the bell (its top,
  // in px), instead of hanging off the bell's edge past the screen.
  const [dockTop, setDockTop] = useState(null);
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const otherNotices = others ? notifications.filter(others.filter) : [];
  const unreadOthers = otherNotices.filter((notice) => notice.unread).length;
  const unread = sections.reduce((sum, section) => sum + (section.newCount || 0), 0) + unreadOthers;

  const toggle = (clickEvent) => {
    if (show) {
      setShow(false);
      return;
    }
    const bell = clickEvent.currentTarget.getBoundingClientRect();
    setDockTop(window.innerWidth <= 640 ? Math.round(bell.bottom + 8) : null);
    setShow(true);
  };

  const openItem = (item) => {
    setShow(false);
    item.onOpen();
  };

  const runAction = (action) => {
    setShow(false);
    action.onClick();
  };

  const itemBody = (item) => (
    <>
      <i className={`bi ${item.icon} staff-bell-icon`} aria-hidden="true"></i>
      <span className="notification-content">
        <span className="notification-message">{item.title}</span>
        <span className="notification-time">
          {item.meta}
          {item.state && (
            <span className={`staff-bell-state staff-bell-state--${item.state.tone}`}>{item.state.label}</span>
          )}
        </span>
      </span>
      {item.unread && <span className="notification-dot" aria-label="New" />}
    </>
  );

  const markAll = () => {
    onMarkAllSeen?.();
    if (unreadOthers) markAllAsRead();
  };

  const openOther = (notice) => {
    if (notice.unread) markAsRead(notice.id);
    const open = others.openerOf?.(notice);
    if (!open) return;
    setShow(false);
    open();
  };

  const dismiss = (notice, clickEvent) => {
    clickEvent.stopPropagation();
    deleteNotification(notice.id);
  };

  return (
    <div className="dropdown-container">
      <button
        type="button"
        className="header-icon-btn"
        onClick={toggle}
        aria-label={unread ? `${title}, ${unread} new` : title}
        aria-expanded={show}
        title={title}
      >
        <i className="bi bi-bell"></i>
        {unread > 0 && <span className="notification-badge">{unread}</span>}
      </button>

      {show && (
        <>
          <div className="notification-overlay" onClick={() => setShow(false)} />
          <div
            className={`dropdown-menu notification-dropdown staff-bell ${dockTop !== null ? "staff-bell--docked" : ""}`}
            style={dockTop !== null ? { top: dockTop } : undefined}
          >
            <div className="dropdown-header">
              <h3>{title}</h3>
              {unread > 0 && (
                <button type="button" className="mark-read-btn" onClick={markAll}>
                  Mark all as read
                </button>
              )}
            </div>

            <div className="notification-list">
              {sections.map((section) => (
                <div key={section.key} className="staff-bell-group">
                  <p className="staff-bell-section">
                    <i className={`bi ${section.icon}`} aria-hidden="true"></i>
                    {section.title}
                    {section.newCount > 0 && <span className="staff-bell-count">{section.newCount} new</span>}
                  </p>
                  {section.items.length ? (
                    section.items.map((item) =>
                      item.actions?.length ? (
                        <div
                          key={item.key}
                          className={`menu-item staff-bell-item staff-bell-item--actions ${item.unread ? "unread" : ""}`}
                        >
                          <button type="button" className="staff-bell-item-open" onClick={() => openItem(item)}>
                            {itemBody(item)}
                          </button>
                          <div className="staff-bell-actions">
                            {item.actions.map((action) => (
                              <button
                                key={action.label}
                                type="button"
                                className={`staff-bell-action staff-bell-action--${action.tone || "plain"}`}
                                onClick={() => runAction(action)}
                              >
                                <i className={`bi ${action.icon}`} aria-hidden="true"></i>
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <button
                          key={item.key}
                          type="button"
                          className={`menu-item staff-bell-item ${item.unread ? "unread" : ""}`}
                          onClick={() => openItem(item)}
                        >
                          {itemBody(item)}
                        </button>
                      )
                    )
                  ) : (
                    <p className="staff-bell-empty">{section.empty}</p>
                  )}
                </div>
              ))}

              {others && (
                <div className="staff-bell-group">
                  <p className="staff-bell-section">
                    <i className="bi bi-bell" aria-hidden="true"></i>
                    {others.title}
                    {unreadOthers > 0 && <span className="staff-bell-count">{unreadOthers} new</span>}
                  </p>
                  {otherNotices.length ? (
                    otherNotices.slice(0, OTHERS_SHOWN).map((notice) => (
                      <div key={notice.id} className={`menu-item staff-bell-item staff-bell-other ${notice.unread ? "unread" : ""}`}>
                        <button
                          type="button"
                          className="staff-bell-other-open"
                          onClick={() => openOther(notice)}
                          aria-label={notice.unread && !others.openerOf?.(notice) ? `${notice.message} (mark as read)` : notice.message}
                        >
                          <span className="notification-content">
                            <span className="notification-message">{notice.message}</span>
                            <span className="notification-time">{noticeTime(notice)}</span>
                          </span>
                          {notice.unread && <span className="notification-dot" aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          className="notification-delete"
                          onClick={(clickEvent) => dismiss(notice, clickEvent)}
                          aria-label={`Dismiss: ${notice.message}`}
                          title="Dismiss"
                        >
                          <i className="bi bi-x" aria-hidden="true"></i>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="staff-bell-empty">{others.empty || "No other notices."}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
