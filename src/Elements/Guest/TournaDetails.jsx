import { formatEventWhen, gameTypeLabel, wasRescheduled } from "../../utils/eventUpdates";

const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/**
 * Step 2 of the tournament sign-up: which tournament, what it is (as the admin
 * set it up, shown rather than asked), and an optional team or nickname, which
 * goes on the players list next to the player's name.
 */
export default function TournamentDetailsForm({ form, onChange, events = [], selectedEvent }) {
  const entryFee = Number(selectedEvent?.entryFee || 0);
  const prize = Number(selectedEvent?.prize || 0);
  const players = (selectedEvent?.participants || []).length;

  return (
    <>
      <div className="form-field-full">
        <label className="label" htmlFor="tourna-eventId">Tournament Event</label>
        <select
          id="tourna-eventId"
          className="field-input"
          name="eventId"
          value={form.eventId}
          onChange={onChange}
          required
        >
          <option value="">Select Tournament</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
              {wasRescheduled(event) ? " (Rescheduled)" : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <section className="tourna-event-card" aria-label={`About ${selectedEvent.name}`}>
          <dl className="tourna-event-facts">
            <div className="is-wide">
              <dt><i className="bi bi-calendar-event" aria-hidden="true"></i>When</dt>
              <dd>{formatEventWhen(selectedEvent.date, selectedEvent.time)}</dd>
            </div>
            {selectedEvent.gameType && (
              <div>
                <dt><i className="bi bi-circle" aria-hidden="true"></i>Game</dt>
                <dd>{gameTypeLabel(selectedEvent.gameType)}</dd>
              </div>
            )}
            <div>
              <dt><i className="bi bi-cash-coin" aria-hidden="true"></i>Entry fee</dt>
              <dd>{entryFee > 0 ? peso(entryFee) : "Free"}</dd>
            </div>
            {prize > 0 && (
              <div>
                <dt><i className="bi bi-trophy" aria-hidden="true"></i>Prize pool</dt>
                <dd>{peso(prize)}</dd>
              </div>
            )}
            <div>
              <dt><i className="bi bi-people" aria-hidden="true"></i>Players</dt>
              <dd>{players ? `${players} registered` : "None yet"}</dd>
            </div>
          </dl>
          {wasRescheduled(selectedEvent) && (
            <p className="tourna-event-moved">
              <i className="bi bi-calendar2-week" aria-hidden="true"></i>
              <span>
                Rescheduled from {formatEventWhen(selectedEvent.rescheduledFrom.date, selectedEvent.rescheduledFrom.time)}
                {selectedEvent.rescheduleReason ? `. Reason: ${selectedEvent.rescheduleReason}` : ""}
              </span>
            </p>
          )}
        </section>
      )}

      <div className="form-field-full">
        <label className="label" htmlFor="tourna-teamName">Team / Nickname (optional)</label>
        <input
          id="tourna-teamName"
          className="field-input"
          name="teamName"
          value={form.teamName}
          onChange={onChange}
          placeholder="e.g. Team Cue"
          aria-describedby="tourna-teamName-help"
        />
        <p className="field-helper" id="tourna-teamName-help">Shown next to your name on the players list.</p>
      </div>
    </>
  );
}
