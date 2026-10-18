import { useState } from "react";
import ConfirmDialog from "../Global/ConfirmDialog";
import PaymentStatusChip from "../Global/PaymentStatusChip";
import RefundChoice from "../Global/RefundChoice";
import { describeReservationTime } from "../../utils/reservations";
import { findReservationPayment, needsRefundChoice } from "../../utils/onlinePayments";

const HISTORY_STATUSES = new Set(["completed", "rejected", "cancelled", "expired"]);

const getReservationMode = (reservation) => {
  if (String(reservation.source || "").toLowerCase() === "online") {
    return { label: "Online", icon: "bi-globe2", className: "reservations-mode-online" };
  }

  return { label: "Walk-in", icon: "bi-person-walking", className: "reservations-mode-walkin" };
};

// `payments`: the website's GCash payments; `onViewPayment` / `onRefund` open
// one (with its receipt) or send it back: (payment, reservation).
export default function ReservationsTable({ reservations, onUpdate, onEdit, emptyMessage, payments = [], onViewPayment, onRefund }) {
  // Cancelling cannot be undone, so the click only arms the confirmation.
  const [cancelTarget, setCancelTarget] = useState(null);
  // For a cancelled booking whose payment was accepted: "refund" or "keep".
  const [refundChoice, setRefundChoice] = useState("");
  const paymentOf = (reservation) =>
    String(reservation.source || "").toLowerCase() === "online" ? findReservationPayment(payments, reservation.id) : null;
  const openCancel = (reservation) => {
    setRefundChoice("");
    setCancelTarget(reservation);
  };

  // Takes the reservation as an argument rather than reading `cancelTarget` from
  // the closure: the React Compiler narrows a closed-over `cancelTarget.id` into
  // a render-time memo check, which throws while the target is still null.
  const confirmCancel = (reservation, choice) => {
    const asked = needsRefundChoice(paymentOf(reservation));
    onUpdate(reservation.id, { status: "rejected" }, asked ? { refundPayment: choice === "refund" } : {});
    setCancelTarget(null);
  };

  return (
    <div className="card reservations-table-card">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table reservations-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Date & Time</th>
                <th>Table</th>
                <th>Pax</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="reservations-empty">
                    <i className="bi bi-inbox"></i>
                    <p>{emptyMessage || "No reservations found"}</p>
                  </td>
                </tr>
              ) : (
                reservations.map(r => {
                  const isHistorical = HISTORY_STATUSES.has(r.status);
                  const mode = getReservationMode(r);
                  const payment = paymentOf(r);

                  return (
                    <tr key={r.id}>
                      <td className="reservations-customer">{r.customerName || r.customer}</td>
                      <td className="reservations-datetime">
                        {r.date}
                        <br />
                        <span className="reservations-time">{describeReservationTime(r)}</span>
                      </td>
                      <td>{r.tableName || `Table ${r.tableId ?? r.table}`}</td>
                      <td>{r.partySize ?? r.pax} pax</td>
                      <td>
                        <span className={`reservations-mode ${mode.className}`}>
                          <i className={`bi ${mode.icon}`} aria-hidden="true"></i>
                          {mode.label}
                        </span>
                      </td>
                      <td>
                        <span className={`badge reservations-badge-${r.status}`}>
                          {r.status}
                        </span>
                        {payment && (
                          <div className="reservations-pay-status">
                            <PaymentStatusChip payment={payment} short />
                          </div>
                        )}
                      </td>
                      <td className="reservations-notes">{r.notes || "—"}</td>
                      <td>
                        <div className="reservations-actions">
                          {payment?.status === "refund_due" && (
                            <button className="btn btn-sm btn-success" onClick={() => onRefund(payment, r)}>
                              <i className="bi bi-arrow-counterclockwise me-1"></i>
                              Send Back
                            </button>
                          )}
                          {payment && (
                            <button className="btn btn-sm btn-outline-info" onClick={() => onViewPayment(payment, r)}>
                              <i className="bi bi-receipt me-1"></i>
                              Receipt
                            </button>
                          )}
                          {r.status === "pending" && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => onUpdate(r.id, { status: "approved" })}
                              >
                                <i className="bi bi-check-circle me-1"></i>
                                Approve
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => onUpdate(r.id, { status: "rejected" })}
                              >
                                <i className="bi bi-x-circle me-1"></i>
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "approved" && (
                            <>
                              <button
                                className="btn btn-sm btn-info"
                                onClick={() => onUpdate(r.id, { status: "completed" })}
                              >
                                <i className="bi bi-check-circle me-1"></i>
                                Complete
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => openCancel(r)}
                              >
                                <i className="bi bi-x-circle me-1"></i>
                                Cancel
                              </button>
                            </>
                          )}
                          {!isHistorical && (
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => onEdit(r)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this reservation?"
          message={
            <>
              <strong>{cancelTarget.customerName || cancelTarget.customer}</strong> on{" "}
              {cancelTarget.tableName || `Table ${cancelTarget.tableId ?? cancelTarget.table}`} for{" "}
              {cancelTarget.date} at {cancelTarget.time} will be cancelled and the slot freed for someone else.
            </>
          }
          detail="This cannot be undone. The booking moves to history and has to be created again if the customer still wants it."
          confirmLabel="Yes, Cancel Reservation"
          cancelLabel="Keep Reservation"
          confirmDisabled={needsRefundChoice(paymentOf(cancelTarget)) && !refundChoice}
          onConfirm={() => confirmCancel(cancelTarget, refundChoice)}
          onClose={() => setCancelTarget(null)}
        >
          <RefundChoice payment={paymentOf(cancelTarget)} value={refundChoice} onChange={setRefundChoice} />
        </ConfirmDialog>
      )}
    </div>
  );
}
