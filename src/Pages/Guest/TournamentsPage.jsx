import { useEffect, useState } from "react";
import "../../styles/Guest/GuestLanding.css";
import "../../styles/Guest/TournamentsPage.css";
import "../../styles/Guest/EventMedia.css";
import EventMediaViewer from "../../Elements/Guest/EventMediaViewer";
import AnnouncementBar from "../../Elements/Guest/AnnouncementBar";
import { eventMediaUrl, getEventMedia } from "../../utils/eventMedia";
import {
  describeDaysAway,
  formatEventWhen,
  getDateTile,
  getEventNotices,
  getOpenEvents,
  wasRescheduled,
} from "../../utils/eventUpdates";

const formatPrize = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;

// How many pictures and videos a tournament shows before "+N more".
const STRIP_SIZE = 4;

/**
 * The public list of tournaments: everything still open for registration, soonest
 * first, and any that were cancelled so players coming for them know.
 */
export default function TournamentsPage({ events = [], onGoBack, onRegister }) {
  // Refreshed every minute, so a tournament drops off once its day has passed.
  const [now, setNow] = useState(() => Date.now());
  // The tournament whose pictures and videos are open, and which one is shown first.
  const [viewing, setViewing] = useState(null);

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
          upcoming.map((event) => {
            const tile = getDateTile(event.date);
            const moved = wasRescheduled(event);
            const players = event.participants?.length || 0;
            const media = getEventMedia(event);

            return (
              <article key={event.id} className={`tournament-row ${moved ? "is-rescheduled" : ""}`}>
                <div className="tournament-date-tile" aria-hidden="true">
                  <span>{tile.month}</span>
                  <strong>{tile.day}</strong>
                </div>

                <div className="tournament-row-body">
                  <div className="tournament-row-head">
                    <h2>{event.name}</h2>
                    <span className={`guest-tournament-badge ${moved ? "is-rescheduled" : "is-open"}`}>
                      {moved ? "Rescheduled" : "Open for registration"}
                    </span>
                  </div>

                  <div className="tournament-row-when">
                    <i className="bi bi-calendar-event" aria-hidden="true"></i>
                    {formatEventWhen(event.date, event.time)}
                    {describeDaysAway(event.date, now) && (
                      <span className="tournament-row-countdown">{describeDaysAway(event.date, now)}</span>
                    )}
                  </div>

                  {moved && (
                    <p className="tournament-row-moved">
                      Moved from {formatEventWhen(event.rescheduledFrom.date, event.rescheduledFrom.time)}
                      {event.rescheduleReason ? `. Reason: ${event.rescheduleReason}` : ""}
                    </p>
                  )}

                  <ul className="tournament-row-facts">
                    {event.gameType && (
                      <li className="tournament-row-game">
                        <i className="bi bi-circle-fill" aria-hidden="true"></i>
                        {event.gameType}
                      </li>
                    )}
                    <li>
                      <i className="bi bi-trophy-fill" aria-hidden="true"></i>
                      Prize pool {formatPrize(event.prize)}
                    </li>
                    <li>
                      <i className="bi bi-ticket-perforated-fill" aria-hidden="true"></i>
                      {Number(event.entryFee) > 0 ? `Entry fee ${formatPrize(event.entryFee)}` : "Free entry"}
                    </li>
                    <li>
                      <i className="bi bi-people-fill" aria-hidden="true"></i>
                      {players} {players === 1 ? "player" : "players"} registered
                    </li>
                  </ul>

                  {/* Promo pictures and videos; each opens the viewer */}
                  {media.length > 0 && (
                    <div className="tournament-media-strip" aria-label={`${event.name} pictures and videos`}>
                      {media.slice(0, STRIP_SIZE).map((item, index) => {
                        const more = index === STRIP_SIZE - 1 ? media.length - STRIP_SIZE : 0;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`tournament-media-thumb ${index === 0 ? "is-cover" : ""}`}
                            onClick={(click) => setViewing({ eventId: event.id, startAt: index, opener: click.currentTarget })}
                            aria-label={
                              more > 0
                                ? `See all ${media.length} pictures and videos`
                                : `Open ${item.type === "video" ? "video" : "picture"} ${index + 1} of ${media.length}`
                            }
                          >
                            {item.type === "video" ? (
                              <video src={eventMediaUrl(item)} muted playsInline preload="metadata" aria-hidden="true" />
                            ) : (
                              <img src={eventMediaUrl(item)} alt="" loading="lazy" />
                            )}
                            {item.type === "video" && !more && <i className="bi bi-play-circle-fill" aria-hidden="true"></i>}
                            {more > 0 && <span className="tournament-media-more">+{more}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button type="button" className="guest-template-primary tournament-row-register" onClick={() => onRegister(event.id)}>
                  Register
                  <i className="bi bi-arrow-right"></i>
                </button>
              </article>
            );
          })
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

      {viewing && (() => {
        const event = events.find((entry) => entry.id === viewing.eventId);
        return event ? (
          <EventMediaViewer
            title={event.name}
            media={getEventMedia(event)}
            startAt={viewing.startAt}
            returnFocus={viewing.opener}
            onClose={() => setViewing(null)}
          />
        ) : null;
      })()}

      <footer className="guest-template-footer">
        <span className="guest-footer-mark">
          Break &amp; Chill <small>Billiard Hall</small>
        </span>
        <span>Games, tournaments, and good breaks.</span>
      </footer>
    </main>
  );
}
