export const initialReservations = [];
export const RESERVATION_OPEN_TIME = "10:00";
export const RESERVATION_CUTOFF_TIME = "22:00";
export const DEFAULT_RESERVATION_DURATION_MINUTES = 60;
export const RESERVATION_SLOT_MINUTES = 30;
// Guests book whole hours, at least this many, starting at any time they choose.
export const MIN_RESERVATION_HOURS = 1;
// A guest not checked in this long after their reserved time is a no-show: the
// server expires the booking and the table is freed. Matches reservations.php.
export const RESERVATION_GRACE_MINUTES = 30;

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

const formatClock = (time) => formatTime(toDateTime("2000-01-01", time));

/** "11:53 AM", from a booking's "11:53". Anything unreadable is shown as given. */
export const formatReservationTime = (time) =>
  Number.isNaN(toDateTime("2000-01-01", time).getTime()) ? time : formatClock(time);

/** "Oct 7, 2026", from a booking's "2026-10-07". Anything unreadable is shown as given. */
export const formatReservationDate = (date) => {
  const day = toDateTime(date, "00:00");
  return Number.isNaN(day.getTime())
    ? date
    : day.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

export const RESERVATION_CLOSED_HOURS_MESSAGE = `Break & Chill closes at ${formatClock(RESERVATION_CUTOFF_TIME)}. Online reservations open again at ${formatClock(RESERVATION_OPEN_TIME)}.`;

/**
 * True from closing until opening, Manila time. Checking only "10 PM or later"
 * let reservations reopen at midnight, while the hall was still closed.
 */
export const isOutsideReservationHours = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  const minutes = read("hour") * 60 + read("minute");

  return minutes >= toMinutesOfDay(RESERVATION_CUTOFF_TIME) || minutes < toMinutesOfDay(RESERVATION_OPEN_TIME);
};

/** "2 hours", "1 hour 30 min": a booking length in words. */
export const formatHoursLabel = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const hourText = hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "";
  const minuteText = rest ? `${rest} min` : "";
  return [hourText, minuteText].filter(Boolean).join(" ") || "0 min";
};

/** "1:00 PM - 3:00 PM (2 hours)", from a reservation's start time and length. */
export const describeReservationTime = (reservation) => {
  const range = reservation ? getCandidateRange(reservation) : null;
  if (!range) return reservation?.time || "";

  return `${formatTime(range.start)} - ${formatTime(range.end)} (${formatHoursLabel(getDurationMinutes(reservation))})`;
};

/** The booking a reserved table is held for, so checking in uses its hours. */
export const findTableReservation = (table, reservations = []) => {
  if (!table) return null;

  const byId =
    table.reservationId != null
      ? reservations.find((reservation) => String(reservation?.id) === String(table.reservationId))
      : null;
  if (byId) return byId;

  return (
    reservations.find(
      (reservation) =>
        ["approved", "reserved", "arrived"].includes(reservation?.status) &&
        Number(reservation.tableId ?? reservation.table) === Number(table.id) &&
        (!table.reservationDate || reservation.date === table.reservationDate) &&
        (!table.reservationTime || reservation.time === table.reservationTime)
    ) || null
  );
};

// How long a walk-in can choose to stay, in minutes. Staff add time later if
// the customer stays longer.
export const WALK_IN_DURATIONS = [30, 60, 120];
const LONGEST_WALK_IN = Math.max(...WALK_IN_DURATIONS);

/**
 * How many minutes a walk-in can stay on a table from now, up to the longest
 * choice. It stops before the table's next booking, so a walk-in never runs
 * into a reserved guest.
 */
export const getWalkInLimit = ({ table, reservations = [], now = new Date() }) => {
  const next = reservations
    .filter(
      (reservation) =>
        reservation &&
        ACTIVE_STATUSES.has(reservation.status) &&
        reservation.status !== "seated" &&
        Number(reservation.tableId ?? reservation.table) === Number(table?.id)
    )
    .map((reservation) => ({ reservation, range: getCandidateRange(reservation) }))
    .filter((entry) => entry.range && entry.range.end > now)
    .sort((first, second) => first.range.start - second.range.start)[0];

  if (!next) return { maxMinutes: LONGEST_WALK_IN, nextBooking: null };

  const startsIn = Math.floor((next.range.start.getTime() - now.getTime()) / 60000);
  const sameDay = next.range.start.toDateString() === now.toDateString();

  return {
    maxMinutes: Math.max(0, Math.min(LONGEST_WALK_IN, startsIn)),
    nextBooking: {
      startsIn,
      label: sameDay ? formatTime(next.range.start) : `${formatTime(next.range.start)} on ${next.reservation.date}`,
    },
  };
};

/** True once a booking's last minute is over, so it can no longer be approved. */
export const hasReservationEnded = (reservation, now = new Date()) => {
  const range = reservation ? getCandidateRange(reservation) : null;
  return Boolean(range) && range.end <= now;
};

/** The clock time a booking ends, e.g. ("13:00", 120) gives "15:00". */
export const addMinutesToTime = (time, minutes) => toTimeValue(toMinutesOfDay(time) + Number(minutes || 0));

// The earliest minute of the day a booking can start: opening time, or for today
// the next half hour from now, so nothing is sold that has already begun.
// Null when the date is already over.
const getEarliestStartMinutes = (date, now) => {
  const today = now.toLocaleDateString("en-CA");
  if (date < today) return null;

  const opening = toMinutesOfDay(RESERVATION_OPEN_TIME);
  if (date > today) return opening;

  const nextMinute = now.getHours() * 60 + now.getMinutes() + 1;
  return Math.max(opening, Math.ceil(nextMinute / RESERVATION_SLOT_MINUTES) * RESERVATION_SLOT_MINUTES);
};

