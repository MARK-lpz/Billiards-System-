import { useEffect, useState } from "react";
import { appendAuditLog } from "../../utils/audit";
import { isValidSmsNumber } from "../../utils/phone";
import {
  getAvailableReservationTables,
  hasReservationConflict,
} from "../../utils/reservations";

const emptyReservationForm = {
  customerName: "",
  phone: "",
  date: "",
  time: "",
  tableId: "",
  partySize: 2,
  notes: "",
};

const statusFilters = ["all", "pending", "approved", "rejected", "completed"];

export default function useAdminReservations({
  reservations,
  setReservations,
  tables,
  setTables,
  setLogs,
}) {
  const [filter, setFilter] = useState("all");
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

  const filteredReservations =
    filter === "all" ? reservations : reservations.filter((reservation) => reservation.status === filter);

  const counts = statusFilters.reduce((acc, status) => {
    acc[status] =
      status === "all"
        ? reservations.length
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

    if (nextStatus === "approved") {
      reserveTable(tableId, reservation);
      return;
    }

    if (previousStatus === "approved" && ["rejected", "completed", "pending"].includes(nextStatus)) {
      releaseTable(tableId, reservation);
    }
  };

  const reserveTable = (tableId, reservation) => {
    if (!setTables) return;

    setTables((prev) =>
      prev.map((table) =>
        table.id === tableId
          ? {
              ...table,
              status: "reserved",
              startTime: null,
              customer: reservation.customerName || reservation.customer || "",
            }
          : table
      )
    );
  };

  const releaseTable = (tableId, reservation) => {
    if (!setTables) return;

    setTables((prev) =>
      prev.map((table) => {
        if (table.id !== tableId) return table;

        const sameCustomer = (reservation.customerName || reservation.customer || "") === (table.customer || "");
        const canRelease = table.status === "reserved" || sameCustomer;

        return canRelease ? { ...table, status: "available", startTime: null, customer: "" } : table;
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
        severity: changes.status === "rejected" ? "medium" : "info",
      });
    }
  };

  const saveReservation = () => {
    if (form.phone.trim() && !isValidSmsNumber(form.phone)) {
      window.alert("Please enter a valid SMS number in 09XXXXXXXXX format.");
      return;
    }

    const payload = buildReservationPayload(form, tables);
    if (!payload) return;

    if (hasScheduleConflict(payload, editId)) return;

    if (editId) {
      saveExistingReservation(payload);
    } else {
      saveNewReservation(payload);
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
    const candidate = {
      tableId: payload.tableId,
      date: payload.date,
      time: payload.time,
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
  };

  const saveNewReservation = (payload) => {
    const id = Date.now();
    setReservations((prev) => [...prev, { id, ...payload, status: "pending", source: "admin" }]);
    logReservationEvent({
      action: "Reservation created",
      detail: `${payload.customerName} reservation created for ${payload.tableName} on ${payload.date} ${payload.time}`,
      reservation: { id, ...payload },
      previousStatus: null,
      nextStatus: "pending",
    });
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

    const approvedMap = new Map(
      reservations
        .filter((reservation) => reservation.status === "approved")
        .map((reservation) => [Number(reservation.tableId ?? reservation.table), reservation])
    );

    setTables((prev) => syncApprovedReservationsToTables(prev, approvedMap));
  }, [reservations, setTables]);

  return {
    availableTables,
    counts,
    editId,
    filter,
    filteredReservations,
    form,
    modal,
    setFilter,
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

const syncApprovedReservationsToTables = (tables, approvedMap) => {
  let changed = false;

  const nextTables = tables.map((table) => {
    const approvedReservation = approvedMap.get(table.id);
    if (!approvedReservation || !["available", "reserved"].includes(table.status)) return table;

    const nextCustomer = approvedReservation.customerName || approvedReservation.customer || "";
    if (table.status === "reserved" && table.customer === nextCustomer) return table;

    changed = true;
    return {
      ...table,
      status: "reserved",
      startTime: null,
      customer: nextCustomer,
    };
  });

  return changed ? nextTables : tables;
};
