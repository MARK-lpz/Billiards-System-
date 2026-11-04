import "../../styles/Guest/GuestPages.css";
import { formatReservationDate } from "../../utils/reservations";

// "Oct 30, 2026 - Nov 1, 2026" or "Until Nov 1, 2026": the dates the admin set
// for the announcement (Admin > Website). One that only has a start is on already.
const describeDates = ({ startDate, endDate }) => {
  if (!endDate) return "";
  if (!startDate || startDate === endDate) return `Until ${formatReservationDate(endDate)}`;
  return `${formatReservationDate(startDate)} - ${formatReservationDate(endDate)}`;
};

/**
 * The hall's news as cards (useAnnouncements' items), on the Announcements page
 * and the home page: the admin's announcement with its dates, and a moved or
 * cancelled tournament with its reason and, given `onOpenTournaments`, the way
 * to the Tournaments page. `level` is its titles' heading level under the page's;
 * `compact` makes each a short row (the home page, beside a picture).
 */
export default function AnnouncementList({ items, onOpenTournaments, level = 3, compact = false }) {
  const Title = `h${level}`;
  return (
    <ul className={`guest-news-list${compact ? " is-compact" : ""}`}>
      {items.map((item) => {
        const dates = item.announcement ? describeDates(item.announcement) : "";
        return (
          <li key={item.key} className={`guest-news-item is-${item.kind}`}>
            <i className={`bi ${item.icon}`} aria-hidden="true"></i>
            <div className="guest-news-copy">
              <Title>{item.title}</Title>
              <p>{item.text}</p>
              {item.reason && <p className="guest-news-note">Reason: {item.reason}</p>}
              {dates && <p className="guest-news-note">{dates}</p>}
            </div>
            {item.event && onOpenTournaments && (
              <button type="button" className="guest-template-secondary" onClick={onOpenTournaments}>
                Tournaments
                <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
