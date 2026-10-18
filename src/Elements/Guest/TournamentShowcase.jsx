import { useState } from "react";
import "../../styles/Guest/EventMedia.css";
import "../../styles/Guest/TournamentShowcase.css";
import EventMediaViewer from "./EventMediaViewer";
import { eventMediaUrl, getEventMedia } from "../../utils/eventMedia";
import { describeDaysAway, formatEventWhen, gameTypeLabel, getDateTile, wasRescheduled } from "../../utils/eventUpdates";

const peso = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;
const entryLabel = (event) => (Number(event.entryFee) > 0 ? `Entry ${peso(event.entryFee)}` : "Free entry");
const playersLabel = (event) => {
  const players = event.participants?.length || 0;
  return `${players} ${players === 1 ? "player" : "players"} registered`;
};

// The tournament's poster, or its other pictures and videos one at a time
// (arrows, "2 / 3"); clicking it opens the viewer. Without any, a felt with the
// date on it.
function FeaturePoster({ event, media, onOpen }) {
  const [index, setIndex] = useState(0);
  const shown = Math.min(index, media.length - 1);
  const item = media[shown];

  if (!item) {
    const tile = getDateTile(event.date);
    return (
      <div className="tshow-poster is-felt" aria-hidden="true">
        <i className="bi bi-trophy-fill"></i>
        <span>{tile.month}</span> {tile.day !== "--" && <strong>{tile.day}</strong>}
      </div>
    );
  }

  const step = (direction) => setIndex((shown + direction + media.length) % media.length);
  const kind = item.type === "video" ? "video" : "picture";
  return (
    <div className="tshow-poster">
      <button
        type="button"
        className="tshow-poster-open"
        onClick={(click) => onOpen(shown, click.currentTarget)}
        aria-label={`Open ${kind} ${shown + 1} of ${media.length} for ${event.name}`}
      >
        {item.type === "video" ? (
          <>
            <video src={eventMediaUrl(item)} muted playsInline preload="metadata" aria-hidden="true" />
            <i className="bi bi-play-circle-fill tshow-poster-play" aria-hidden="true"></i>
          </>
        ) : (
          <>
            <img className="tshow-poster-blur" src={eventMediaUrl(item)} alt="" aria-hidden="true" />
            <img className="tshow-poster-img" src={eventMediaUrl(item)} alt="" />
          </>
        )}
      </button>
      {media.length > 1 && (
        <>
          <button type="button" className="tshow-poster-step is-prev" onClick={() => step(-1)} aria-label="Previous picture">
            <i className="bi bi-chevron-left" aria-hidden="true"></i>
          </button>
          <button type="button" className="tshow-poster-step is-next" onClick={() => step(1)} aria-label="Next picture">
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </button>
          <span className="tshow-poster-count" aria-live="polite">
            {shown + 1} / {media.length}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * The open tournaments on the website (home page and Tournaments page): the
 * first one large, with its poster, prize pool and Register; the rest as short
 * rows under "More tournaments". `events` are already in order (soonest first);
 * `now` (ms) is the page's clock, for "Tomorrow" and "In 3 days"; `level` is the
 * heading level of the large one's name. Any picture opens the tournament's
 * pictures and videos over the page.
 */
export default function TournamentShowcase({ events = [], now, onRegister, level = 2 }) {
  // The tournament whose pictures and videos are open, and which one is shown first.
  const [viewing, setViewing] = useState(null);
  const [featured, ...rest] = events;
  if (!featured) return null;

  const Title = `h${level}`;
  const SubTitle = `h${Math.min(level + 1, 6)}`;
  const open = (event, startAt, opener) => setViewing({ eventId: event.id, startAt, opener });
  const media = getEventMedia(featured);
  const moved = wasRescheduled(featured);
  const away = describeDaysAway(featured.date, now);
  const viewed = viewing && events.find((event) => event.id === viewing.eventId);

  return (
    <div className="tshow">
      <article className={`tshow-feature ${moved ? "is-rescheduled" : ""}`}>
        <FeaturePoster key={featured.id} event={featured} media={media} onOpen={(index, opener) => open(featured, index, opener)} />

        <div className="tshow-info">
          <div className="tshow-info-top">
            <span className="tshow-eyebrow">{featured.date ? "Next up" : "Coming soon"}</span>
            <span className={`guest-tournament-badge ${moved ? "is-rescheduled" : "is-open"}`}>
              {moved ? "Rescheduled" : "Open for registration"}
            </span>
          </div>
          <Title className="tshow-name">{featured.name}</Title>

          <p className="tshow-when">
            <i className="bi bi-calendar-event" aria-hidden="true"></i>
            {formatEventWhen(featured.date, featured.time)} {away && <span className="tshow-countdown">{away}</span>}
          </p>
          {moved && (
            <p className="tshow-moved">
              Moved from {formatEventWhen(featured.rescheduledFrom.date, featured.rescheduledFrom.time)}
              {featured.rescheduleReason ? `. Reason: ${featured.rescheduleReason}` : ""}
            </p>
          )}

          {Number(featured.prize) > 0 && (
            <div className="tshow-prize">
              <span>Prize pool</span> <strong>{peso(featured.prize)}</strong>
            </div>
          )}

          <ul className="tshow-facts">
            {featured.gameType && (
              <li className="tshow-game">
                <i className="bi bi-circle-fill" aria-hidden="true"></i>
                {gameTypeLabel(featured.gameType)}
              </li>
            )}
            <li>
              <i className="bi bi-ticket-perforated-fill" aria-hidden="true"></i>
              {entryLabel(featured)}
            </li>
            <li>
              <i className="bi bi-people-fill" aria-hidden="true"></i>
              {playersLabel(featured)}
            </li>
          </ul>

          <button type="button" className="guest-template-primary tshow-register" onClick={() => onRegister(featured.id)}>
            Register
            <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </article>

      {rest.length > 0 && (
        <section className="tshow-more">
          <SubTitle className="tshow-more-title">More tournaments</SubTitle>
          <ul className="tshow-list">
            {rest.map((event) => {
              const tile = getDateTile(event.date);
              const rowMoved = wasRescheduled(event);
              const rowAway = describeDaysAway(event.date, now);
              const cover = getEventMedia(event)[0];
              const RowTitle = `h${Math.min(level + 2, 6)}`;
              return (
                <li key={event.id} className={`tshow-row ${rowMoved ? "is-rescheduled" : ""}`}>
                  <div className="tshow-row-date" aria-hidden="true">
                    <span>{tile.month}</span> {tile.day !== "--" && <strong>{tile.day}</strong>}
                  </div>
                  <div className="tshow-row-main">
                    <div className="tshow-row-head">
                      <RowTitle>{event.name}</RowTitle>
                      {rowMoved && <span className="guest-tournament-badge is-rescheduled">Rescheduled</span>}
                    </div>
                    <p className="tshow-row-when">
                      {formatEventWhen(event.date, event.time)} {rowAway && <span className="tshow-countdown">{rowAway}</span>}
                    </p>
                    <p className="tshow-row-facts">
                      {[gameTypeLabel(event.gameType), Number(event.prize) > 0 ? `Prize ${peso(event.prize)}` : "", entryLabel(event), playersLabel(event)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {cover && (
                    <button
                      type="button"
                      className="tshow-row-thumb"
                      onClick={(click) => open(event, 0, click.currentTarget)}
                      aria-label={`See the pictures and videos for ${event.name}`}
                    >
                      {cover.type === "video" ? (
                        <video src={eventMediaUrl(cover)} muted playsInline preload="metadata" aria-hidden="true" />
                      ) : (
                        <img src={eventMediaUrl(cover)} alt="" loading="lazy" />
                      )}
                    </button>
                  )}
                  <button type="button" className="guest-template-secondary tshow-row-register" onClick={() => onRegister(event.id)}>
                    Register
                    <i className="bi bi-arrow-right" aria-hidden="true"></i>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {viewed && (
        <EventMediaViewer
          title={viewed.name}
          media={getEventMedia(viewed)}
          startAt={viewing.startAt}
          returnFocus={viewing.opener}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
