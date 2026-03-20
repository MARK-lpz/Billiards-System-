import { useState } from "react";
import "../../styles/Menu.css";

export default function Menu({ onLogout, onProfile }) {
  const [show, setShow] = useState(false);

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
          <div className="menu-divider"></div>
          <button className="menu-item logout-item" onClick={() => {
            onLogout();
            setShow(false);
          }}>
            <i className="bi bi-box-arrow-right"></i>
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}