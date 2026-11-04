import { useEffect } from "react";
import { rememberRequestSeen } from "../../utils/myRequests";

/**
 * On the page after sending a booking or a sign-up: where it stands, updated
 * by itself (see useMyRequests: every few seconds while it waits, which the
 * Live mark says). `fallback` shows until the server answers. Once it is
 * decided here, the home page does not announce it again.
 */
export default function RequestStatusCard({ request, fallback, textedTo = "", emailedTo = "" }) {
  const info = request?.info || fallback;
  // "text 0917 123 4567 and email ju@gmail.com": where the decision goes too.
  const alsoTold = [textedTo && `text ${textedTo}`, emailedTo && `email ${emailedTo}`].filter(Boolean).join(" and ");
  const key = request?.key;
  const signature = request?.info?.signature;
  const decided = Boolean(request?.info) && request.info.tone !== "waiting";

  useEffect(() => {
    if (key && decided && signature) rememberRequestSeen(key, signature);
  }, [key, decided, signature]);

  if (!info) return null;

  return (
    <div className={`request-status is-${info.tone}`} role="status" aria-live="polite">
      <i className={`bi ${info.icon}`} aria-hidden="true"></i>
      <div className="request-status-body">
        <span className="request-status-kicker">
          Status
          {info.tone === "waiting" && (
            <span className="request-status-live" title="This changes by itself the moment the front desk checks your payment.">
              <span className="request-status-live-dot" aria-hidden="true"></span>
              Live
            </span>
          )}
        </span>
        <strong className="request-status-title">{info.title}</strong>
        <p>{info.detail}</p>
        {info.tone === "waiting" && (
          <p className="request-status-note">
            {alsoTold ? `We will also ${alsoTold} once it is decided. ` : ""}
            No need to refresh: this changes by itself once it is checked. You can also see it later under My bookings
            on our home page.
          </p>
        )}
      </div>
    </div>
  );
}
