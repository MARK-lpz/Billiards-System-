import ConfirmDialog from "./ConfirmDialog";
import { describeReservationTime, formatReservationDate } from "../../utils/reservations";

/**
 * Asks before a booking is marked complete, on the admin's list and the front
 * desk's: it leaves the active list for good, so a stray click must not do it.
 */
export default function CompleteReservationDialog({ booking, onConfirm, onClose }) {
  const name = booking.customerName || booking.customer;
  const table = booking.tableName || `Table ${booking.tableId ?? booking.table}`;
  const checkedIn = ["arrived", "seated"].includes(booking.status);
  const paid = Number(booking.paymentAmount) > 0;

  return (
    <ConfirmDialog
      title="Complete this reservation?"
      message={
        <>
          <strong>{name}</strong> on {table} for {formatReservationDate(booking.date)}
          {booking.time ? `, ${describeReservationTime(booking)}` : ""} will be marked as done.
        </>
      }
      detail={[
        "This cannot be undone. The booking moves to history and the table is freed.",
        checkedIn ? "If the guest is still playing, the session ends and its bill goes to Sales / POS." : "This guest has not checked in yet.",
        !checkedIn && paid ? "Their payment stays with the hall." : "",
      ]
        .filter(Boolean)
        .join(" ")}
      confirmLabel="Yes, Complete Reservation"
      cancelLabel="Keep Reservation"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
