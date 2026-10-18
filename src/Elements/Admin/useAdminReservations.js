import { useEffect, useState } from "react";
import { appendAuditLog } from "../../utils/audit";
import { isValidSmsNumber } from "../../utils/phone";
import { useNotifications } from "../Global/useNotifications";
import { useSiteSettings } from "../Global/useSiteSettings";
import { createRemoteReservation, updateRemoteReservation } from "../../utils/reservationApi";
import { RESERVATIONS_PAGE_SIZE as PAGE_SIZE, matchesSearch } from "../../utils/reservationList";
import { paginate } from "../../utils/pagination";
import {
  getAvailableReservationTables,
  getChosenTableError,
  getReservationScheduleError,
  hasReservationConflict,
} from "../../utils/reservations";
import { ENDED_SESSION_FIELDS, createTableCharge, endedChargeToast } from "../../utils/tableCharges";

// Read only from handlers, never while rendering.
const getCurrentTimestamp = () => Date.now();

const emptyReservationForm = {
  customerName: "",
  phone: "",
  date: "",
  time: "",
  tableId: "",
  partySize: 2,
  notes: "",
};

const HISTORY_STATUSES = new Set(["completed", "rejected", "cancelled", "expired"]);
const statusFilters = ["all", "pending", "approved", "history"];

