import { useEffect, useState } from "react";
import "../../styles/Guest/GuestLanding.css";
import { RESERVATION_CLOSED_HOURS_MESSAGE, isOutsideReservationHours } from "../../utils/reservations";
import { formatEventWhen, getEventNotices, getOpenEvents, wasRescheduled } from "../../utils/eventUpdates";

// Closed from 10 PM until opening, not only until midnight.
const isOnlineReservationClosed = () => isOutsideReservationHours();

const slides = [
  {
    title: "Play. Compete. Unwind.",
    copy: "Break & Chill is your place for casual games, serious practice, and tournament play.",
    position: "center",
  },
  {
    title: "Your Next Game Starts Here",
    copy: "Enjoy a focused billiards space built for players, teams, and friendly competition.",
    position: "bottom",
  },
];

const registrationQrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=520x520&data=https%3A%2F%2Fbreakandchill.com%2F&bgcolor=ffffff&color=0d1b2a&margin=12&format=png";

const formatPrize = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;

// The home page shows the first few; the Tournaments page lists them all.
const HOME_TOURNAMENT_LIMIT = 3;

export default function GuestLanding({
  onOpenReservation,
  onOpenTournamentForm,
  onOpenTournaments,
  onlineReservationsOpen = true,
  events = [],
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  // Refreshed every minute with the reservation check, so a past event drops off.
  const [now, setNow] = useState(() => Date.now());
  const [automaticReservationsClosed, setAutomaticReservationsClosed] = useState(isOnlineReservationClosed);
  const active = slides[activeSlide];
  const reservationsClosed = automaticReservationsClosed || !onlineReservationsOpen;
  const reservationClosedMessage = !onlineReservationsOpen
    ? "Online reservations are temporarily closed by the owner. Please check back later."
    : RESERVATION_CLOSED_HOURS_MESSAGE;

  useEffect(() => {
    const refreshReservationAvailability = () => {
      setAutomaticReservationsClosed(isOnlineReservationClosed());
      setNow(Date.now());
    };
    const interval = window.setInterval(refreshReservationAvailability, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  // Cancelled and rescheduled tournaments are announced; open ones can be joined.
  const notices = getEventNotices(events, now);
  const cancelledNotices = notices.filter((notice) => notice.type === "cancelled");
  const tournamentCards = [
    ...getOpenEvents(events, now).map((event) => ({ event, type: wasRescheduled(event) ? "rescheduled" : "open" })),
    ...cancelledNotices,
  ].sort((first, second) => String(first.event.date || "9999").localeCompare(String(second.event.date || "9999")));

  const changeSlide = (direction) => {
    setActiveSlide((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <main className="guest-template">
      <header className="guest-template-header">
        <div className="guest-template-brand">
          <img src="/Logo.png" alt="Break and Chill Billiard Hall" />
          <span>
            <strong>BREAK &amp; CHILL</strong>
            <small>Billiard Hall</small>
          </span>
        </div>
        <div className="guest-template-actions">
          <button type="button" className="guest-template-link" onClick={onOpenTournaments}>
            <i className="bi bi-trophy"></i>
            Tournaments
          </button>
          <button
            type="button"
            className="guest-template-register"
            onClick={onOpenReservation}
            disabled={reservationsClosed}
            title={reservationsClosed ? reservationClosedMessage : "Reserve a table"}
          >
            {reservationsClosed ? "Reservations Closed" : "Reserve a Table"}
          </button>
        </div>
      </header>

      {reservationsClosed && (
        <div className="guest-reservation-closed" role="status">
          <i className="bi bi-calendar-x" aria-hidden="true"></i>
          <span>
            <strong>Online table reservations are closed.</strong>
            {reservationClosedMessage}
          </span>
        </div>
      )}

      {notices.length > 0 && (
        <div className="guest-event-updates" role="status">
          <i className="bi bi-megaphone-fill" aria-hidden="true"></i>
          <div>
            <strong>Tournament update</strong>
            <ul>
              {notices.map(({ event, type }) => (
                <li key={event.id}>
                  {type === "cancelled"
                    ? `${event.name} on ${formatEventWhen(event.date, event.time)} is cancelled.`
                    : `${event.name} is moved to ${formatEventWhen(event.date, event.time)}.`}
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="guest-event-updates-link" onClick={onOpenTournaments}>
            See details
          </button>
        </div>
      )}

      <section className="guest-template-carousel" aria-label="Break and Chill showcase">
        <button type="button" className="guest-carousel-arrow guest-carousel-arrow-left" onClick={() => changeSlide(-1)} aria-label="Previous slide">
          <i className="bi bi-chevron-left"></i>
        </button>
        <div className="guest-carousel-media">
          <img src="/guest-billiards-hero.png" alt="Billiards table at Break and Chill" style={{ objectPosition: active.position }} />
          <div className="guest-carousel-copy">
            <p>BREAK &amp; CHILL BILLIARD HALL</p>
            <h1>{active.title}</h1>
            <span>{active.copy}</span>
          </div>
        </div>
        <button type="button" className="guest-carousel-arrow guest-carousel-arrow-right" onClick={() => changeSlide(1)} aria-label="Next slide">
          <i className="bi bi-chevron-right"></i>
        </button>
        <div className="guest-carousel-dots">
          {slides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              className={index === activeSlide ? "is-active" : ""}
              onClick={() => setActiveSlide(index)}
              aria-label={`Show ${slide.title}`}
            />
          ))}
        </div>
      </section>

      <section className="guest-template-feature guest-template-feature-first">
        <div className="guest-template-image guest-template-image-table">
          <img src="/guest-billiards-hero.png" alt="Pool table and billiard balls" />
        </div>
        <div className="guest-template-copy">
          <p className="guest-template-eyebrow">The Break &amp; Chill experience</p>
          <h2>More than a game with friends.</h2>
          <p>Settle in for a casual match, train your skills, or spend an evening around the table with your crew.</p>
          <button
            type="button"
            className="guest-template-primary"
            onClick={onOpenReservation}
            disabled={reservationsClosed}
            title={reservationsClosed ? reservationClosedMessage : "Reserve a table"}
          >
            {reservationsClosed ? "Reservations Closed" : "Reserve a Table"}
            <i className={`bi ${reservationsClosed ? "bi-lock" : "bi-arrow-right"}`}></i>
          </button>
        </div>
      </section>

      {tournamentCards.length > 0 && (
        <section className="guest-tournaments" id="tournaments" aria-labelledby="guest-tournaments-title">
          <p className="guest-template-eyebrow">Tournaments &amp; events</p>
          <h2 id="guest-tournaments-title">What&apos;s on at Break &amp; Chill</h2>
          <div className="guest-tournament-list">
            {tournamentCards.slice(0, HOME_TOURNAMENT_LIMIT).map(({ event, type }) => (
              <article key={event.id} className={`guest-tournament-card is-${type}`}>
                <span className={`guest-tournament-badge is-${type}`}>
                  {type === "cancelled" ? "Cancelled" : type === "rescheduled" ? "Rescheduled" : "Open for registration"}
                </span>
                <h3>{event.name}</h3>
                {event.gameType && <span className="guest-tournament-game">{event.gameType}</span>}

                {type === "rescheduled" ? (
                  <div className="guest-tournament-when">
                    <span>
                      <strong>New schedule:</strong> {formatEventWhen(event.date, event.time)}
                    </span>
                    <span className="guest-tournament-old">
                      Was {formatEventWhen(event.rescheduledFrom.date, event.rescheduledFrom.time)}
                    </span>
                  </div>
                ) : (
                  <div className="guest-tournament-when">
                    <span className={type === "cancelled" ? "guest-tournament-old" : ""}>
                      {formatEventWhen(event.date, event.time)}
                    </span>
                  </div>
                )}

                {type === "cancelled" && (
                  <p className="guest-tournament-reason">
                    This tournament will no longer take place.
                    {event.cancelReason ? ` Reason: ${event.cancelReason}` : ""}
                  </p>
                )}
                {type === "rescheduled" && event.rescheduleReason && (
                  <p className="guest-tournament-reason">Reason: {event.rescheduleReason}</p>
                )}

                {type !== "cancelled" && (
                  <>
                    <div className="guest-tournament-meta">
                      <span>Prize pool {formatPrize(event.prize)}</span>
                      <span>{Number(event.entryFee) > 0 ? `Entry ${formatPrize(event.entryFee)}` : "Free entry"}</span>
                    </div>
                    <button type="button" className="guest-template-secondary" onClick={() => onOpenTournamentForm(event.id)}>
                      Register
                      <i className="bi bi-arrow-right"></i>
                    </button>
                  </>
                )}
              </article>
            ))}
          </div>
          <button type="button" className="guest-template-secondary guest-tournaments-all" onClick={onOpenTournaments}>
            {tournamentCards.length > HOME_TOURNAMENT_LIMIT
              ? `See all ${tournamentCards.length} tournaments`
              : "Open the tournaments page"}
            <i className="bi bi-arrow-right"></i>
          </button>
        </section>
      )}

      <section className="guest-template-feature guest-template-feature-reverse">
        <div className="guest-template-copy">
          <p className="guest-template-eyebrow">Tournament registration</p>
          <h2>Join the next rack.</h2>
          <p>Register for active tournaments online, then watch for the latest event details from Break &amp; Chill.</p>
          <div className="guest-template-buttons">
            <button type="button" className="guest-template-primary" onClick={() => onOpenTournamentForm()}>
              Register for Tournament
              <i className="bi bi-arrow-right"></i>
            </button>
            <button type="button" className="guest-template-secondary" onClick={onOpenTournaments}>
              View Upcoming Tournaments
            </button>
          </div>
        </div>
        <div className="guest-template-image guest-template-image-rack">
          <img src="/guest-billiards-hero.png" alt="Racked billiard balls" />
        </div>
      </section>

      <section className="guest-template-qr" id="registration">
        <div className="guest-template-qr-display">
          <img src={registrationQrUrl} alt="QR code for Break and Chill tournament registration" />
          <span>Scan to register</span>
        </div>
        <div className="guest-template-copy">
          <p className="guest-template-eyebrow">At the venue</p>
          <h2>Scan and register from your phone.</h2>
          <p>Open the QR code to share tournament registration with players at Break &amp; Chill.</p>
        </div>
      </section>

      <footer className="guest-template-footer">
        <span>BREAK &amp; CHILL BILLIARD HALL</span>
        <span>Games, tournaments, and good breaks.</span>
      </footer>
    </main>
  );
}
