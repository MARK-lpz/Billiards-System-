import { useEffect, useState } from "react";
import "../../styles/Guest/GuestLanding.css";
import { RESERVATION_CLOSED_HOURS_MESSAGE, isOutsideReservationHours } from "../../utils/reservations";
import { formatEventWhen, getDateTile, getEventNotices, getOpenEvents, wasRescheduled } from "../../utils/eventUpdates";

// Closed from 10 PM until opening, not only until midnight.
const isOnlineReservationClosed = () => isOutsideReservationHours();

// The showcase at the top of the page: one picture, shown with each slide's words.
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

// The showcase moves to the next slide on its own after this long.
const SLIDE_INTERVAL = 5000;

const registrationQrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=520x520&data=https%3A%2F%2Fbreakandchill.com%2F&bgcolor=ffffff&color=0b0d0c&margin=12&format=png";

const formatPrize = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;

// How an online booking goes, each step on a numbered ball in that ball's color.
const bookingSteps = [
  { ball: 1, title: "Pick a table and time", copy: "Choose the date, an open table, your start time, and how many hours you want to play." },
  { ball: 2, title: "Pay with GCash", copy: "Send the payment and enter the reference number from your receipt to hold the table." },
  { ball: 3, title: "Get confirmed", copy: "The front desk checks your payment and approves the booking. Your table is waiting when you arrive." },
];

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
  // The showcase holds still while a mouse is over it or a keyboard user is inside it.
  const [showcaseHovered, setShowcaseHovered] = useState(false);
  const [showcaseFocused, setShowcaseFocused] = useState(false);
  const showcasePaused = showcaseHovered || showcaseFocused;
  // Refreshed every minute with the reservation check, so a past event drops off.
  const [now, setNow] = useState(() => Date.now());
  const [automaticReservationsClosed, setAutomaticReservationsClosed] = useState(isOnlineReservationClosed);
  const reservationsClosed = automaticReservationsClosed || !onlineReservationsOpen;
  const reservationClosedMessage = !onlineReservationsOpen
    ? "Online reservations are temporarily closed by the owner. Please check back later."
    : RESERVATION_CLOSED_HOURS_MESSAGE;
  const reserveLabel = reservationsClosed ? "Reservations Closed" : "Reserve a Table";
  const reserveTitle = reservationsClosed ? reservationClosedMessage : "Reserve a table";

  useEffect(() => {
    const refreshReservationAvailability = () => {
      setAutomaticReservationsClosed(isOnlineReservationClosed());
      setNow(Date.now());
    };
    const interval = window.setInterval(refreshReservationAvailability, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  // Moves on by itself. Any slide change (by hand too) restarts the wait, so a
  // picked slide gets its full time. Visitors who ask for less motion are not
  // moved; they still have the arrows and bars.
  useEffect(() => {
    if (showcasePaused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL);

    return () => window.clearTimeout(timer);
  }, [activeSlide, showcasePaused]);

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
            title={reserveTitle}
          >
            {reserveLabel}
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

      <section className="guest-showcase" aria-label="Break and Chill showcase">
        {/* Slides sit side by side on a track that slides over; the arrows and the
            bar indicators sit on top of the picture. */}
        {/* Touch taps and mouse clicks focus the buttons too, so only a mouse
            pointer and keyboard focus pause it; a tap must not stop it for good. */}
        <div
          className="guest-template-carousel"
          onPointerEnter={(event) => event.pointerType === "mouse" && setShowcaseHovered(true)}
          onPointerLeave={(event) => event.pointerType === "mouse" && setShowcaseHovered(false)}
          onFocus={(event) => event.target.matches(":focus-visible") && setShowcaseFocused(true)}
          onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setShowcaseFocused(false)}
        >
          <div
            className="guest-carousel-track"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            aria-live={showcasePaused ? "polite" : "off"}
          >
            {slides.map((slide, index) => (
              <div key={slide.title} className="guest-carousel-slide" aria-hidden={index !== activeSlide}>
                <img src="/guest-billiards-hero.png" alt="" style={{ objectPosition: slide.position }} />
                <div className="guest-carousel-caption">
                  <p>BREAK &amp; CHILL BILLIARD HALL</p>
                  {index === activeSlide ? <h1>{slide.title}</h1> : <h2>{slide.title}</h2>}
                  <span>{slide.copy}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="guest-carousel-control guest-carousel-control-prev" onClick={() => changeSlide(-1)} aria-label="Previous slide">
            <i className="bi bi-chevron-left" aria-hidden="true"></i>
          </button>
          <button type="button" className="guest-carousel-control guest-carousel-control-next" onClick={() => changeSlide(1)} aria-label="Next slide">
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </button>
          <div className="guest-carousel-indicators">
            {slides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                className={index === activeSlide ? "is-active" : ""}
                onClick={() => setActiveSlide(index)}
                aria-label={`Show ${slide.title}`}
                aria-current={index === activeSlide ? "true" : undefined}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Laid out on the felt, between two rails (see .guest-steps in GuestLanding.css) */}
      <section className="guest-steps" aria-labelledby="guest-steps-title">
        <div className="guest-section-head">
          <p className="guest-template-eyebrow">Book online</p>
          <h2 id="guest-steps-title">Your table in three shots.</h2>
        </div>
        <ol className="guest-steps-list">
          {bookingSteps.map((step) => (
            <li key={step.ball} className="guest-step">
              <span className={`guest-ball guest-ball-${step.ball}`} aria-hidden="true">
                <span>{step.ball}</span>
              </span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="guest-template-primary guest-steps-cta"
          onClick={onOpenReservation}
          disabled={reservationsClosed}
          title={reserveTitle}
        >
          {reserveLabel}
          <i className={`bi ${reservationsClosed ? "bi-lock" : "bi-arrow-right"}`}></i>
        </button>
      </section>

      {tournamentCards.length > 0 && (
        <section className="guest-tournaments" id="tournaments" aria-labelledby="guest-tournaments-title">
          <div className="guest-section-head">
            <p className="guest-template-eyebrow">Tournaments &amp; events</p>
            <h2 id="guest-tournaments-title">What&apos;s on at Break &amp; Chill</h2>
          </div>
          <div className="guest-tournament-list">
            {tournamentCards.slice(0, HOME_TOURNAMENT_LIMIT).map(({ event, type }) => {
              const tile = getDateTile(event.date);

              return (
                <article key={event.id} className={`guest-tournament-card is-${type}`}>
                  <div className="guest-ticket-stub" aria-hidden="true">
                    <span>{tile.month}</span>
                    <strong>{tile.day}</strong>
                  </div>

                  <div className="guest-ticket-body">
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
                          <span>
                            <i className="bi bi-trophy-fill" aria-hidden="true"></i>
                            Prize pool {formatPrize(event.prize)}
                          </span>
                          <span>
                            <i className="bi bi-ticket-perforated-fill" aria-hidden="true"></i>
                            {Number(event.entryFee) > 0 ? `Entry ${formatPrize(event.entryFee)}` : "Free entry"}
                          </span>
                        </div>
                        <button type="button" className="guest-template-secondary" onClick={() => onOpenTournamentForm(event.id)}>
                          Register
                          <i className="bi bi-arrow-right"></i>
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <button type="button" className="guest-template-secondary guest-tournaments-all" onClick={onOpenTournaments}>
            {tournamentCards.length > HOME_TOURNAMENT_LIMIT
              ? `See all ${tournamentCards.length} tournaments`
              : "Open the tournaments page"}
            <i className="bi bi-arrow-right"></i>
          </button>
        </section>
      )}

      <section className="guest-join" id="registration" aria-labelledby="guest-join-title">
        <div className="guest-template-copy">
          <p className="guest-template-eyebrow">Tournament registration</p>
          <h2 id="guest-join-title">Join the next rack.</h2>
          <p>
            Register for open tournaments online, then watch this page for the latest schedule. At the hall, scan the code
            to sign up from your phone.
          </p>
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
        <figure className="guest-poster">
          <img src={registrationQrUrl} alt="QR code for Break and Chill tournament registration" />
          <figcaption>
            <strong>Scan to register</strong>
            <span>breakandchill.com</span>
          </figcaption>
        </figure>
      </section>

      <footer className="guest-template-footer">
        <span className="guest-footer-mark">
          Break &amp; Chill <small>Billiard Hall</small>
        </span>
        <span>Games, tournaments, and good breaks.</span>
      </footer>
    </main>
  );
}
