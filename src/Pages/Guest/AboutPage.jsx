import "../../styles/Guest/GuestLanding.css";
import "../../styles/Guest/GuestPages.css";
import GuestHeader from "../../Elements/Guest/GuestHeader";
import GuestFooter from "../../Elements/Guest/GuestFooter";
import ContactLinks from "../../Elements/Guest/ContactLinks";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import { useReservationState } from "../../Elements/Guest/useReservationState";
import { useAnnouncements } from "../../Elements/Guest/useAnnouncements";
import { aboutParagraphs } from "../../utils/siteSettings";
import { formatOpeningHours } from "../../utils/reservations";

/**
 * About us (Admin > Website > About us): the hall's own words, beside where it
 * is, when it is open and how to reach it (only what is set; the hours
 * always), with big buttons to find and reach it.
 */
export default function AboutPage({
  events = [],
  onNavigate,
  onOpenReservation,
  onlineReservationsOpen = true,
  onlineReservationsStatus = {},
}) {
  const { settings, loaded, failed } = useSiteSettings();
  const { about, business, hours } = settings;
  const reservation = useReservationState(onlineReservationsOpen, onlineReservationsStatus);
  const news = useAnnouncements(events, reservation);

  return (
    <main className="guest-template guest-page">
      <GuestHeader
        page="about"
        onNavigate={onNavigate}
        onOpenReservation={onOpenReservation}
        reservation={reservation}
        newsCount={news.unseen}
      />

      {/* The words' places are kept blank until the server answers, so the
          defaults never flash first. */}
      <section className={`guest-about ${loaded || failed ? "" : "is-loading"}`} aria-labelledby="guest-about-title">
        <div className="guest-about-story">
          <p className="guest-template-eyebrow">About us</p>
          <h1 id="guest-about-title">{about.heading}</h1>
          {aboutParagraphs(about.text).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
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
          <ContactLinks business={business} className="guest-visit-actions" />
        </div>
      </section>

      <GuestFooter />
    </main>
  );
}
