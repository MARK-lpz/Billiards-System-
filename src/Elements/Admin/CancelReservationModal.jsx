import ConfirmDialog from "../Global/ConfirmDialog";
import { formatReservationDate, formatReservationTime } from "../../utils/reservations";

/**
 * Asks before a reserved table's booking is cancelled from its card. The
 * admin's Pool Tables and the employee dashboard both use it.
 */
export default function CancelReservationModal({ table, onClose, onConfirm }) {
  const tableName = table.name || `Table ${table.id}`;
  const when = table.reservationDate
    ? ` on ${formatReservationDate(table.reservationDate)}${
        table.reservationTime ? ` at ${formatReservationTime(table.reservationTime)}` : ""
      }`
    : "";

  return (
    <ConfirmDialog
      title="Cancel this reservation?"
      message={
        <>
          <strong>{table.customer || "This customer"}</strong>&apos;s reservation for {tableName}
          {when} will be cancelled and the table freed for walk-ins.
        </>
      }
      detail="This cannot be undone. The customer has to book again if they still want the table."
      confirmLabel="Yes, Cancel Reservation"
      cancelLabel="Keep Reservation"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
