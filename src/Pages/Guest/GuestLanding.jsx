import { useEffect, useState } from "react";
import "../../styles/Guest/GuestLanding.css";
import "../../styles/Guest/EventMedia.css";
import { eventMediaUrl, getEventCover } from "../../utils/eventMedia";
import { formatOpeningHours, formatReservationTime } from "../../utils/reservations";
import { describeClosingForGuests } from "../../utils/onlineBookingSwitch";
import { formatEventWhen, getOpenEvents } from "../../utils/eventUpdates";
import TournamentShowcase from "../../Elements/Guest/TournamentShowcase";
import { facebookLinkKind, slidePictureUrl } from "../../utils/siteSettings";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import GuestHeader from "../../Elements/Guest/GuestHeader";
import GuestFooter from "../../Elements/Guest/GuestFooter";
import ContactLinks from "../../Elements/Guest/ContactLinks";
import AnnouncementList from "../../Elements/Guest/AnnouncementList";
import { useReservationState } from "../../Elements/Guest/useReservationState";
import { useAnnouncements } from "../../Elements/Guest/useAnnouncements";

// The showcase at the top of the page: open tournaments with a promo picture or
// video first (see promoSlides), then the hall's own slides, each a photo with
// its words (Admin > Website). The arrows and the dots under it pick one.

// At most this many tournaments get a slide, soonest first.
const PROMO_SLIDE_LIMIT = 5;

// Visitors who ask for less motion get promo videos paused, with their controls.
const prefersReducedMotion =
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

// The showcase moves to the next slide on its own after this long.
const SLIDE_INTERVAL = 5000;

