import "../../styles/Guest/GuestLanding.css";
import "../../styles/Guest/GuestPages.css";
import "../../styles/Guest/TournamentsPage.css";
import TournamentShowcase from "../../Elements/Guest/TournamentShowcase";
import GuestHeader from "../../Elements/Guest/GuestHeader";
import GuestFooter from "../../Elements/Guest/GuestFooter";
import { useReservationState } from "../../Elements/Guest/useReservationState";
import { useAnnouncements } from "../../Elements/Guest/useAnnouncements";
import { formatEventWhen, getEventNotices, getOpenEvents } from "../../utils/eventUpdates";

/**
 * The public list of tournaments: everything still open for registration, soonest
 * first (the next one large, the rest in rows; see TournamentShowcase), and any
 * that were cancelled so players coming for them know.
 */
export default function TournamentsPage({
  events = [],
  onNavigate,
  onOpenReservation,
  onRegister,
  onlineReservationsOpen = true,
  onlineReservationsStatus = {},
}) {
  // Its `now` is refreshed every minute, so a tournament drops off once its day has passed.
  const reservation = useReservationState(onlineReservationsOpen, onlineReservationsStatus);
  const { now } = reservation;
  const news = useAnnouncements(events, reservation);

  const upcoming = getOpenEvents(events, now);
  const cancelled = getEventNotices(events, now).filter((notice) => notice.type === "cancelled");

  return (
    <main className="guest-template guest-page tournaments-page">
      <GuestHeader
        page="tournaments"
        onNavigate={onNavigate}
        onOpenReservation={onOpenReservation}
        reservation={reservation}
        newsCount={news.unseen}
      />

      <section className="guest-page-hero">
        <p className="guest-template-eyebrow">Tournaments</p>
        <h1>Upcoming Tournaments</h1>
        <p>
          Pick a tournament, check the schedule, fees and open slots, and register online or in person. Schedules
          that change are marked so you always see the latest date.
        </p>
      </section>

      <section className="tournaments-list" aria-label="Upcoming tournaments">
        {upcoming.length === 0 ? (
          <div className="guest-page-empty">
            <i className="bi bi-trophy" aria-hidden="true"></i>
            <h2>No upcoming tournaments yet</h2>
            <p>Break &amp; Chill has not posted the next tournament. Please check back soon.</p>
          </div>
        ) : (
          <TournamentShowcase events={upcoming} now={now} onRegister={onRegister} level={2} />
        )}
      </section>

      {cancelled.length > 0 && (
        <section className="tournaments-cancelled" aria-labelledby="tournaments-cancelled-title">
          <h2 id="tournaments-cancelled-title">Cancelled</h2>
          {cancelled.map(({ event }) => (
            <div key={event.id} className="tournaments-cancelled-item">
              <i className="bi bi-x-octagon-fill" aria-hidden="true"></i>
              <span>
                <strong>{event.name}</strong>
                <span className="guest-tournament-old">{formatEventWhen(event.date, event.time)}</span>
                <span className="tournaments-cancelled-note">
                  This tournament will no longer take place.
                  {event.cancelReason ? ` Reason: ${event.cancelReason}` : ""}
                </span>
              </span>
            </div>
          ))}
        </section>
      )}

      <GuestFooter />
    </main>
  );
}
