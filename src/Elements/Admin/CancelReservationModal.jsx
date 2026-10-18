import { useState } from "react";
import ConfirmDialog from "../Global/ConfirmDialog";
import RefundChoice from "../Global/RefundChoice";
import { useOnlinePayments } from "../Global/useOnlinePayments";
import { findTableReservation, formatReservationDate, formatReservationTime } from "../../utils/reservations";
import { findReservationPayment, needsRefundChoice } from "../../utils/onlinePayments";

/**
 * Asks before a reserved table's booking is cancelled from its card. The
 * admin's Pool Tables and the employee dashboard both use it. A website booking
 * whose GCash payment was accepted also asks whether to give it back:
 * `onConfirm` gets { refundPayment } then, to send with the cancel.
 */
export default function CancelReservationModal({ table, reservations = [], onClose, onConfirm }) {
  const tableName = table.name || `Table ${table.id}`;
  const when = table.reservationDate
    ? ` on ${formatReservationDate(table.reservationDate)}${
        table.reservationTime ? ` at ${formatReservationTime(table.reservationTime)}` : ""
      }`
    : "";
  const { payments } = useOnlinePayments();
  const booking = findTableReservation(table, reservations);
  const payment =
    booking && String(booking.id) === String(table.reservationId) && booking.source === "online"
      ? findReservationPayment(payments, booking.id)
      : null;
  const asks = needsRefundChoice(payment);
  const [choice, setChoice] = useState("");

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
      confirmDisabled={asks && !choice}
      onConfirm={() => onConfirm(asks ? { refundPayment: choice === "refund" } : {})}
      onClose={onClose}
    >
      <RefundChoice payment={payment} value={choice} onChange={setChoice} />
    </ConfirmDialog>
  );
}
