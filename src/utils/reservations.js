export const initialReservations = [];
export const RESERVATION_CUTOFF_TIME = "22:00";

const ACTIVE_STATUSES = new Set(["pending", "approved", "reserved", "arrived", "seated"]);

export const hasReservationConflict = (reservations, candidate, excludeId = null) =>
  reservations.some((reservation) => {
    if (!reservation || reservation.id === excludeId) return false;
    if (!ACTIVE_STATUSES.has(reservation.status)) return false;

    return (
      Number(reservation.tableId ?? reservation.table) === Number(candidate.tableId ?? candidate.table) &&
      reservation.date === candidate.date &&
      reservation.time === candidate.time
    );
  });

export const getAvailableReservationTables = ({
  tables = [],
  reservations = [],
  date = "",
  time = "",
  excludeId = null,
}) => {
  // Reservation availability is per time slot. A table occupied right now can
  // still be reserved for another date/time when no reservation conflicts.
  if (!date || !time) return tables;

  return tables.filter(
    (table) =>
      !hasReservationConflict(
        reservations,
        { tableId: table.id, date, time },
        excludeId
      )
  );
};

export const getReservationValidationMessage = (date, time, now = new Date()) => {
  if (!date || !time) return "Please select both a reservation date and time.";

  const selectedDateTime = new Date(`${date}T${time}:00`);
  if (Number.isNaN(selectedDateTime.getTime())) return "Please select a valid reservation date and time.";
  if (selectedDateTime <= now) return "Past dates and times can no longer be reserved.";
  if (time >= RESERVATION_CUTOFF_TIME) {
    return `Reservations are accepted only before ${RESERVATION_CUTOFF_TIME}.`;
  }

  return "";
};
