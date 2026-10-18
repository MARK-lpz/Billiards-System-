import "../../styles/Guest/Announcement.css";
import useClock from "../Global/useClock";
import { useSiteSettings } from "../Global/useSiteSettings";
import { isAnnouncementShowing } from "../../utils/siteSettings";

const dayInManila = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/**
 * The admin's announcement (Admin > Website), e.g. "Closed on November 1", at
 * the top of the customer pages while it is on and inside its dates. Plain
 * text only. Nothing shows when there is none.
 */
export default function AnnouncementBar({ className = "" }) {
  const { announcement } = useSiteSettings().settings;
  // Checked each minute, so it comes and goes on its dates while the page is open.
  const now = useClock(60000);
  if (!isAnnouncementShowing(announcement, dayInManila(now))) return null;

  return (
    <div className={`guest-announcement ${className}`} role="status">
      <i className="bi bi-megaphone-fill" aria-hidden="true"></i>
      <p>{announcement.message}</p>
    </div>
  );
}
