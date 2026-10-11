import { useEffect, useState } from "react";
import "../../styles/Toast.css";
import { useNotifications } from "./useNotifications";

const TOAST_MS = 6000;

/**
 * The short note in the corner after something happens, e.g. a bill sent to
 * Sales / POS. A toast names an `action` ("open-pos"); the page passes what that
 * action does in `actions`, or null to hide its button (e.g. already on the POS).
 * It closes by itself, but not while a mouse is on it. Only a mouse: a tap is
 * an "enter" with no "leave", and would keep it open for good.
 */
export default function Toast({ actions = {} }) {
  const { toast, dismissToast } = useNotifications();
  const [hovered, setHovered] = useState(false);
  const toastId = toast?.id;

  useEffect(() => {
    if (!toastId || hovered) return undefined;
    const timer = window.setTimeout(() => dismissToast(toastId), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toastId, hovered, dismissToast]);

  if (!toast) return null;

  const action = toast.action ? actions[toast.action] : null;

  return (
    <div
      key={toast.id}
      className={`app-toast ${toast.tone ? `app-toast--${toast.tone}` : ""}`}
      role="status"
      aria-live="polite"
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
    >
      <i className={`bi ${toast.icon || "bi-info-circle"} app-toast-icon`} aria-hidden="true"></i>
      <div className="app-toast-body">
        {toast.title && <strong className="app-toast-title">{toast.title}</strong>}
        <p className="app-toast-message">{toast.message}</p>
        {action && (
          <button
            type="button"
            className="app-toast-action"
            onClick={() => {
              dismissToast(toast.id);
              action.onClick();
            }}
          >
            {action.label}
            <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </button>
        )}
      </div>
      <button type="button" className="app-toast-close" aria-label="Close" onClick={() => dismissToast(toast.id)}>
        <i className="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>
  );
}
