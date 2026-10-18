import "../../../styles/Guest/Announcement.css";
import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import useClock from "../../Global/useClock";
import { ANNOUNCEMENT_MAX_LENGTH, isAnnouncementShowing } from "../../../utils/siteSettings";
import { formatReservationDate } from "../../../utils/reservations";

const dayInManila = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

// Where a saved announcement stands today.
const describeState = (announcement, today) => {
  if (!announcement.enabled || !String(announcement.message || "").trim()) return { tone: "off", label: "Off" };
  if (isAnnouncementShowing(announcement, today)) return { tone: "on", label: "Showing now" };
  if (announcement.startDate && announcement.startDate > today) {
    return { tone: "wait", label: `Starts ${formatReservationDate(announcement.startDate)}` };
  }
  return { tone: "off", label: "Ended" };
};

/**
 * One line at the top of the website's pages (home, reservation, tournaments),
 * e.g. "Closed on November 1 for the holiday." It shows while it is on and
 * inside its dates; leave a date empty to have no limit on that side.
 */
export default function AnnouncementSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "announcement",
    label: "announcement",
    fieldLabels: { enabled: "on/off", message: "message", startDate: "first day", endDate: "last day" },
    setLogs,
  });
  const { enabled, message, startDate, endDate } = draft.draft;
  const today = dayInManila(useClock(60000));
  const text = message || "";

  return (
    <SiteCard
      icon="bi-megaphone"
      title="Announcement"
      description="A short notice at the top of the website, such as a holiday closing or a promo."
      chip={describeState(draft.saved, today)}
      draft={draft}
    >
      <div className="website-fields">
        <label className="website-switch">
          <input type="checkbox" checked={Boolean(enabled)} onChange={(event) => draft.update("enabled", event.target.checked)} />
          <span>Show it on the website</span>
        </label>
        <label className="website-field">
          Message
          <textarea
            rows={2}
            value={text}
            maxLength={ANNOUNCEMENT_MAX_LENGTH}
            placeholder="e.g. We are closed on November 1. See you on November 2!"
            onChange={(event) => draft.update("message", event.target.value.replace(/\s*\n\s*/g, " "))}
          />
          <em>
            {text.length}/{ANNOUNCEMENT_MAX_LENGTH} characters
          </em>
        </label>
        <div className="website-fields-row">
          <label className="website-field">
            <span>
              First day <span className="website-optional">(optional)</span>
            </span>
            <input type="date" value={startDate || ""} onChange={(event) => draft.update("startDate", event.target.value)} />
          </label>
          <label className="website-field">
            <span>
              Last day <span className="website-optional">(optional)</span>
            </span>
            <input type="date" value={endDate || ""} min={startDate || undefined} onChange={(event) => draft.update("endDate", event.target.value)} />
          </label>
        </div>

        <div className="website-preview is-dark" aria-label="What customers see">
          <span className="website-preview-label">Customers see</span>
          {enabled && text.trim() ? (
            <div className="guest-announcement is-in-card">
              <i className="bi bi-megaphone-fill" aria-hidden="true"></i>
              <p>{text}</p>
            </div>
          ) : (
            <p className="website-preview-empty">Nothing: the announcement is off.</p>
          )}
        </div>
      </div>
    </SiteCard>
  );
}
