import { useEffect, useState } from "react";
import "../../styles/Guest/GuestLanding.css";
import "../../styles/Guest/EventMedia.css";
import { eventMediaUrl, getEventCover } from "../../utils/eventMedia";
import { describeClosedHours, formatOpeningHours, formatReservationTime, isOutsideReservationHours } from "../../utils/reservations";
import { formatEventWhen, getDateTile, getEventNotices, getOpenEvents, wasRescheduled } from "../../utils/eventUpdates";
import { dayInManila, facebookLinkKind, hasBusinessInfo, isAnnouncementShowing, slidePictureUrl, telLink } from "../../utils/siteSettings";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import { useMyRequests } from "../../Elements/Guest/useMyRequests";
import MyRequestsPanel from "../../Elements/Guest/MyRequestsPanel";

// The showcase at the top of the page: open tournaments with a promo picture or
// video first (see promoSlides), then the hall's own slides, each a photo with
// its words (Admin > Website).

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

/**
 * The public home page. Each part follows what there is to show: the notices
 * share one strip, a slide with its own photo shows it, the booking steps turn
 * into "book at the hall" when online booking is off, the tournaments take as
 * much room as there are of them, and Visit us is one line until the hall's
 * address or contacts are set.
 */
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
  // This visitor's own bookings and sign-ups (kept in this browser): a notice
  // when one is decided, and all of them under My bookings.
  const myRequests = useMyRequests();
  const [requestsOpen, setRequestsOpen] = useState(false);
  // Refreshed every minute, so the reservation check follows the clock and a past event drops off.
  const [now, setNow] = useState(() => Date.now());
  // The hall's hours, contacts, GCash account and home page words (Admin > Website).
  // Bookings are paid by GCash, so none are taken until the admin has set the account.
  const { settings, loaded, failed } = useSiteSettings();
  const { hours, business, gcash, announcement, showcase, bookingSteps, footer } = settings;
  // Until the server answers, the admin's words and photos are not known yet:
  // their places are kept but blank (is-loading), so the old ones never flash
  // first. If the server cannot be reached, the defaults show.
  const contentReady = loaded || failed;
  const paymentUnavailable = loaded && !gcash.ready;
  // Closed from closing until opening, not only until midnight.
  const afterHours = isOutsideReservationHours(new Date(now), hours);
  const reservationsClosed = afterHours || !onlineReservationsOpen || paymentUnavailable;
  const reservationClosedMessage = !onlineReservationsOpen
    ? "Online reservations are temporarily closed by the owner. Please check back later."
    : paymentUnavailable
      ? `Online booking is not available yet. Please book at the hall${business.phone ? ` or call ${business.phone}` : ""}.`
      : describeClosedHours(hours);
  const reserveLabel = reservationsClosed ? "Reservations Closed" : "Reserve a Table";
  const reserveTitle = reservationsClosed ? reservationClosedMessage : "Reserve a table";
  // How tables are booked right now: online, online but not at this hour, or only at the hall.
  const bookingMode = !onlineReservationsOpen || paymentUnavailable ? "hall" : afterHours ? "later" : "online";
  const facebook = business.facebookUrl ? facebookLinkKind(business.facebookUrl) : null;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);

    return () => window.clearInterval(interval);
  }, []);

  // Each open tournament with a promo picture or video gets its own slide.
  const promoSlides = getOpenEvents(events, now)
    .map((event) => ({ event, cover: getEventCover(event) }))
    .filter(({ cover }) => cover)
    .slice(0, PROMO_SLIDE_LIMIT)
    .map(({ event, cover }) => ({ key: `event-${event.id}`, title: event.name, event, cover }));
  const hallSlides = showcase.slides.map((slide) => ({ ...slide, key: `site-${slide.id}` }));
  const slides = [...promoSlides, ...hallSlides];
  const slideCount = slides.length;
  // One slide stands still, without arrows or bars.
  const sliding = slideCount > 1;
  // A tournament that drops off can leave the index past the end.
  const shownSlide = Math.min(activeSlide, slideCount - 1);

  // Moves on by itself. Any slide change (by hand too) restarts the wait, so a
  // picked slide gets its full time. Visitors who ask for less motion are not
  // moved; they still have the arrows and bars.
  useEffect(() => {
    if (!sliding || showcasePaused || prefersReducedMotion) return undefined;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => (Math.min(current, slideCount - 1) + 1) % slideCount);
    }, SLIDE_INTERVAL);

    return () => window.clearTimeout(timer);
  }, [activeSlide, showcasePaused, slideCount, sliding]);

  // Cancelled and rescheduled tournaments are announced in the notices; open
  // ones (rescheduled included) can be joined, and take the room there is.
  const notices = getEventNotices(events, now);
  const openTournaments = getOpenEvents(events, now);
  const homeTournaments = openTournaments.slice(0, HOME_TOURNAMENT_LIMIT);
  const announcementShowing = isAnnouncementShowing(announcement, dayInManila(now));
  const hasNotices = myRequests.unseen.length > 0 || announcementShowing || reservationsClosed || notices.length > 0;

  // Opening My bookings counts as seeing what is new there.
  const openMyRequests = () => {
    myRequests.unseen.forEach((request) => myRequests.markSeen(request));
    setRequestsOpen(true);
  };

  const changeSlide = (direction) => {
    setActiveSlide((current) => (Math.min(current, slideCount - 1) + direction + slideCount) % slideCount);
  };

  // Call, Message us and Open in Maps, for whichever the admin has set.
  const contactLinks = [
    business.mapsUrl && { key: "maps", href: business.mapsUrl, icon: "bi-map", label: "Open in Maps", external: true },
    business.phone && { key: "call", href: telLink(business.phone), icon: "bi-telephone", label: "Call", external: false },
    business.facebookUrl && { key: "message", href: business.facebookUrl, icon: "bi-messenger", label: "Message us", external: true },
  ].filter(Boolean);
  const renderContactLinks = (className) =>
    contactLinks.map((link) => (
      <a
        key={link.key}
        className={className}
        href={link.href}
        {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <i className={`bi ${link.icon}`} aria-hidden="true"></i>
        {link.label}
      </a>
    ));

  return (
    <main className="guest-template">
      {requestsOpen && (
        <MyRequestsPanel requests={myRequests.requests} onForget={myRequests.forget} onClose={() => setRequestsOpen(false)} />
      )}
      <header className="guest-template-header">
        <div className="guest-template-brand">
          <img src="/Logo.png" alt="Break and Chill Billiard Hall" />
          <span>
            <strong>BREAK &amp; CHILL</strong>
            <small>Billiard Hall</small>
          </span>
        </div>
        <div className={`guest-template-actions${myRequests.requests.length > 0 ? " has-my-requests" : ""}`}>
          {myRequests.requests.length > 0 && (
            <button
              type="button"
              className="guest-template-link guest-my-requests-btn"
              onClick={openMyRequests}
              aria-label={`My bookings${myRequests.unseen.length ? `, ${myRequests.unseen.length} new` : ""}`}
            >
              <i className="bi bi-receipt" aria-hidden="true"></i>
              <span className="guest-template-link-text">My bookings</span>
              {myRequests.unseen.length > 0 && <span className="guest-my-requests-dot" aria-hidden="true"></span>}
            </button>
          )}
          <button type="button" className="guest-template-link" onClick={onOpenTournaments} aria-label="Tournaments">
            <i className="bi bi-trophy" aria-hidden="true"></i>
            <span className="guest-template-link-text">Tournaments</span>
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

      {/* Every notice in one strip, one line each, so the showcase stays near the top. */}
      {hasNotices && (
        <div className="guest-notices" role="status">
          {/* The visitor's own news first: a booking or sign-up that was decided. */}
          {myRequests.unseen.map((request) => (
            <div key={request.key} className={`guest-notice is-request is-${request.info.tone}`}>
              <i className={`bi ${request.info.icon}`} aria-hidden="true"></i>
              <p>
                <strong>{request.info.title}:</strong> {request.info.label}. {request.info.detail}
              </p>
              <button type="button" className="guest-notice-link" onClick={() => myRequests.markSeen(request)}>
                Got it
              </button>
            </div>
          ))}
          {announcementShowing && (
            <div className="guest-notice is-announcement">
              <i className="bi bi-megaphone-fill" aria-hidden="true"></i>
              <p>{announcement.message}</p>
            </div>
          )}
          {reservationsClosed && (
            <div className="guest-notice is-closed">
              <i className="bi bi-calendar-x" aria-hidden="true"></i>
              <p>
                <strong>Online table reservations are closed.</strong> {reservationClosedMessage}
              </p>
            </div>
          )}
          {notices.map(({ event, type }) => (
            <div key={event.id} className={`guest-notice is-${type}`}>
              <i className={`bi ${type === "cancelled" ? "bi-x-octagon-fill" : "bi-calendar2-week-fill"}`} aria-hidden="true"></i>
              <p>
                <strong>{type === "cancelled" ? "Cancelled:" : "Moved:"}</strong>{" "}
                {type === "cancelled"
                  ? `${event.name} on ${formatEventWhen(event.date, event.time)} is cancelled.`
                  : `${event.name} is moved to ${formatEventWhen(event.date, event.time)}.`}
              </p>
              <button type="button" className="guest-notice-link" onClick={onOpenTournaments}>
                Details
              </button>
            </div>
          ))}
        </div>
      )}

      <section className={`guest-showcase ${contentReady ? "" : "is-loading"}`} aria-label="Break and Chill showcase">
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
            style={{ transform: `translateX(-${shownSlide * 100}%)` }}
            aria-live={showcasePaused ? "polite" : "off"}
          >
            {slides.map((slide, index) => {
              const active = index === shownSlide;
              const Heading = active ? "h1" : "h2";

              if (slide.event) {
                const { event, cover } = slide;
                return (
                  <div key={slide.key} className="guest-carousel-slide guest-promo-slide" aria-hidden={!active} inert={!active}>
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
                          <button type="button" className="guest-template-secondary" onClick={onOpenTournaments}>
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

              // A slide with the hall's own photo keeps it in view: a lighter
              // shade, and the words at the bottom. The site's picture keeps them centred.
              return (
                <div
                  key={slide.key}
                  className={`guest-carousel-slide ${slide.image ? "has-photo" : ""}`}
                  aria-hidden={!active}
                  inert={!active}
                >
                  <img src={slidePictureUrl(slide)} alt="" style={{ objectPosition: slide.position }} />
                  <div className="guest-carousel-caption">
                    <p>BREAK &amp; CHILL BILLIARD HALL</p>
                    <Heading>{slide.title}</Heading>
                    {slide.text && <span>{slide.text}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {sliding && (
            <>
              <button type="button" className="guest-carousel-control guest-carousel-control-prev" onClick={() => changeSlide(-1)} aria-label="Previous slide">
                <i className="bi bi-chevron-left" aria-hidden="true"></i>
              </button>
              <button type="button" className="guest-carousel-control guest-carousel-control-next" onClick={() => changeSlide(1)} aria-label="Next slide">
                <i className="bi bi-chevron-right" aria-hidden="true"></i>
              </button>
              <div className="guest-carousel-indicators">
                {slides.map((slide, index) => (
                  <button
                    key={slide.key}
                    type="button"
                    className={index === shownSlide ? "is-active" : ""}
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Show ${slide.title}`}
                    aria-current={index === shownSlide ? "true" : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>
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
            {!onlineReservationsOpen ? "Online reservations are paused for a while." : "Online booking is not available yet."}{" "}
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
          {contactLinks.length > 0 && <div className="guest-steps-contact">{renderContactLinks("guest-template-secondary")}</div>}
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

      {/* The open tournaments take as much room as there are of them: one is a
          wide ticket with its poster, two share the row, three fill it. */}
      <section className="guest-tournaments" id="tournaments" aria-labelledby="guest-tournaments-title">
        <div className="guest-section-head">
          <p className="guest-template-eyebrow">Tournaments &amp; events</p>
          <h2 id="guest-tournaments-title">What&apos;s on at Break &amp; Chill</h2>
          {homeTournaments.length > 0 && (
            <p className="guest-section-lead">Register online for an open tournament, then watch this page for schedule changes.</p>
          )}
        </div>

        {homeTournaments.length > 0 ? (
          <div className={`guest-tournament-list is-count-${homeTournaments.length}`}>
            {homeTournaments.map((event) => {
              const tile = getDateTile(event.date);
              const type = wasRescheduled(event) ? "rescheduled" : "open";
              const cover = getEventCover(event);
              const poster = homeTournaments.length === 1 && cover?.type === "image" ? cover : null;

              return (
                <article key={event.id} className={`guest-tournament-card is-${type} ${poster ? "has-poster" : ""}`}>
                  <div className="guest-ticket-stub" aria-hidden="true">
                    <span>{tile.month}</span>
                    <strong>{tile.day}</strong>
                  </div>

                  <div className="guest-ticket-body">
                    <span className={`guest-tournament-badge is-${type}`}>{type === "rescheduled" ? "Rescheduled" : "Open for registration"}</span>
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
                        <span>{formatEventWhen(event.date, event.time)}</span>
                      </div>
                    )}
                    {type === "rescheduled" && event.rescheduleReason && (
                      <p className="guest-tournament-reason">Reason: {event.rescheduleReason}</p>
                    )}

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
                  </div>

                  {poster && <img className="guest-ticket-poster" src={eventMediaUrl(poster)} alt={`${event.name} poster`} />}
                </article>
              );
            })}
          </div>
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

        <div className="guest-tournaments-actions">
          {homeTournaments.length > 0 && (
            <button type="button" className="guest-template-primary" onClick={() => onOpenTournamentForm()}>
              Register for Tournament
              <i className="bi bi-arrow-right"></i>
            </button>
          )}
          <button type="button" className="guest-template-secondary" onClick={onOpenTournaments}>
            {openTournaments.length > HOME_TOURNAMENT_LIMIT ? `See all ${openTournaments.length} tournaments` : "Open the tournaments page"}
            <i className="bi bi-arrow-right"></i>
          </button>
        </div>
      </section>

      {/* One line with the hours until the address or contacts are set; then
          the details beside big buttons to find and reach the hall. */}
      {hasBusinessInfo(business) ? (
        <section className="guest-visit" id="visit" aria-labelledby="guest-visit-title">
          <div className="guest-section-head">
            <p className="guest-template-eyebrow">Visit us</p>
            <h2 id="guest-visit-title">Come rack up at the hall.</h2>
          </div>
          <div className="guest-visit-card">
            <dl className="guest-visit-details">
              {business.address && (
                <div>
                  <dt>
                    <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
                    Address
                  </dt>
                  <dd>{business.address}</dd>
                </div>
              )}
              <div>
                <dt>
                  <i className="bi bi-clock-fill" aria-hidden="true"></i>
                  Open
                </dt>
                <dd>{formatOpeningHours(hours)}</dd>
              </div>
              {business.phone && (
                <div>
                  <dt>
                    <i className="bi bi-telephone-fill" aria-hidden="true"></i>
                    Contact
                  </dt>
                  <dd>{business.phone}</dd>
                </div>
              )}
            </dl>
            {contactLinks.length > 0 && <div className="guest-visit-actions">{renderContactLinks("guest-template-secondary")}</div>}
          </div>
        </section>
      ) : (
        <section className="guest-visit is-slim" id="visit" aria-label="Visit us">
          <p className="guest-visit-line">
            <i className="bi bi-clock-fill" aria-hidden="true"></i>
            <strong>Visit us</strong>
            <span>Open {formatOpeningHours(hours)}</span>
          </p>
        </section>
      )}

      <footer className="guest-template-footer">
        <span className="guest-footer-mark">
          Break &amp; Chill <small>Billiard Hall</small>
        </span>
        {footer.tagline && (
          <span className={`guest-footer-tagline ${contentReady ? "" : "is-loading"}`}>{footer.tagline}</span>
        )}
        <span className="guest-footer-end">
          <span className="guest-footer-hours">Open {formatOpeningHours(hours)}</span>
          {facebook && (
            <a className="guest-footer-social" href={business.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label={facebook.label}>
              <i className={`bi ${facebook.icon}`} aria-hidden="true"></i>
            </a>
          )}
        </span>
      </footer>
    </main>
  );
}
