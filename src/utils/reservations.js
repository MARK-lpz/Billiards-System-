export const initialReservations = [];
export const RESERVATION_OPEN_TIME = "10:00";
export const RESERVATION_CUTOFF_TIME = "22:00";
export const DEFAULT_RESERVATION_DURATION_MINUTES = 60;
export const RESERVATION_SLOT_MINUTES = 30;

const ACTIVE_STATUSES = new Set(["pending", "approved", "reserved", "arrived", "seated"]);

export const UNRESERVABLE_TABLE_STATUSES = new Set(["maintenance"]);

export const isTableUnderMaintenance = (table) => UNRESERVABLE_TABLE_STATUSES.has(table?.status);

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

// A table booked for a tournament is held for the WHOLE day, not just from the
// start time, so nobody else can take it earlier in the day and overrun.
const getTournamentReservationConflict = ({ table, events = [], candidate }) =>
  events.find((event) => {
    if (!event || !["upcoming", "active"].includes(String(event.status || "").toLowerCase())) return false;
    if (!candidate?.date || String(event.date || "") !== String(candidate.date)) return false;

    return (event.tables || []).some((assignedTable) =>
      Number(assignedTable) === Number(table?.id) ||
      String(assignedTable).trim().toLowerCase() === String(table?.name || "").trim().toLowerCase()
    );
  });

export const getTableReservationAvailability = ({ table, reservations = [], events = [], candidate, excludeId = null }) => {
  if (isTableUnderMaintenance(table)) {
    return {
      available: false,
      reason: `${table?.name || "This table"} is under maintenance after a reported issue and cannot be reserved yet.`,
      type: "maintenance",
    };
  }

  // Checked before the date/time guard: the hold depends on the date alone.
  const tournament = getTournamentReservationConflict({ table, events, candidate });
  if (tournament) {
    return {
      available: false,
      reason: `${table?.name || "This table"} is held all day for ${tournament.name || "a tournament"}.`,
      type: "tournament",
    };
  }

  const candidateRange = getCandidateRange(candidate);
  if (!candidateRange) return { available: true, reason: "" };

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

const toMinutesOfDay = (time) => {
  const [hours, minutes] = String(time).split(":").map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const toTimeValue = (minutesOfDay) => {
  const hours = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/**
 * Every start time one table can still take on a date, so the guest picks from
 * what is actually free instead of typing a time and being turned away.
 * The table must be chosen first: a slot is only free for a specific table.
 */
export const getAvailableTimeSlots = ({
  table,
  reservations = [],
  events = [],
  date,
  excludeId = null,
  now = new Date(),
}) => {
  if (!table || !date) return [];

  const slots = [];
  const closingMinutes = toMinutesOfDay(RESERVATION_CUTOFF_TIME);

  // The last offered slot has to finish by closing, so nothing is sold that runs
  // past the hour the hall shuts.
  for (
    let minutes = toMinutesOfDay(RESERVATION_OPEN_TIME);
    minutes + DEFAULT_RESERVATION_DURATION_MINUTES <= closingMinutes;
    minutes += RESERVATION_SLOT_MINUTES
  ) {
    const time = toTimeValue(minutes);

    // Skips slots already gone today and anything past the closing cutoff.
    if (getReservationValidationMessage(date, time, now)) continue;

    const availability = getTableReservationAvailability({
      table,
      reservations,
      events,
      candidate: { tableId: table.id, date, time },
      excludeId,
    });
    if (!availability.available) continue;

    const start = toDateTime(date, time);
    const end = new Date(start.getTime() + DEFAULT_RESERVATION_DURATION_MINUTES * 60 * 1000);
    slots.push({ value: time, label: `${formatTime(start)} - ${formatTime(end)}` });
  }

  return slots;
};

/**
 * Booked slots for one date, so guests can see when a table frees up.
 * Deliberately carries no customer details: table and time only.
 */
export const getBookedSlotsForDate = ({ tables = [], reservations = [], events = [], date }) => {
  if (!date) return [];

  const findTable = (value) =>
    tables.find(
      (table) =>
        Number(table?.id) === Number(value) ||
        String(table?.name || "").trim().toLowerCase() === String(value).trim().toLowerCase()
    );

  const slots = [];

  events.forEach((event) => {
    if (!["upcoming", "active"].includes(String(event?.status || "").toLowerCase())) return;
    if (String(event?.date || "") !== String(date)) return;

    (event.tables || []).forEach((assigned) => {
      const table = findTable(assigned);
      if (!table) return;

      slots.push({
        key: `tournament-${event.id}-${table.id}`,
        tableId: table.id,
        tableName: table.name || `Table ${table.id}`,
        type: "tournament",
        title: event.name || "Tournament",
        allDay: true,
        start: "",
        end: "",
        startAt: 0,
      });
    });
  });

  reservations.forEach((reservation) => {
    if (!reservation || !ACTIVE_STATUSES.has(reservation.status)) return;
    if (String(reservation.date || "") !== String(date)) return;

    const range = getCandidateRange(reservation);
    if (!range) return;

    const tableId = reservation.tableId ?? reservation.table;
    const table = findTable(tableId);

    slots.push({
      key: `reservation-${reservation.id}`,
      tableId,
      tableName: reservation.tableName || table?.name || `Table ${tableId}`,
      type: "reservation",
      title: "Reserved",
      allDay: false,
      start: formatTime(range.start),
      end: formatTime(range.end),
      startAt: range.start.getTime(),
    });
  });

  return slots.sort((first, second) => {
    if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
    if (first.startAt !== second.startAt) return first.startAt - second.startAt;
    return String(first.tableName).localeCompare(String(second.tableName));
  });
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
