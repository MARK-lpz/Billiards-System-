import { useState } from "react";

const readCollapsed = (storageKey) => {
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
};

/**
 * The staff panels' shell state: whether the sidebar is shrunk to icons
 * (remembered in this browser under `storageKey`), and whether the sidebar
 * drawer is open on small screens.
 */
export default function useStaffShell(storageKey) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));
  const [navOpen, setNavOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // Storage blocked: the choice lasts for this visit only.
      }
      return next;
    });
  };

  const shellClassName = `dashboard-layout ${collapsed ? "is-collapsed" : ""} ${navOpen ? "is-nav-open" : ""}`;

  return { collapsed, toggleCollapsed, navOpen, setNavOpen, shellClassName };
}
