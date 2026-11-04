import { useState } from "react";
import { useSiteSettings } from "../Global/useSiteSettings";
import { dayInManila, isAnnouncementShowing } from "../../utils/siteSettings";
import { formatEventWhen, getEventNotices } from "../../utils/eventUpdates";

// The announcements this browser has seen on the Announcements page (their keys).
const SEEN_KEY = "seenAnnouncements";

const readSeen = () => {
  try {
    const keys = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return new Set(Array.isArray(keys) ? keys : []);
  } catch {
    return new Set();
  }
};

/** Called by the Announcements page: what it shows now counts as seen. */
export const rememberAnnouncementsSeen = (keys) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
  } catch {
    // Without storage the menu just keeps counting them.
  }
};

/**
 * What the Announcements page lists (the home page the first few), most
 * pressing first: online bookings paused with the switch, the admin's
 * announcement (Admin > Website) while it is on and inside its dates, then the
 * tournaments that were moved or cancelled. Each is { key, kind, icon, title,
 * text, reason?, event?, announcement? }; a key changes when its words or
 * date do (a pause, with each closing), so a changed one counts as new again.
 * `unseen` is how many this browser has not seen on that page yet (read when
 * the page opens). `reservation` is the page's useReservationState(), whose
 * clock this follows. Closing every night is not news: the Reserve buttons
 * say it.
 */
export function useAnnouncements(events, reservation) {
  const { now, paused } = reservation;
  const { announcement } = useSiteSettings().settings;
  const [seen] = useState(readSeen);

  const items = [];
  if (paused) {
    items.push({
      key: `paused:${paused.id}`,
      kind: "paused",
      icon: "bi-calendar-x",
      title: "Reservations paused",
      text: paused.message,
    });
  }
  if (isAnnouncementShowing(announcement, dayInManila(now))) {
    items.push({
      key: `hall:${announcement.startDate}:${announcement.message}`,
      kind: "announcement",
      icon: "bi-megaphone-fill",
      title: "Announcement",
      text: announcement.message,
      announcement,
    });
  }
  getEventNotices(events, now).forEach(({ event, type }) => {
    const when = formatEventWhen(event.date, event.time);
    items.push(
      type === "cancelled"
        ? {
            key: `cancelled:${event.id}`,
            kind: "cancelled",
            icon: "bi-x-octagon-fill",
            title: "Cancelled",
            text: `${event.name} on ${when} is cancelled.`,
            reason: event.cancelReason,
            event,
          }
        : {
            key: `moved:${event.id}:${event.date} ${event.time}`,
            kind: "rescheduled",
            icon: "bi-calendar2-week-fill",
            title: "Moved",
            text: `${event.name} is moved to ${when}.`,
            event,
          }
    );
  });

  return { items, unseen: items.filter((item) => !seen.has(item.key)).length };
}
