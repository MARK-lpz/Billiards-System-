import { useEffect, useState } from "react";
import "../../styles/Guest/GuestLanding.css";
import "../../styles/Guest/TournamentsPage.css";
import AnnouncementBar from "../../Elements/Guest/AnnouncementBar";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import { facebookLinkKind } from "../../utils/siteSettings";
import TournamentShowcase from "../../Elements/Guest/TournamentShowcase";
import { formatEventWhen, getEventNotices, getOpenEvents } from "../../utils/eventUpdates";

/**
 * The public list of tournaments: everything still open for registration, soonest
 * first (the next one large, the rest in rows; see TournamentShowcase), and any
 * that were cancelled so players coming for them know.
 */
export default function TournamentsPage({ events = [], onGoBack, onRegister }) {
  // Refreshed every minute, so a tournament drops off once its day has passed.
  const [now, setNow] = useState(() => Date.now());
  // The footer line and the Facebook link (Admin > Website); the line is blank
  // until the server answers, like the home page's.
  const { settings, loaded, failed } = useSiteSettings();
  const { tagline } = settings.footer;
  const { facebookUrl } = settings.business;
  const facebook = facebookUrl ? facebookLinkKind(facebookUrl) : null;

  useEffect(() => {
    window.scrollTo(0, 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const upcoming = getOpenEvents(events, now);
  const cancelled = getEventNotices(events, now).filter((notice) => notice.type === "cancelled");

  return (
    <main className="guest-template tournaments-page">
      <header className="guest-template-header">
        <button type="button" className="guest-template-brand tournaments-brand" onClick={onGoBack} title="Back to home">
          <img src="/Logo.png" alt="Break and Chill Billiard Hall" />
          <span>
            <strong>BREAK &amp; CHILL</strong>
            <small>Billiard Hall</small>
          </span>
        </button>
        <button type="button" className="guest-template-register" onClick={onGoBack}>
          <i className="bi bi-arrow-left"></i> Home
        </button>
      </header>

      <AnnouncementBar />

      <section className="tournaments-hero">
        <p className="guest-template-eyebrow">Tournaments</p>
        <h1>Upcoming Tournaments</h1>
        <p>
          Pick a tournament, check the schedule and fees, and register online. Schedules that change are marked so you
          always see the latest date.
        </p>
      </section>

      <section className="tournaments-list" aria-label="Upcoming tournaments">
        {upcoming.length === 0 ? (
          <div className="tournaments-empty">
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

      <footer className="guest-template-footer">
        <span className="guest-footer-mark">
          Break &amp; Chill <small>Billiard Hall</small>
        </span>
        {tagline && <span className={`guest-footer-tagline ${loaded || failed ? "" : "is-loading"}`}>{tagline}</span>}
        {facebook && (
          <a className="guest-footer-social" href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label={facebook.label}>
            <i className={`bi ${facebook.icon}`} aria-hidden="true"></i>
          </a>
        )}
      </footer>
    </main>
  );
}
