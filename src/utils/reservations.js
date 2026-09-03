export const initialReservations = [];
export const RESERVATION_CUTOFF_TIME = "22:00";
export const DEFAULT_RESERVATION_DURATION_MINUTES = 60;

const ACTIVE_STATUSES = new Set(["pending", "approved", "reserved", "arrived", "seated"]);

const toDateTime = (date, time) => new Date(`${date}T${time}:00`);

const getDurationMinutes = (record) => {
  const duration = Number(record?.durationMinutes);
  return Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_RESERVATION_DURATION_MINUTES;
};

const rangesOverlap = (firstStart, firstEnd, secondStart, secondEnd) =>
  firstStart < secondEnd && secondStart < firstEnd;

const formatTime = (date) =>
  date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const getCandidateRange = (candidate) => {
  const start = toDateTime(candidate.date, candidate.time);
  if (Number.isNaN(start.getTime())) return null;

  return {
    start,
    end: new Date(start.getTime() + getDurationMinutes(candidate) * 60 * 1000),
  };
};

const getOccupiedTableRange = (table) => {
  if (table?.status !== "occupied" || !table.startTime) return null;

  const start = new Date(Number(table.startTime));
  if (Number.isNaN(start.getTime())) return null;

  return {
    start,
    end: new Date(start.getTime() + getDurationMinutes(table) * 60 * 1000),
  };
};

const getTournamentReservationConflict = ({ table, events = [], candidate }) =>
  events.find((event) => {
    if (!event || !["upcoming", "active"].includes(String(event.status || "").toLowerCase())) return false;
    if (String(event.date || "") !== String(candidate.date || "")) return false;

    const candidateRange = getCandidateRange(candidate);
    const tournamentStart = toDateTime(candidate.date, event.time);
    if (!candidateRange || Number.isNaN(tournamentStart.getTime()) || candidateRange.end <= tournamentStart) return false;

    return (event.tables || []).some((assignedTable) =>
      Number(assignedTable) === Number(table.id) ||
      String(assignedTable).trim().toLowerCase() === String(table.name || "").trim().toLowerCase()
    );
  });

export const getTableReservationAvailability = ({ table, reservations = [], events = [], candidate, excludeId = null }) => {
  const candidateRange = getCandidateRange(candidate);
  if (!candidateRange) return { available: true, reason: "" };

  const tournament = getTournamentReservationConflict({ table, events, candidate });
  if (tournament) {
    const tournamentStart = toDateTime(candidate.date, tournament.time);
    return {
      available: false,
      reason: `${table.name || "This table"} is reserved from ${formatTime(tournamentStart)} for ${tournament.name || "a tournament"}.`,
      type: "tournament",
    };
  }

  const occupiedRange = getOccupiedTableRange(table);
  if (occupiedRange && rangesOverlap(candidateRange.start, candidateRange.end, occupiedRange.start, occupiedRange.end)) {
    return {
      available: false,
      reason: `${table.name || "This table"} is occupied until ${formatTime(occupiedRange.end)}.`,
      type: "occupied",
    };
  }

  const conflict = reservations.find((reservation) => {
    if (!reservation || reservation.id === excludeId || !ACTIVE_STATUSES.has(reservation.status)) return false;
    if (Number(reservation.tableId ?? reservation.table) !== Number(candidate.tableId ?? candidate.table)) return false;

    const reservationRange = getCandidateRange(reservation);
    return reservationRange && rangesOverlap(candidateRange.start, candidateRange.end, reservationRange.start, reservationRange.end);
  });

  if (conflict) {
    const conflictRange = getCandidateRange(conflict);
    return {
      available: false,
      reason: `${table.name || "This table"} is already reserved from ${formatTime(conflictRange.start)} to ${formatTime(conflictRange.end)}.`,
      type: "reserved",
    };
  }

  return { available: true, reason: "" };
};

export const hasReservationConflict = (reservations, candidate, excludeId = null) => {
  const candidateRange = getCandidateRange(candidate);
  if (!candidateRange) return false;

  return reservations.some((reservation) => {
    if (!reservation || reservation.id === excludeId || !ACTIVE_STATUSES.has(reservation.status)) return false;
    if (Number(reservation.tableId ?? reservation.table) !== Number(candidate.tableId ?? candidate.table)) return false;

    const reservationRange = getCandidateRange(reservation);
    return reservationRange && rangesOverlap(candidateRange.start, candidateRange.end, reservationRange.start, reservationRange.end);
  });
};

export const getAvailableReservationTables = ({
  tables = [],
  reservations = [],
  events = [],
  date = "",
  time = "",
  excludeId = null,
}) => {
  if (!date || !time) return tables;

  return tables.filter((table) =>
    getTableReservationAvailability({
      table,
      reservations,
      events,
      candidate: { tableId: table.id, date, time },
      excludeId,
    }).available
  );
};

export const getReservationValidationMessage = (date, time, now = new Date()) => {
  if (!date || !time) return "Please select both a reservation date and time.";

  const selectedDateTime = toDateTime(date, time);
  if (Number.isNaN(selectedDateTime.getTime())) return "Please select a valid reservation date and time.";
  if (selectedDateTime <= now) return "Past dates and times can no longer be reserved.";
  if (time >= RESERVATION_CUTOFF_TIME) {
    return `Reservations are accepted only before ${RESERVATION_CUTOFF_TIME}.`;
  }

  return "";
};
