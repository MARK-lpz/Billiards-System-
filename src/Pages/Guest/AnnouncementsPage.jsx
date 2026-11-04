import { useEffect } from "react";
import "../../styles/Guest/GuestLanding.css";
import "../../styles/Guest/GuestPages.css";
import GuestHeader from "../../Elements/Guest/GuestHeader";
import GuestFooter from "../../Elements/Guest/GuestFooter";
import AnnouncementList from "../../Elements/Guest/AnnouncementList";
import { useReservationState } from "../../Elements/Guest/useReservationState";
import { rememberAnnouncementsSeen, useAnnouncements } from "../../Elements/Guest/useAnnouncements";

/**
 * The hall's news (see useAnnouncements): online bookings paused with the
 * switch, the admin's announcement, and the tournaments that were moved or
 * cancelled. What it shows counts as seen, so the menu stops counting it.
 */
export default function AnnouncementsPage({
  events = [],
  onNavigate,
  onOpenReservation,
  onlineReservationsOpen = true,
  onlineReservationsStatus = {},
}) {
  const reservation = useReservationState(onlineReservationsOpen, onlineReservationsStatus);
  const news = useAnnouncements(events, reservation);
  const shownKeys = JSON.stringify(news.items.map((item) => item.key));

  useEffect(() => {
    rememberAnnouncementsSeen(JSON.parse(shownKeys));
  }, [shownKeys]);

  return (
    <main className="guest-template guest-page">
      <GuestHeader page="announcements" onNavigate={onNavigate} onOpenReservation={onOpenReservation} reservation={reservation} />

      <section className="guest-page-hero">
        <p className="guest-template-eyebrow">Announcements</p>
        <h1>News from the hall</h1>
        <p>Closures, tournament schedule changes and other news from Break &amp; Chill.</p>
      </section>

      <section className="guest-news" aria-label="Announcements">
        {news.items.length === 0 ? (
          <div className="guest-page-empty">
            <i className="bi bi-megaphone" aria-hidden="true"></i>
            <h2>No announcements right now</h2>
            <p>Closures and tournament schedule changes show up here. Please check back soon.</p>
          </div>
        ) : (
          <AnnouncementList items={news.items} onOpenTournaments={() => onNavigate("tournaments")} level={2} />
        )}
      </section>

      <GuestFooter />
    </main>
  );
}
