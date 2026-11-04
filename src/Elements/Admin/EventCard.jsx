import "../../styles/TournamentFees.css";
import { formatEventWhen, wasRescheduled } from "../../utils/eventUpdates";
import { eventMediaUrl, getEventMedia } from "../../utils/eventMedia";
import CancelledNoticeControl from "../Global/CancelledNoticeControl";
import TournamentPayments from "../Global/TournamentPayments";
import { useOnlinePayments } from "../Global/useOnlinePayments";
import EntryFeeSummary from "../Global/EntryFeeSummary";
import {
  describePaymentMethods,
  describePlayers,
  describeSlots,
  getPlayerFee,
  hasEntryFee,
  isEventFull,
} from "../../utils/tournamentFees";

const formatAssignedTables = (assignedTables = [], tables = []) => {
  const labels = (assignedTables || [])
    .map((assigned) => {
      const matched = (tables || []).find((table) => table.id === assigned || table.name === assigned);
      if (matched?.name) return matched.name;
      if (typeof assigned === "string" && assigned.toLowerCase().startsWith("table ")) return assigned;
      if (typeof assigned === "number" && assigned < 1000) return `Table ${assigned}`;
      return null;
    })
    .filter(Boolean);

  return labels.length ? labels.join(", ") : "Not assigned";
};

// `setLogs`: the Audit Trail, for the entry fees checked or sent back here.
export default function EventCard({ event, tables = [], now, setLogs, onEdit, onMarkComplete, onCancel, onNoticeChange }) {
  // The entry fees paid on the website; a player's status reads them with the counter's.
  const { payments } = useOnlinePayments();
  const paid = hasEntryFee(event);
  const slots = describeSlots(event);

  return (
    <div className={`card events-card ${event.status === "upcoming" ? "events-card-upcoming" : ""}`}>
      <div className="card-body">
        {/* Event Header */}
        <div className="events-card-header">
          <div>
            <h5 className="events-name">
              <i className="bi bi-trophy-fill me-2"></i>
              {event.name}
            </h5>
            <p className="events-datetime">
              <i className="bi bi-calendar3 me-2"></i>
              {event.date} at {event.time}
            </p>
            {wasRescheduled(event) && event.status !== "cancelled" && (
              <p className="events-update-note">
                <i className="bi bi-calendar2-week"></i>
                Rescheduled from {formatEventWhen(event.rescheduledFrom.date, event.rescheduledFrom.time)}
                {event.rescheduleReason ? ` · ${event.rescheduleReason}` : ""}
              </p>
            )}
          </div>
          <span className={`badge events-badge-${event.status}`}>
            {event.status}
          </span>
        </div>

        {/* Event Info Grid */}
        <div className="events-info-grid">
          <div className="events-info-box">
            <div className="events-info-label">Tables Assigned</div>
            <div className="events-info-value">
              {formatAssignedTables(event.tables, tables)}
            </div>
          </div>
          <div className="events-info-box">
            <div className="events-info-label">Participants</div>
            <div className="events-info-value">
              {describePlayers(event)}
              {slots && (
                <span className={`events-slots${isEventFull(event) ? " is-full" : ""}`}>{slots}</span>
              )}
            </div>
          </div>
          <div className="events-info-box">
            <div className="events-info-label">Entry Fee</div>
            <div className="events-info-value">
              {paid ? `₱${Number(event.entryFee).toLocaleString()}` : "Free"}
              {paid && <span className="events-info-sub">{describePaymentMethods(event)}</span>}
            </div>
          </div>
          <div className="events-info-box">
            <div className="events-info-label">Prize Pool</div>
            <div className="events-info-value events-prize">
              ₱{event.prize.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Promo pictures and videos on the website; the first is the cover */}
        {getEventMedia(event).length > 0 && (
          <div className="events-media-strip">
            <div className="events-participants-label">
              Promo media · {getEventMedia(event).length}
            </div>
            <div className="events-media-thumbs">
              {getEventMedia(event).map((item, index) => (
                <span key={item.id} className={`events-media-thumb ${index === 0 ? "is-cover" : ""}`}>
                  {item.type === "video" ? (
                    <video src={eventMediaUrl(item)} muted playsInline preload="metadata" aria-label={`Video ${index + 1}`} />
                  ) : (
                    <img src={eventMediaUrl(item)} alt={`Picture ${index + 1}`} loading="lazy" />
                  )}
                  {item.type === "video" && <i className="bi bi-play-circle-fill" aria-hidden="true"></i>}
                  {index === 0 && <small>Cover</small>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Participants List */}
        {event.participants.length > 0 && (
          <div className="events-participants">
            <div className="events-participants-label">Participants</div>
            {paid && <EntryFeeSummary event={event} payments={payments} className="events-fee-summary" />}
            <div className="events-participants-list">
              {event.participants.map((p, i) => {
                const fee = paid ? getPlayerFee(event, p, payments) : null;
                return (
                  <span key={i} className="events-participant-badge">
                    <i className="bi bi-person-fill me-1"></i>
                    {p}
                    {fee && <span className={`fee-chip tone-${fee.tone}`}>{fee.label}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Entry fees paid on the website: checked, or sent back, from here too. */}
        <TournamentPayments
          event={event}
          setLogs={setLogs}
          staff="Admin"
          heading="Entry fees paid online"
          className="events-participants"
          labelClassName="events-participants-label"
        />

        {/* Actions (for upcoming events only) */}
        {event.status === "upcoming" && (
          <div className="events-actions">
            <button className="btn btn-sm btn-success" onClick={onEdit}>
              <i className="bi bi-pencil-square me-1"></i>
              Edit Event
            </button>
            <button className="btn btn-sm btn-info" onClick={onMarkComplete}>
              <i className="bi bi-check-circle me-1"></i>
              Mark Complete
            </button>
            <button className="btn btn-sm btn-danger" onClick={onCancel}>
              <i className="bi bi-x-circle me-1"></i>
              Cancel Event
            </button>
          </div>
        )}

        {event.status === "completed" && (
          <p className="events-locked-note">
            <i className="bi bi-lock-fill me-2"></i>
            This tournament is completed and can no longer be cancelled.
          </p>
        )}

        {event.status === "cancelled" && (
          <>
            <p className="events-locked-note">
              <i className="bi bi-x-circle me-2"></i>
              This tournament was cancelled. Registration is closed.
              {event.cancelReason ? ` Reason: ${event.cancelReason}` : ""}
            </p>
            {onNoticeChange && <CancelledNoticeControl event={event} now={now} onChange={onNoticeChange} />}
          </>
        )}
      </div>
    </div>
  );
}
