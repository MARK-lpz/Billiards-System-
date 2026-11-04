import { appendAuditLog } from "../../utils/audit";
import { createRemoteReservation } from "../../utils/reservationApi";
import { createBookingRefundSale, createBookingSale, describePaidBy, isDeskPaid } from "../../utils/bookingPayments";
import { formatHoursLabel } from "../../utils/reservations";
import { formatPeso } from "../../utils/onlinePayments";
import { useNotifications } from "./useNotifications";

// Read only from handlers, never while rendering.
const newId = () => Date.now();
const SOURCE_BY_STAFF = { Admin: "admin", Employee: "new" };

/**
 * What the money of a booking made at the hall does, the same on every screen
 * (see utils/bookingPayments.js). `staff` is "Admin" or "Employee".
 */
export default function useBookingPayment({ staff, setReservations, setTransactions, setLogs }) {
  const { addNotification } = useNotifications();

  // Saved on the server first, with its payment: if that is refused, nothing is
  // recorded here and the error goes back to the payment window. Booked in person,
  // so it is confirmed on the spot: only online bookings wait for approval.
  // Resolves with the sale, for its receipt.
  const createPaidBooking = async ({ booking, method, details }) => {
    const saved = await createRemoteReservation({
      ...booking,
      id: newId(),
      status: "approved",
      source: SOURCE_BY_STAFF[staff],
    });

    setReservations((previous) => [saved, ...previous]);
    const sale = createBookingSale({ booking: saved, method, details, saleId: newId(), cashier: staff });
    setTransactions?.((previous) => [sale, ...previous]);
    appendAuditLog(setLogs, {
      type: "reservation",
      staff,
      action: "Created reservation",
      detail: `${saved.customerName} was booked for ${saved.tableName} on ${saved.date} at ${saved.time}, ${formatHoursLabel(saved.durationMinutes)}, and paid ${formatPeso(saved.paymentAmount)} ${describePaidBy(saved)}.`,
      severity: "info",
      entity: "reservation",
      customer: { previous: null, current: { name: saved.customerName, phone: saved.phone, partySize: saved.partySize } },
      table: { id: saved.tableId, name: saved.tableName },
      reservation: { id: saved.id, previousStatus: null, currentStatus: saved.status, date: saved.date, time: saved.time },
      payment: { amount: saved.paymentAmount, method, referenceNumber: details.referenceNumber || "" },
    });
    addNotification({ message: `${saved.customerName} is booked for ${saved.tableName} on ${saved.date} at ${saved.time}.` });
    return sale;
  };

  // Once the server has cancelled the booking: `extra` says whether its desk
  // payment went back, and how.
  const recordBookingRefund = (booking, extra = {}) => {
    if (!extra.refundPayment || !isDeskPaid(booking)) return;

    setTransactions?.((previous) => [
      createBookingRefundSale({
        booking,
        refundMethod: extra.refundMethod,
        refundReference: extra.refundReference,
        saleId: newId(),
        cashier: staff,
      }),
      ...previous,
    ]);
    appendAuditLog(setLogs, {
      type: "reservation",
      staff,
      action: "Gave back reservation payment",
      detail: `${formatPeso(booking.paymentAmount)} went back to ${booking.customerName} ${extra.refundMethod === "cash" ? "in cash" : "by GCash"} for ${booking.tableName} on ${booking.date}.`,
      severity: "info",
      entity: "reservation",
      reservation: { id: booking.id, previousStatus: booking.status, currentStatus: booking.status, date: booking.date, time: booking.time },
    });
  };

  return { createPaidBooking, recordBookingRefund };
}
