import { formatRegisteredAt } from "./tournamentRegistrations";

// The notices the website sends the staff when a guest books a table online.
export const ONLINE_RESERVATION_NOTICE = "online-reservation";

// Where each booking stands now, shown beside its notice in the staff bells.
const BOOKING_STATES = {
  pending: { label: "Check payment", tone: "action" },
  approved: { label: "Approved", tone: "done" },
  reserved: { label: "Approved", tone: "done" },
  arrived: { label: "Arrived", tone: "done" },
  seated: { label: "Seated", tone: "done" },
  completed: { label: "Completed", tone: "done" },
  rejected: { label: "Rejected", tone: "closed" },
  cancelled: { label: "Cancelled", tone: "closed" },
  expired: { label: "Expired", tone: "closed" },
};

/** The current state of the booking a reservation notice is about, or null. */
export const getBookingState = (notice, reservations = []) => {
  const booking = reservations.find((entry) => String(entry.id) === String(notice.data?.reservationId));
  return booking ? BOOKING_STATES[booking.status] || null : null;
};

// When a notice came in: the server's time, or the time at the start of a local notice's id.
export const noticeTime = (notice) => {
  if (notice.createdAt) return formatRegisteredAt(notice.createdAt);
  const stamp = Number(String(notice.id).split("-")[0]);
  return stamp ? formatRegisteredAt(new Date(stamp).toISOString()) : "";
};
