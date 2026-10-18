import { useEffect } from "react";
import { rememberRequestSeen } from "../../utils/myRequests";

/**
 * On the page after sending a booking or a sign-up: where it stands, updated
 * by itself (see useMyRequests). `fallback` shows until the server answers.
 * Once it is decided here, the home page does not announce it again.
 */
export default function RequestStatusCard({ request, fallback, textedTo = "" }) {
  const info = request?.info || fallback;
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
        <span className="request-status-kicker">Status</span>
        <strong className="request-status-title">{info.title}</strong>
        <p>{info.detail}</p>
        {info.tone === "waiting" && (
          <p className="request-status-note">
            {textedTo ? `We will also text ${textedTo} once it is decided. ` : ""}
            You can check it later under My bookings on our home page.
          </p>
        )}
      </div>
    </div>
  );
}
