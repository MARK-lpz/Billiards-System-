import { useState } from "react";
import { createPortal } from "react-dom";
import "../../styles/Menu.css";
import ConfirmDialog from "./ConfirmDialog";

// The question is drawn at the app's theme wrapper: the top bar is sticky and
// blurred, which makes it its own layer, so a pop-up inside it would be cut off.
const getModalRoot = () => document.querySelector("#root > .dark, #root > .light") || document.body;

export default function Menu({ onLogout, onProfile, onSettings }) {
  const [show, setShow] = useState(false);
  // Logout asks first, so a mis-click never signs the counter out mid-shift.
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <div className="dropdown-container">
      <button
        className="header-icon-btn"
        onClick={() => setShow(!show)}
      >
        <i className="bi bi-three-dots-vertical"></i>
      </button>

      {show && (
        <div className="dropdown-menu menu-dropdown">
          <button className="menu-item" onClick={() => {
            onProfile();
            setShow(false);
          }}>
            <i className="bi bi-person"></i>
            <span>Profile</span>
          </button>
          {onSettings && (
            <button className="menu-item" onClick={() => {
              onSettings();
              setShow(false);
            }}>
              <i className="bi bi-gear"></i>
              <span>Settings</span>
            </button>
          )}
          <div className="menu-divider"></div>
          <button className="menu-item logout-item" onClick={() => {
            setConfirmLogout(true);
            setShow(false);
          }}>
            <i className="bi bi-box-arrow-right"></i>
            <span>Logout</span>
          </button>
        </div>
      )}

      {confirmLogout && createPortal(
        <ConfirmDialog
          title="Log out?"
          message="You will need your username and password to sign in again."
          confirmLabel="Yes, Log Out"
          cancelLabel="Stay Signed In"
          icon="bi-box-arrow-right"
          onConfirm={() => {
            setConfirmLogout(false);
            onLogout();
          }}
          onClose={() => setConfirmLogout(false)}
        />,
        getModalRoot()
      )}
    </div>
  );
}
