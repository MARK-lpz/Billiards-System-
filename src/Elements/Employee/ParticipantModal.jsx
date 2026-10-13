import { useEffect, useState } from "react";
import { fetchCustomerMessages } from "../../utils/customerMessageApi";
import { formatEventWhen } from "../../utils/eventUpdates";
import { describePayment, findConfirmation, formatRegisteredAt } from "../../utils/tournamentRegistrations";

const formatPeso = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;

const formatGameType = (value) =>
  value
    ? value
        .split("-")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(" ")
    : "Tournament";

const TEXT_STATUS = {
  sent: "Sent to the player",
  queued: "Saved, not texted yet",
  failed: "Could not be texted",
};

/**
 * One registered player: who they are, the tournament, and for an online
 * registration the number and payment from the confirmation the server saved.
 */
export default function ParticipantModal({ registration, onClose, onOpenTournament }) {
  // { status: "loading" | "done" | "error", confirmation }
  const [lookup, setLookup] = useState(() => ({ status: registration.walkIn ? "done" : "loading", confirmation: null }));

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const eventId = registration.event.id;
  const { name, walkIn } = registration;
  useEffect(() => {
    if (walkIn) return undefined;
    let cancelled = false;
    fetchCustomerMessages()
      .then((messages) => {
        if (!cancelled) setLookup({ status: "done", confirmation: findConfirmation(messages, eventId, name) });
      })
      .catch(() => {
        if (!cancelled) setLookup({ status: "error", confirmation: null });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, name, walkIn]);

  const { event } = registration;
  const total = event.participants?.length || 0;
  const confirmation = lookup.confirmation;
  const payment = confirmation ? describePayment(confirmation.message) : "";

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(clickEvent) => clickEvent.stopPropagation()}>
          <div className="modal-content tourna-player-modal">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">
                  <i className={`bi ${registration.walkIn ? "bi-person-walking" : "bi-person-badge"}`}></i> {registration.name}
                </h5>
                <p className="tourna-modal-subtitle">
                  {registration.walkIn ? "Walk-in, registered at the counter" : "Registered online"} · Player {registration.position}{" "}
                  of {total}
                </p>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <dl className="tourna-player-facts">
                <div>
                  <dt>Team</dt>
                  <dd>{registration.team || "Solo player"}</dd>
                </div>
                <div>
                  <dt>Tournament</dt>
                  <dd>{event.name}</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>{formatEventWhen(event.date, event.time)}</dd>
                </div>
                <div>
                  <dt>Game · Entry fee</dt>
                  <dd>
                    {formatGameType(event.gameType)} · {Number(event.entryFee) > 0 ? formatPeso(event.entryFee) : "Free"}
                  </dd>
                </div>
              </dl>

              {!registration.walkIn && (
                <div className="tourna-player-contact">
                  <span className="tourna-section-label">Online registration</span>
                  {lookup.status === "loading" && <p className="tourna-player-note">Looking up the contact details…</p>}
                  {lookup.status === "error" && (
                    <p className="tourna-player-note is-warning">
                      <i className="bi bi-wifi-off" aria-hidden="true"></i> Couldn&apos;t load the contact details right now.
                      Try again in a moment.
                    </p>
                  )}
                  {lookup.status === "done" && !confirmation && (
                    <p className="tourna-player-note">
                      <i className="bi bi-info-circle" aria-hidden="true"></i> No contact details on file for this player.
                    </p>
                  )}
                  {lookup.status === "done" && confirmation && (
                    <dl className="tourna-player-facts">
                      <div>
                        <dt>Contact number</dt>
                        <dd>
                          <a href={`tel:${confirmation.phone}`}>{confirmation.phone}</a>
                        </dd>
                      </div>
                      <div>
                        <dt>Registered on</dt>
                        <dd>{formatRegisteredAt(confirmation.createdAt) || "—"}</dd>
                      </div>
                      <div>
                        <dt>Payment</dt>
                        <dd>{payment || "—"}</dd>
                      </div>
                      <div>
                        <dt>Confirmation text</dt>
                        <dd>{TEXT_STATUS[confirmation.status] || confirmation.status}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              {onOpenTournament && (
                <button type="button" className="btn btn-success" onClick={onOpenTournament}>
                  <i className="bi bi-trophy"></i> Open Tournament
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
