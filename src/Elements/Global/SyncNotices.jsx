import { useEffect } from "react";
import { useNotifications } from "./useNotifications";
import { SYNC_NOTICE_EVENT } from "../../utils/listSync";

/**
 * Shows, as a toast, why a change to a shared list was not saved (see
 * useServerList.js): changed on another screen first, a mass delete nobody
 * confirmed, or not allowed for this account.
 */
export default function SyncNotices() {
  const { showToast } = useNotifications();

  useEffect(() => {
    const show = (event) => {
      const { title, message } = event.detail || {};
      showToast({ tone: "error", icon: "bi-exclamation-triangle", title, message });
    };
    window.addEventListener(SYNC_NOTICE_EVENT, show);
    return () => window.removeEventListener(SYNC_NOTICE_EVENT, show);
  }, [showToast]);

  return null;
}