const formatPrize = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`;

// "9-ball" reads "9-Ball", "straight-pool" reads "Straight-Pool".
const formatGameType = (type) => String(type || "").replace(/(^|[\s-])([a-z])/g, (match, gap, letter) => gap + letter.toUpperCase());

// The home page shows the first few; the Tournaments page lists them all.
const HOME_TOURNAMENT_LIMIT = 3;

// The same for the announcements and the Announcements page.
const HOME_NEWS_LIMIT = 3;

/**
 * The public home page. Each part follows what there is to show: a slide with
 * its own photo shows it, the booking steps turn into "book at the hall" when
 * online booking is off, the tournaments take as much room as there are of
 * them, and the announcements show only when there are some. About us has its
 * own page (AboutPage.jsx).
 */
export default function GuestLanding({
  // Opens another public page by its view (App.jsx): "tournaments", "announcements", ...
  onNavigate,
  onOpenReservation,
  onOpenTournamentForm,
  onlineReservationsOpen = true,
  // Why online bookings are closed and until when (see utils/onlineBookingSwitch.js).
  onlineReservationsStatus = {},
  events = [],
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  // The showcase holds still while a mouse is over it or a keyboard user is inside it.
  const [showcaseHovered, setShowcaseHovered] = useState(false);
  const [showcaseFocused, setShowcaseFocused] = useState(false);
  const showcasePaused = showcaseHovered || showcaseFocused;
  // The hall's hours, contacts and home page words (Admin > Website).
  const { settings, loaded, failed } = useSiteSettings();
  const { hours, business, showcase, bookingSteps } = settings;
  // Until the server answers, the admin's words and photos are not known yet:
  // their places are kept but blank (is-loading), so the old ones never flash
  // first. If the server cannot be reached, the defaults show.
  const contentReady = loaded || failed;
  // Whether a table can be booked online now, and why not. Its `now` is
  // refreshed every minute, so a past event drops off too.
  const reservation = useReservationState(onlineReservationsOpen, onlineReservationsStatus);
  const { now, reservationsClosed, reserveLabel, reserveTitle, bookingMode } = reservation;
  const news = useAnnouncements(events, reservation);
  const facebook = business.facebookUrl ? facebookLinkKind(business.facebookUrl) : null;

  // Each open tournament with a promo picture or video gets its own slide.
  const promoSlides = getOpenEvents(events, now)
    .map((event) => ({ event, cover: getEventCover(event) }))
    .filter(({ cover }) => cover)
    .slice(0, PROMO_SLIDE_LIMIT)
    .map(({ event, cover }) => ({ key: `event-${event.id}`, title: event.name, event, cover }));
  const hallSlides = showcase.slides.map((slide) => ({ ...slide, key: `site-${slide.id}` }));
  const slides = [...promoSlides, ...hallSlides];
  const slideCount = slides.length;
  // One slide stands still, without arrows, dots or peeks.
  const sliding = slideCount > 1;
  // A tournament that drops off can leave the index past the end.
  const shownSlide = Math.min(activeSlide, slideCount - 1);

  // Moves on by itself. Any slide change (by hand too) restarts the wait, so a
  // picked slide gets its full time. Visitors who ask for less motion are not
  // moved; they still have the arrows and the dots.
  useEffect(() => {
    if (!sliding || showcasePaused || prefersReducedMotion) return undefined;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => (Math.min(current, slideCount - 1) + 1) % slideCount);
    }, SLIDE_INTERVAL);

    return () => window.clearTimeout(timer);
  }, [activeSlide, showcasePaused, slideCount, sliding]);

  // Open tournaments (rescheduled included) can be joined, and take the room
  // there is; moved and cancelled ones are announced under them.
  const homeTournaments = getOpenEvents(events, now).slice(0, HOME_TOURNAMENT_LIMIT);
  const homeNews = news.items.slice(0, HOME_NEWS_LIMIT);
  // The picture beside them: the announcement's own (Admin > Website), else
  // the poster of a tournament among them, else the felt with the hall's sign.
  const newsPicture = homeNews
    .map((item) => item.announcement?.image || (item.event ? getEventCover(item.event) : null))
    .find((media) => media?.type === "image");

  const changeSlide = (direction) => {
    setActiveSlide((current) => (Math.min(current, slideCount - 1) + direction + slideCount) % slideCount);
  };

  // The slide before or after (`index`), peeking out beside the frame: its
  // picture and name only, darker and smaller. A click on it goes there; the
  // arrows are the way for keyboards and screen readers. With two slides the
  // other one shows on both sides, so neither side is ever empty.
  const renderPeek = (side, index) => (
    <div className={`guest-carousel-peek is-${side}`} aria-hidden="true" onClick={() => changeSlide(side === "prev" ? -1 : 1)}>
      {slides.map((slide, slideIndex) => {
        const picture = slide.event ? (slide.cover.type === "image" ? eventMediaUrl(slide.cover) : "") : slidePictureUrl(slide);
        return (
          <div key={slide.key} className={`guest-peek-card${slideIndex === index ? " is-active" : ""}`}>
            {picture ? (
              <img src={picture} alt="" loading="lazy" style={slide.event ? undefined : { objectPosition: slide.position }} />
            ) : (
              <div className={slide.event ? "guest-peek-dark" : "guest-carousel-felt"}></div>
            )}
            <span className="guest-peek-title">{slide.title}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <main className="guest-template">
      <GuestHeader
        page="guest"
        onNavigate={onNavigate}
        onOpenReservation={onOpenReservation}
        reservation={reservation}
        newsCount={news.unseen}
      />

      {/* The showcase: the shown slide in a lit frame in the middle, the one
          before and the one after peeking out on either side (a click on one
          goes there), and dots under it. */}
      <section className={`guest-showcase ${contentReady ? "" : "is-loading"}`} aria-label="Break and Chill showcase">
        {/* Touch taps and mouse clicks focus the buttons too, so only a mouse
            pointer and keyboard focus pause it; a tap must not stop it for good. */}
        <div
          className={`guest-carousel-stage${sliding ? " is-sliding" : ""}`}
          onPointerEnter={(event) => event.pointerType === "mouse" && setShowcaseHovered(true)}
          onPointerLeave={(event) => event.pointerType === "mouse" && setShowcaseHovered(false)}
          onFocus={(event) => event.target.matches(":focus-visible") && setShowcaseFocused(true)}
          onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setShowcaseFocused(false)}
        >
          {sliding && renderPeek("prev", (shownSlide - 1 + slideCount) % slideCount)}
          <div className="guest-carousel-frame">
            {/* Every slide in the same place; the shown one fades in over the others. */}
            <div className="guest-template-carousel" aria-live={showcasePaused ? "polite" : "off"}>
                {slides.map((slide, index) => {
                  const active = index === shownSlide;
                  const Heading = active ? "h1" : "h2";

                  if (slide.event) {
                    const { event, cover } = slide;
                    return (
                      <div key={slide.key} className={`guest-carousel-slide guest-promo-slide${active ? " is-active" : ""}`} aria-hidden={!active} inert={!active}>
                        {cover.type === "image" && <img className="guest-promo-backdrop" src={eventMediaUrl(cover)} alt="" />}
                        <div className="guest-promo">
                          <div className="guest-promo-copy">
                            <p>
                              <i className="bi bi-trophy-fill" aria-hidden="true"></i> Tournament ·{" "}
                              {formatEventWhen(event.date, event.time)}
                            </p>
                            <Heading>{event.name}</Heading>
                            <span>
                              Prize pool {formatPrize(event.prize)} ·{" "}
                              {Number(event.entryFee) > 0 ? `Entry ${formatPrize(event.entryFee)}` : "Free entry"}
                              {event.gameType ? ` · ${formatGameType(event.gameType)}` : ""}
                            </span>
                            <div className="guest-promo-actions">
                              <button type="button" className="guest-template-primary" onClick={() => onOpenTournamentForm(event.id)}>
                                Register
                                <i className="bi bi-arrow-right"></i>
                              </button>
                              <button type="button" className="guest-template-secondary" onClick={() => onNavigate("tournaments")}>
                                Details
                              </button>
                            </div>
                          </div>
                          <div className="guest-promo-media">
                            {cover.type === "video" ? (
                              active && (
                                <video
                                  src={eventMediaUrl(cover)}
                                  muted
                                  loop
                                  playsInline
                                  autoPlay={!prefersReducedMotion}
                                  controls={prefersReducedMotion}
                                  preload="metadata"
                                  aria-label={`${event.name} video`}
                                />
                              )
                            ) : (
                              <img src={eventMediaUrl(cover)} alt={`${event.name} poster`} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // The hall's own slide: its photo (or the felt, with the sign
                  // glowing on its empty side), the words on the left with the ways
                  // in: a table, or the tournaments.
                  const picture = slidePictureUrl(slide);
                  return (
                    <div
                      key={slide.key}
                      className={`guest-carousel-slide${picture ? " has-photo" : ""}${active ? " is-active" : ""}`}
                      aria-hidden={!active}
                      inert={!active}
                    >
                      {picture ? (
                        <img src={picture} alt="" style={{ objectPosition: slide.position }} />
                      ) : (
                        <div className="guest-carousel-felt" aria-hidden="true">
                          <img className="guest-carousel-mark" src="/Logo.png" alt="" />
                        </div>
                      )}
                      <div className="guest-carousel-caption">
                        <p>BREAK &amp; CHILL BILLIARD HALL</p>
                        <Heading>{slide.title}</Heading>
                        {slide.text && <span>{slide.text}</span>}
                        <div className="guest-carousel-actions">
                          <button
                            type="button"
                            className="guest-template-primary"
                            onClick={onOpenReservation}
                            disabled={reservationsClosed}
                            title={reserveTitle}
                          >
                            {reserveLabel}
                            <i className={`bi ${reservationsClosed ? "bi-lock" : "bi-arrow-right"}`} aria-hidden="true"></i>
                          </button>
                          <button type="button" className="guest-template-secondary" onClick={() => onNavigate("tournaments")}>
                            <i className="bi bi-trophy" aria-hidden="true"></i>
                            Tournaments
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {sliding && (
              <>
                <button type="button" className="guest-carousel-control is-prev" onClick={() => changeSlide(-1)} aria-label="Previous slide">
                  <i className="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
                <button type="button" className="guest-carousel-control is-next" onClick={() => changeSlide(1)} aria-label="Next slide">
                  <i className="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
              </>
            )}
          </div>
          {sliding && renderPeek("next", (shownSlide + 1) % slideCount)}
        </div>

        {sliding && (
          <div className="guest-carousel-dots">
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className={index === shownSlide ? "is-active" : ""}
                onClick={() => setActiveSlide(index)}
                aria-label={`Show slide ${index + 1}: ${slide.title}`}
                aria-current={index === shownSlide ? "true" : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* How an online booking goes (Admin > Website), each step on a numbered
          ball in that ball's color, laid out on the felt between two rails
          (see .guest-steps in GuestLanding.css). When tables can only be booked
          at the hall, the felt says so instead, with the ways to reach it. */}
      {bookingMode === "hall" ? (
        <section className="guest-steps is-hall" aria-labelledby="guest-steps-title">
          <div className="guest-section-head">
            <p className="guest-template-eyebrow">Reserve a table</p>
            <h2 id="guest-steps-title">Book at the hall for now.</h2>
          </div>
          <p className="guest-steps-note">
            {!onlineReservationsOpen ? describeClosingForGuests(onlineReservationsStatus) : "Online booking is not available yet."}{" "}
            {business.phone && business.facebookUrl
              ? "Walk in, or call or message us to ask about a table."
              : business.phone
                ? "Walk in, or call us to ask about a table."
                : business.facebookUrl
                  ? "Walk in, or message us to ask about a table."
                  : "Walk in and ask the front desk for a table."}
          </p>
          <p className="guest-steps-hours">
            <i className="bi bi-clock-fill" aria-hidden="true"></i> Open {formatOpeningHours(hours)}
          </p>
          <ContactLinks business={business} className="guest-steps-contact" />
        </section>
      ) : (
        <section className={`guest-steps ${contentReady ? "" : "is-loading"}`} aria-labelledby="guest-steps-title">
          <div className="guest-section-head">
            <p className="guest-template-eyebrow">Book online</p>
            <h2 id="guest-steps-title">{bookingSteps.heading}</h2>
          </div>
          <ol className="guest-steps-list">
            {bookingSteps.steps.map((step, index) => (
              <li key={index} className="guest-step">
                <span className={`guest-ball guest-ball-${index + 1}`} aria-hidden="true">
                  <span>{index + 1}</span>
                </span>
                <div className="guest-step-copy">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
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
            {bookingMode === "later" ? `Booking opens at ${formatReservationTime(hours.open)}` : reserveLabel}
            <i className={`bi ${reservationsClosed ? "bi-lock" : "bi-arrow-right"}`}></i>
          </button>
        </section>
      )}

      {/* The open tournaments: the next one large with its poster, the
          others (up to HOME_TOURNAMENT_LIMIT in all) in rows under it. */}
      <section className="guest-tournaments" id="tournaments" aria-labelledby="guest-tournaments-title">
        <div className="guest-section-head">
          <p className="guest-template-eyebrow">Tournaments &amp; events</p>
          <h2 id="guest-tournaments-title">What&apos;s on at Break &amp; Chill</h2>
          {homeTournaments.length > 0 && (
            <p className="guest-section-lead">Register online for an open tournament, then watch this page for schedule changes.</p>
          )}
        </div>

        {homeTournaments.length > 0 ? (
          <TournamentShowcase events={homeTournaments} now={now} onRegister={onOpenTournamentForm} level={3} />
        ) : (
          <p className="guest-tournaments-empty">
            <i className="bi bi-trophy" aria-hidden="true"></i>
            <span>
              No tournaments are open for registration right now.{" "}
              {facebook ? (
                <>
                  {facebook.name === "Messenger" ? "Message us on " : "Follow us on "}
                  <a href={business.facebookUrl} target="_blank" rel="noopener noreferrer">
                    {facebook.name}
                  </a>{" "}
                  {facebook.name === "Messenger" ? "to ask about the next one." : "for the next one."}
                </>
              ) : (
                "Check back soon."
              )}
            </span>
          </p>
        )}

      </section>

      {/* The hall's news (see useAnnouncements), under the tournaments it is
          often about: the newest few on the left, a picture on the right (the
          tournaments above have theirs on the left), all of them on the
          Announcements page. Nothing shows when there is none. */}
      {homeNews.length > 0 && (
        <section className="guest-home-news" aria-labelledby="guest-news-title">
          <div className="guest-home-news-copy">
            <div className="guest-section-head">
              <p className="guest-template-eyebrow">Announcements</p>
              <h2 id="guest-news-title">News from the hall</h2>
            </div>
            <AnnouncementList items={homeNews} compact />
            {news.items.length > HOME_NEWS_LIMIT && (
              <button type="button" className="guest-home-news-more" onClick={() => onNavigate("announcements")}>
                See all {news.items.length} announcements
                <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </button>
            )}
          </div>
          <div className="guest-home-news-picture" aria-hidden="true">
            {newsPicture ? (
              <>
                <img className="guest-home-news-blur" src={eventMediaUrl(newsPicture)} alt="" />
                <img className="guest-home-news-img" src={eventMediaUrl(newsPicture)} alt="" />
              </>
            ) : (
              <div className="guest-carousel-felt">
                <img className="guest-home-news-mark" src="/Logo.png" alt="" />
              </div>
            )}
          </div>
        </section>
      )}

      <GuestFooter />
    </main>
  );
}
