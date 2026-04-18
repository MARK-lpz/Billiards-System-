export const initialReservations = [];

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