export default function useAdminReservations({
  initialFilter = "all",
  reservations,
  setReservations,
  tables,
  setTables,
  tableCharges = [],
  setTableCharges,
  setLogs,
}) {
  const { addNotification, showToast } = useNotifications();
  // The hall's hours (Admin > Website), which bookings must keep to.
  const { hours } = useSiteSettings().settings;
  const [filter, setFilter] = useState(statusFilters.includes(initialFilter) ? initialFilter : "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyReservationForm);
  const [editId, setEditId] = useState(null);

  const availableTables = getAvailableReservationTables({
    tables,
    reservations,
    date: form.date,
    time: form.time,
    excludeId: editId,
  });

  // A booking being edited may keep the slot it already has, even once that has
  // passed; a new date or time must still be ahead.
  const editedReservation = editId ? reservations.find((reservation) => reservation.id === editId) : null;
  const keepsBookedSlot =
    Boolean(editedReservation) && editedReservation.date === form.date && editedReservation.time === form.time;
  const scheduleError = keepsBookedSlot ? "" : getReservationScheduleError(form.date, form.time, undefined, hours);
  // The picked table must be free then: not occupied, reserved or under
  // maintenance. A booking kept on its own slot and table is not checked against
  // itself (its guest may be the one playing there).
  const keepsBookedTable =
    keepsBookedSlot && Number(editedReservation.tableId ?? editedReservation.table) === Number(form.tableId);
  const tableError = keepsBookedTable
    ? ""
    : getChosenTableError({
        tables,
        reservations,
        tableId: form.tableId,
        date: form.date,
        time: form.time,
        durationMinutes: editedReservation?.durationMinutes,
        excludeId: editId,
      });
  const chosenTableName = tables.find((table) => String(table.id) === String(form.tableId))?.name || "";

  const matchedReservations = reservations.filter((reservation) => {
    const inFilter =
      filter === "all"
        ? !HISTORY_STATUSES.has(reservation.status)
        : filter === "history"
          ? HISTORY_STATUSES.has(reservation.status)
          : reservation.status === filter;

    return inFilter && matchesSearch(reservation, search);
  });

  const { pageCount, currentPage, pageStart, items: filteredReservations } = paginate(
    matchedReservations,
    page,
    PAGE_SIZE
  );

  // Any change to what is being looked at starts again from the first page.
  const changeFilter = (nextFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  const changeSearch = (nextSearch) => {
    setSearch(nextSearch);
    setPage(1);
  };

  const goToPage = (nextPage) => setPage(Math.min(Math.max(1, nextPage), pageCount));

  const counts = statusFilters.reduce((acc, status) => {
    acc[status] =
      status === "all"
        ? reservations.filter((reservation) => !HISTORY_STATUSES.has(reservation.status)).length
        : status === "history"
          ? reservations.filter((reservation) => HISTORY_STATUSES.has(reservation.status)).length
        : reservations.filter((reservation) => reservation.status === status).length;
    return acc;
  }, {});

  const logReservationEvent = ({
    action,
    detail,
    reservation,
    previousStatus,
    nextStatus,
    severity = "info",
  }) => {
    appendAuditLog(setLogs, {
      type: "reservation",
      staff: "Admin",
      action,
      detail,
      severity,
      entity: "reservation",
      customer: buildCustomerAudit(reservation),
      table: buildTableAudit(reservation, previousStatus, nextStatus),
      reservation: buildReservationAudit(reservation, previousStatus, nextStatus),
    });
  };

  const setTableStateForReservation = (reservation, nextStatus, previousStatus = reservation?.status) => {
    if (!setTables || !reservation?.tableId) return;

    const tableId = Number(reservation.tableId ?? reservation.table);
    if (!tableId) return;

    // An approved booking marks its table Reserved only once it is due, which
    // App.jsx does for every table (tableHolds.js).
    if (nextStatus === "approved") return;

    if (previousStatus === "approved"&& ["rejected", "completed", "pending", "expired"].includes(nextStatus)) {
      releaseTable(tableId, reservation, nextStatus);
    }
  };

const releaseTable = (tableId, reservation, nextStatus) => {
    if (!setTables) return;

    // A guest still playing when their booking is completed has finished their
    // session, so its bill goes to Sales / POS like any other ended session.
    const customerName = reservation.customerName || reservation.customer || "";
    const playingTable =
      nextStatus === "completed"
        ? (tables || []).find(
            (table) =>
              isReservationTable(table, tableId, reservation) &&
              table.status === "occupied" &&
              table.startTime &&
              (table.customer || "") === customerName
          )
        : null;
    const charge = playingTable
      ? createTableCharge({ table: playingTable, reservations, tableCharges, endedBy: "Admin", now: getCurrentTimestamp() })
      : null;
    if (charge) {
      setTableCharges?.((prev) => [charge, ...prev]);
      showToast(endedChargeToast(charge));
    }

    setTables((prev) =>
      prev.map((table) => {
        if (!isReservationTable(table, tableId, reservation)) return table;

        const sameCustomer = (reservation.customerName || reservation.customer || "") === (table.customer || "");
        const canRelease = table.status === "reserved" || sameCustomer;

        return canRelease ? { ...table, ...ENDED_SESSION_FIELDS } : table;
      })
    );
  };

  const updateReservation = (id, changes) => {
    const currentReservation = reservations.find((reservation) => reservation.id === id);
    if (!currentReservation) return;

    const nextReservation = { ...currentReservation, ...changes };
    const nextStatus = changes.status ?? currentReservation.status;

    setReservations((prev) =>
      prev.map((reservation) => (reservation.id === id ? nextReservation : reservation))
    );

    setTableStateForReservation(nextReservation, nextStatus, currentReservation.status);
    updateRemoteReservation(nextReservation).catch((error) => {
      console.warn("Unable to sync reservation update", error);
    });

    if (changes.status && changes.status !== currentReservation.status) {
      logReservationEvent({
        action: `Reservation ${changes.status}`,
        detail: [
          `${currentReservation.customerName} reservation for ${currentReservation.tableName}`,
          `moved from ${currentReservation.status} to ${changes.status}`,
        ].join(" "),
        reservation: nextReservation,
        previousStatus: currentReservation.status,
        nextStatus,
        severity: changes.status === "rejected" ? "reject" : "info",
      });
      addNotification({
        message: `${nextReservation.customerName} reservation ${changes.status}.`,
      });
    }
  };

  const saveReservation = async () => {
    if (!isValidSmsNumber(form.phone)) {
      window.alert("Please enter the customer's mobile number in 09XXXXXXXXX format.");
      return;
    }

    if (scheduleError) {
      window.alert(scheduleError);
      return;
    }

    if (tableError) {
      window.alert(tableError);
      return;
    }

    const payload = buildReservationPayload(form, tables);
    if (!payload) return;

    if (hasScheduleConflict(payload, editId)) return;

    if (editId) {
      saveExistingReservation(payload);
    } else if (!(await saveNewReservation(payload))) {
      return;
    }

    setModal(null);
    setEditId(null);
  };

  const buildReservationPayload = (sourceForm, tableList) => {
    const tableId = Number(sourceForm.tableId);
    const tableName = tableList.find((table) => table.id === tableId)?.name || `Table ${tableId}`;

    return {
      customerName: sourceForm.customerName.trim(),
      phone: sourceForm.phone.trim(),
      date: sourceForm.date,
      time: sourceForm.time,
      tableId,
      tableName,
      partySize: Number(sourceForm.partySize) || 1,
      notes: sourceForm.notes.trim(),
    };
  };

  const hasScheduleConflict = (payload, excludedId) => {
    // An edit keeps the booked length, so a multi-hour stay is checked in full.
    const candidate = {
      tableId: payload.tableId,
      date: payload.date,
      time: payload.time,
      durationMinutes: reservations.find((reservation) => reservation.id === excludedId)?.durationMinutes,
    };

    if (!payload.date || !payload.time || !hasReservationConflict(reservations, candidate, excludedId)) {
      return false;
    }

    window.alert(`${payload.tableName} already has a reservation at ${payload.time} on ${payload.date}.`);
    return true;
  };

  const saveExistingReservation = (payload) => {
    const currentReservation = reservations.find((reservation) => reservation.id === editId);
    const previousTableId = Number(currentReservation?.tableId ?? currentReservation?.table);

    if (currentReservation?.status === "approved" && previousTableId && previousTableId !== payload.tableId) {
      releaseTable(previousTableId, currentReservation);
    }

    updateReservation(editId, payload);
    logReservationEvent({
      action: "Reservation updated",
      detail: `${payload.customerName} reservation updated for ${payload.tableName} on ${payload.date} ${payload.time}`,
      reservation: { ...currentReservation, ...payload },
      previousStatus: currentReservation?.status || "pending",
      nextStatus: currentReservation?.status || "pending",
    });
    addNotification({ message: `${payload.customerName} reservation updated.` });
  };

  // Booked in person (walk-in), so it is confirmed on the spot: only online
  // bookings wait for approval. Saved to the server first, as the front desk
  // does, so the employees see it and the slot cannot be booked online.
  const saveNewReservation = async (payload) => {
    let saved;
    try {
      saved = await createRemoteReservation({ id: Date.now(), ...payload, status: "approved", source: "admin" });
    } catch (error) {
      window.alert(error.message || "Unable to save the reservation.");
      return false;
    }

    setReservations((prev) => [...prev, saved]);
    logReservationEvent({
      action: "Reservation created",
      detail: `${saved.customerName} walk-in reservation created and confirmed for ${saved.tableName} on ${saved.date} ${saved.time}`,
      reservation: saved,
      previousStatus: null,
      nextStatus: "approved",
    });
    addNotification({ message: `${saved.customerName} is booked for ${saved.tableName} on ${saved.date} at ${saved.time}.` });
    return true;
  };

  const openEdit = (reservation) => {
    setForm({
      customerName: reservation.customerName || reservation.customer || "",
      phone: reservation.phone || "",
      date: reservation.date || "",
      time: reservation.time || "",
      tableId: String(reservation.tableId ?? reservation.table ?? ""),
      partySize: reservation.partySize ?? reservation.pax ?? 2,
      notes: reservation.notes || "",
    });
    setEditId(reservation.id);
    setModal("form");
  };

  const openNew = () => {
    setForm(emptyReservationForm);
    setEditId(null);
    setModal("form");
  };

  useEffect(() => {
    if (!setTables) return;

    const approvedReservations = reservations.filter((reservation) => reservation.status === "approved");

    setTables((prev) => removeGeneratedTableCards(prev, approvedReservations));
  }, [reservations, setTables]);

  return {
    availableTables,
    chosenTableName,
    counts,
    editId,
    filter,
    filteredReservations,
    form,
    modal,
    scheduleError,
    tableError,
    search,
    setSearch: changeSearch,
    page: currentPage,
    pageCount,
    pageSize: PAGE_SIZE,
    pageStart,
    totalMatches: matchedReservations.length,
    goToPage,
    setFilter: changeFilter,
    setForm,
    setModal,
    statusFilters,
    openEdit,
    openNew,
    saveReservation,
    updateReservation,
  };
}

const buildCustomerAudit = (reservation) => {
  if (!reservation?.customerName) return { previous: null, current: null };

  const customer = {
    name: reservation.customerName,
    phone: reservation.phone || "",
    partySize: reservation.partySize || reservation.pax || 0,
  };

  return { previous: customer, current: customer };
};

const normalizeTableName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getTableNumber = (name) => {
  const match = normalizeTableName(name).match(/table\s*(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const isReservationTable = (table, tableId, reservation) =>
  String(table.id) === String(tableId) ||
  (normalizeTableName(table.name) !== "" &&
    normalizeTableName(table.name) === normalizeTableName(reservation.tableName)) ||
  (getTableNumber(table.name) !== null &&
    getTableNumber(table.name) === getTableNumber(reservation.tableName));

const buildTableAudit = (reservation, previousStatus, nextStatus) => {
  if (!reservation?.tableId) return null;

  return {
    id: Number(reservation.tableId ?? reservation.table),
    name: reservation.tableName || `Table ${reservation.tableId ?? reservation.table}`,
    previousStatus: previousStatus === "approved" ? "reserved" : "available",
    currentStatus: nextStatus === "approved" ? "reserved" : "available",
  };
};

const buildReservationAudit = (reservation, previousStatus, nextStatus) => {
  if (!reservation) return null;

  return {
    id: reservation.id,
    previousStatus,
    currentStatus: nextStatus,
    date: reservation.date,
    time: reservation.time,
  };
};

// Older versions added an extra table card for a booking whose table name did not
// match; those copies are removed. Marking tables Reserved is done in App.jsx.
const removeGeneratedTableCards = (tables, approvedReservations) => {
  const generatedTableCards = new Set();

  approvedReservations.forEach((reservation) => {
    const tableId = Number(reservation.tableId ?? reservation.table);
    const matchingTables = tables.filter((table) => isReservationTable(table, tableId, reservation));
    const configuredTable = matchingTables.find((table) => String(table.id) !== String(tableId)) || matchingTables[0];

    matchingTables.forEach((table) => {
      if (table !== configuredTable && String(table.reservationId) === String(reservation.id)) {
        generatedTableCards.add(table);
      }
    });
  });

  return generatedTableCards.size ? tables.filter((table) => !generatedTableCards.has(table)) : tables;
};