/**
 * The stretches of a date one table is still free, from opening (or now, for
 * today) to closing, so a guest can see how long they could stay before typing a
 * start time and choosing how many hours. Gaps shorter than the minimum booking
 * are left out, since nobody could reserve them.
 */
export const getOpenTimeWindows = ({
  table,
  reservations = [],
  events = [],
  date,
  excludeId = null,
  now = new Date(),
}) => {
  if (!table || !date) return [];

  // Maintenance and all-day tournament holds close the whole date.
  const dayAvailability = getTableReservationAvailability({
    table,
    reservations,
    events,
    candidate: { tableId: table.id, date, time: "" },
  });
  if (!dayAvailability.available) return [];

  const earliest = getEarliestStartMinutes(date, now);
  if (earliest === null) return [];

  const closing = toMinutesOfDay(RESERVATION_CUTOFF_TIME);
  const dayStart = toDateTime(date, "00:00").getTime();
  const toDayMinutes = (moment) => Math.round((moment.getTime() - dayStart) / 60000);

  const busyRanges = reservations
    .filter(
      (reservation) =>
        reservation &&
        reservation.id !== excludeId &&
        ACTIVE_STATUSES.has(reservation.status) &&
        Number(reservation.tableId ?? reservation.table) === Number(table.id)
    )
    .map(getCandidateRange)
    .filter(Boolean);

  const occupiedRange = getOccupiedTableRange(table);
  if (occupiedRange) busyRanges.push(occupiedRange);

  const taken = busyRanges
    .map((range) => ({ start: toDayMinutes(range.start), end: toDayMinutes(range.end) }))
    .filter((range) => range.end > earliest && range.start < closing)
    .sort((first, second) => first.start - second.start);

  const windows = [];
  const addWindow = (start, end) => {
    if (end - start < MIN_RESERVATION_HOURS * 60) return;

    windows.push({
      start: toTimeValue(start),
      end: toTimeValue(end),
      startMinutes: start,
      endMinutes: end,
      label: `${formatClock(toTimeValue(start))} - ${formatClock(toTimeValue(end))}`,
      maxHours: Math.floor((end - start) / 60),
    });
  };

  let cursor = earliest;
  taken.forEach((range) => {
    if (range.start > cursor) addWindow(cursor, Math.min(range.start, closing));
    cursor = Math.max(cursor, range.end);
  });
  if (cursor < closing) addWindow(cursor, closing);

  return windows;
};

/**
 * How many whole hours one table can be booked from the start time a guest
 * typed, judged against its open windows. `reason` says why a start cannot be
 * booked, in words the guest can act on.
 */
export const checkReservationStart = ({ windows = [], date, time, now = new Date() }) => {
  if (!date || !time) return { maxHours: 0, reason: "" };

  const start = toMinutesOfDay(time);
  const opening = toMinutesOfDay(RESERVATION_OPEN_TIME);
  const closing = toMinutesOfDay(RESERVATION_CUTOFF_TIME);
  const closingText = `Break & Chill closes at ${formatClock(RESERVATION_CUTOFF_TIME)}`;
  const lastStart = formatClock(toTimeValue(closing - MIN_RESERVATION_HOURS * 60));
  if (start >= closing) {
    return { maxHours: 0, reason: `${closingText}. Please select a reservation time before closing.` };
  }
  if (start < opening) {
    return {
      maxHours: 0,
      reason: `Reservations start at ${formatClock(RESERVATION_OPEN_TIME)}. Please choose a later time.`,
    };
  }

  const earliest = getEarliestStartMinutes(date, now);
  if (earliest === null) {
    return { maxHours: 0, reason: "That date has already passed. Please choose another date." };
  }
  if (earliest + MIN_RESERVATION_HOURS * 60 > closing) {
    return {
      maxHours: 0,
      reason: `${closingText}, so no more reservations can be made for today. Please choose another date.`,
    };
  }
  if (start < earliest) {
    const earliestText = `The earliest start time left today is ${formatClock(toTimeValue(earliest))}.`;
    return {
      maxHours: 0,
      reason: toDateTime(date, time) <= now ? `That time has already passed. ${earliestText}` : earliestText,
    };
  }

  const window = windows.find((entry) => start >= entry.startMinutes && start < entry.endMinutes);
  if (!window) {
    return {
      maxHours: 0,
      reason: `This table is not open for a booking at ${formatClock(time)}. Please start inside one of the open times shown.`,
    };
  }

  const freeMinutes = window.endMinutes - start;
  const maxHours = Math.floor(freeMinutes / 60);
  if (maxHours < MIN_RESERVATION_HOURS) {
    return {
      maxHours: 0,
      // Running into closing gets its own wording, so the 10 PM limit is named.
      reason:
        window.endMinutes === closing
          ? `${closingText}, so only ${freeMinutes} minutes are left from ${formatClock(time)}. A booking needs at least 1 hour, so please start by ${lastStart}.`
          : `Only ${freeMinutes} minutes are free from ${formatClock(time)} to ${formatClock(window.end)}. A booking needs at least 1 hour, so please start a little earlier.`,
    };
  }

  return { maxHours, reason: "", window };
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

/** Today as "2026-10-07", the value a date input uses. */
export const getTodayDate = (now = new Date()) => now.toLocaleDateString("en-CA");

/**
 * Why staff cannot book this date and time, or "" when they can or have not
 * filled both in yet. A past date is caught as soon as it is picked, before
 * any time is chosen.
 */
export const getReservationScheduleError = (date, time, now = new Date()) => {
  if (!date) return "";
  if (date < getTodayDate(now)) return "This date has already passed. Please choose today or a later date.";
  if (!time) return "";
  return getReservationValidationMessage(date, time, now);
};
