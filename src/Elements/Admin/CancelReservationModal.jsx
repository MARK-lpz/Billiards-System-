import { useState } from "react";
import ConfirmDialog from "../Global/ConfirmDialog";
import RefundChoice from "../Global/RefundChoice";
import { useOnlinePayments } from "../Global/useOnlinePayments";
import { NO_REFUND_CHOICE, refundChoiceReady, toRefundExtra } from "../../utils/bookingPayments";
import { findTableReservation, formatReservationDate, formatReservationTime } from "../../utils/reservations";
import { findReservationPayment } from "../../utils/onlinePayments";

/**
 * Asks before a reserved table's booking is cancelled from its card. The
 * admin's Pool Tables and the employee dashboard both use it. A booking that
 * was paid for also asks whether to give it back: `onConfirm` gets what to send
 * with the cancel (toRefundExtra).
 */
export default function CancelReservationModal({ table, reservations = [], onClose, onConfirm }) {
  const tableName = table.name || `Table ${table.id}`;
  const when = table.reservationDate
    ? ` on ${formatReservationDate(table.reservationDate)}${
        table.reservationTime ? ` at ${formatReservationTime(table.reservationTime)}` : ""
      }`
    : "";
  const { payments } = useOnlinePayments();
  const found = findTableReservation(table, reservations);
  const booking = found && String(found.id) === String(table.reservationId) ? found : null;
  const payment = booking?.source === "online" ? findReservationPayment(payments, booking.id) : null;
  const [choice, setChoice] = useState(NO_REFUND_CHOICE);

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
      confirmDisabled={!refundChoiceReady(booking, payment, choice)}
      onConfirm={() => onConfirm(toRefundExtra(booking, payment, choice))}
      onClose={onClose}
    >
      <RefundChoice payment={payment} booking={booking} value={choice} onChange={setChoice} />
    </ConfirmDialog>
  );
}
