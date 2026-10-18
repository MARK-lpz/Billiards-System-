import { useState } from "react";
import "../../styles/Admin/Reservations.css";
import ReservationFilters from "../../Elements/Admin/ReservationFilters";
import ReservationHeader from "../../Elements/Admin/ReservationHeader";
import ReservationModal from "../../Elements/Admin/ReservationModal";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import useAdminReservations from "../../Elements/Admin/useAdminReservations";
import Pagination from "../../Elements/Global/Pagination";
import PaymentReviewModal from "../../Elements/Global/PaymentReviewModal";
import RefundModal from "../../Elements/Global/RefundModal";
import { useOnlinePayments } from "../../Elements/Global/useOnlinePayments";
import { appendAuditLog } from "../../utils/audit";
import { describeReservationTime } from "../../utils/reservations";
import { describeRefund, findReservationPayment, formatPayer, formatPeso } from "../../utils/onlinePayments";

// `initialFilter`: the list to open on, e.g. "pending" from the bell's payment checks.
export default function Reservations({
  initialFilter,
  reservations,
  setReservations,
  tables,
  setTables,
  tableCharges,
  setTableCharges,
  setLogs,
  onlineReservationsOpen,
  isUpdatingOnlineReservations,
  onOnlineReservationsChange,
}) {
  const reservationState = useAdminReservations({
    initialFilter,
    reservations,
    setReservations,
    tables,
    setTables,
    tableCharges,
    setTableCharges,
    setLogs,
  });
  // The website's GCash payments: one opened with its receipt, or being sent back
  // ({ payment, reservation }).
  const { payments, applySaved } = useOnlinePayments();
  const [paymentShown, setPaymentShown] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const whatFor = (reservation) =>
    `${reservation.tableName}, ${reservation.date} (${describeReservationTime(reservation)})`;
  // Looked up again, so an open window follows the payment as it moves on.
  const livePayment = (entry) => (entry ? findReservationPayment(payments, entry.reservation.id) || entry.payment : null);

  const finishRefund = (saved) => {
    const reservation = refundTarget?.reservation;
    applySaved(saved);
    appendAuditLog(setLogs, {
      type: "reservation",
      staff: "Admin",
      entity: "reservation",
      severity: "info",
      action: "Sent back online payment",
      detail: `${saved.customerName}'s ${formatPeso(saved.amount)} GCash payment${
        reservation ? ` for ${whatFor(reservation)}` : ""
      } went back to ${formatPayer(saved)}. ${describeRefund(saved)}`,
    });
    setRefundTarget(null);
  };

  return (
    <div className="reservations-container">
      <ReservationHeader
        onNew={reservationState.openNew}
        onlineReservationsOpen={onlineReservationsOpen}
        isUpdatingOnlineReservations={isUpdatingOnlineReservations}
        onOnlineReservationsChange={onOnlineReservationsChange}
      />

      <ReservationFilters
        counts={reservationState.counts}
        filter={reservationState.filter}
        filters={reservationState.statusFilters}
        onChange={reservationState.setFilter}
        search={reservationState.search}
        onSearchChange={reservationState.setSearch}
      />

      <ReservationsTable
        reservations={reservationState.filteredReservations}
        onUpdate={reservationState.updateReservation}
        onEdit={reservationState.openEdit}
        payments={payments}
        onViewPayment={(payment, reservation) => setPaymentShown({ payment, reservation })}
        onRefund={(payment, reservation) => setRefundTarget({ payment, reservation })}
        emptyMessage={
          reservationState.search
            ? `No reservations match "${reservationState.search}"`
            : reservationState.filter === "history"
              ? "No reservation history yet"
              : "No active reservations found"
        }
      />

      <Pagination
        page={reservationState.page}
        pageCount={reservationState.pageCount}
        pageStart={reservationState.pageStart}
        pageSize={reservationState.pageSize}
        total={reservationState.totalMatches}
        goToPage={reservationState.goToPage}
      />

      {paymentShown && (
        <PaymentReviewModal
          key={paymentShown.payment.id}
          payment={livePayment(paymentShown)}
          lines={[
            ["Customer", paymentShown.reservation.customerName],
            ["Booking", whatFor(paymentShown.reservation)],
          ]}
          onRefund={(payment) => {
            setPaymentShown(null);
            setRefundTarget({ payment, reservation: paymentShown.reservation });
          }}
          onClose={() => setPaymentShown(null)}
        />
      )}

      {refundTarget && (
        <RefundModal
          key={refundTarget.payment.id}
          payment={refundTarget.payment}
          forWhat={whatFor(refundTarget.reservation)}
          onDone={finishRefund}
          onClose={() => setRefundTarget(null)}
        />
      )}

      {reservationState.modal === "form" && (
        <ReservationModal
          form={reservationState.form}
          setForm={reservationState.setForm}
          editId={reservationState.editId}
          scheduleError={reservationState.scheduleError}
          tableError={reservationState.tableError}
          chosenTableName={reservationState.chosenTableName}
          tables={reservationState.availableTables}
          onClose={() => reservationState.setModal(null)}
          onSave={reservationState.saveReservation}
        />
      )}
    </div>
  );
}
