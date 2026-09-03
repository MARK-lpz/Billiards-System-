import { useEffect, useState } from "react";
import "../../styles/Guest/GuestLanding.css";

const ONLINE_RESERVATION_CLOSE_HOUR = 22;

const isOnlineReservationClosed = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);

  return hour >= ONLINE_RESERVATION_CLOSE_HOUR;
};

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

export default function GuestLanding({ onOpenReservation, onOpenTournamentForm, onlineReservationsOpen = true }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [automaticReservationsClosed, setAutomaticReservationsClosed] = useState(isOnlineReservationClosed);
  const active = slides[activeSlide];
  const reservationsClosed = automaticReservationsClosed || !onlineReservationsOpen;
  const reservationClosedMessage = !onlineReservationsOpen
    ? "Online reservations are temporarily closed by the owner. Please check back later."
    : "Break & Chill closes at 10:00 PM. Please reserve again tomorrow.";

  useEffect(() => {
    const refreshReservationAvailability = () => setAutomaticReservationsClosed(isOnlineReservationClosed());
    const interval = window.setInterval(refreshReservationAvailability, 60_000);

    return () => window.clearInterval(interval);
  }, []);

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
        <button
          type="button"
          className="guest-template-register"
          onClick={onOpenReservation}
          disabled={reservationsClosed}
          title={reservationsClosed ? reservationClosedMessage : "Reserve a table"}
        >
          {reservationsClosed ? "Reservations Closed" : "Reserve a Table"}
        </button>
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

      <section className="guest-template-feature guest-template-feature-reverse">
        <div className="guest-template-copy">
          <p className="guest-template-eyebrow">Tournament registration</p>
          <h2>Join the next rack.</h2>
          <p>Register for active tournaments online, then watch for the latest event details from Break &amp; Chill.</p>
          <button type="button" className="guest-template-primary" onClick={onOpenTournamentForm}>
            Register for Tournament
            <i className="bi bi-arrow-right"></i>
          </button>
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
