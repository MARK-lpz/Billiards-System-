import "../../styles/CancelledNoticeControl.css";
import { CANCELLED_NOTICE_DAYS, getCancelledNoticeEnd, isCancelledNoticeShowing } from "../../utils/eventUpdates";

const formatUntil = (ms) =>
  new Date(ms).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * For a cancelled tournament on a staff screen (Admin > Events, the front
 * desk's Tournament Schedule): whether the website still tells players it is
 * cancelled, until when, and a button to hide it now or show it again.
 * `onChange(hidden)` saves it; `busy` while it does.
 */
export default function CancelledNoticeControl({ event, now, onChange, busy = false, error = "" }) {
  const end = getCancelledNoticeEnd(event);
  const showing = isCancelledNoticeShowing(event, now);
  // Hidden by staff, but its time on the website is not over: it can come back.
  const canShowAgain = event.noticeHidden && end !== null && end >= now;

  return (
    <div className={`cancelled-site-notice ${showing ? "is-showing" : "is-off"}`}>
      <i className={`bi ${showing ? "bi-globe2" : "bi-eye-slash"}`} aria-hidden="true"></i>
      <span className="cancelled-site-notice-text">
        {showing
          ? `The website tells players it is cancelled until ${formatUntil(end)}.`
          : event.noticeHidden
            ? "Hidden from the website."
            : `No longer on the website (shown for up to ${CANCELLED_NOTICE_DAYS} days after cancelling).`}
        {error && <em role="alert">{error}</em>}
      </span>
      {showing && (
        <button type="button" className="cancelled-site-notice-btn" onClick={() => onChange(true)} disabled={busy}>
          <i className="bi bi-eye-slash" aria-hidden="true"></i>
          {busy ? "Hiding..." : "Hide from website"}
        </button>
      )}
      {canShowAgain && (
        <button type="button" className="cancelled-site-notice-btn" onClick={() => onChange(false)} disabled={busy}>
          <i className="bi bi-eye" aria-hidden="true"></i>
          {busy ? "Showing..." : "Show on website"}
        </button>
      )}
    </div>
  );
}
