import { useState } from "react";
import "../../styles/OnlinePayments.css";
import PaymentReviewModal from "./PaymentReviewModal";
import PaymentStatusChip from "./PaymentStatusChip";
import RefundModal from "./RefundModal";
import { useNotifications } from "./useNotifications";
import { useOnlinePayments } from "./useOnlinePayments";
import { appendAuditLog } from "../../utils/audit";
import { formatEventWhen } from "../../utils/eventUpdates";
import { acceptTournamentPayment, rejectTournamentPayment } from "../../utils/paymentsApi";
import { closingDigitsOf } from "../../utils/paymentReference";
import { describeRefund, formatPayer, formatPeso, getTournamentPayments } from "../../utils/onlinePayments";

const ACTIONS = {
  held: { label: "Check Payment", icon: "bi-shield-check", className: "is-action" },
  refund_due: { label: "Send Back", icon: "bi-arrow-counterclockwise", className: "is-refund" },
};

/**
 * The entry fees players paid on the website for one tournament, each with
 * what staff can do next: check a held one (accept it, or turn it down, which
 * takes the player off the tournament), send back one that was turned down or
 * whose tournament was cancelled, or look at one already settled. Shown only
 * when there are any. `setEvents` (the front desk's copy) takes the tournament
 * as the server saved it after a player is taken off; the admin's copy follows
 * the server on its own. `staff` names who did it in the Audit Trail.
 */
export default function TournamentPayments({ event, setEvents, setLogs, staff = "Employee", heading = "Online payments", className = "", labelClassName = "tourna-section-label" }) {
  const { payments, applySaved } = useOnlinePayments();
  const { addNotification } = useNotifications();
  const [reviewId, setReviewId] = useState(null);
  const [refundId, setRefundId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const list = getTournamentPayments(payments, event.id);
  if (!list.length) return null;

  const reviewing = list.find((payment) => payment.id === reviewId) || null;
  const refunding = list.find((payment) => payment.id === refundId) || null;
  const whatFor = `${event.name}, ${formatEventWhen(event.date, event.time)}`;
  const log = (action, detail, severity = "info") =>
    appendAuditLog(setLogs, { type: "sale", staff, entity: "tournament", entityId: String(event.id), severity, action, detail });

  const open = (payment) => {
    setError("");
    if (payment.status === "refund_due") setRefundId(payment.id);
    else setReviewId(payment.id);
  };

  const accept = async (payment) => {
    setBusy(true);
    setError("");
    try {
      const { payment: saved } = await acceptTournamentPayment(payment.id);
      applySaved(saved);
      log(
        "Accepted tournament payment",
        `${saved.participant}'s ${formatPeso(saved.amount)} entry fee for ${whatFor} was found in GCash (reference ending ${closingDigitsOf(saved.reference)}).`
      );
      addNotification({ message: `${saved.customerName}'s entry fee for ${event.name} is accepted.` });
      setReviewId(null);
    } catch (acceptError) {
      setError(acceptError.message || "Unable to accept this payment.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (payment) => {
    setBusy(true);
    setError("");
    try {
      const { payment: saved, event: changed } = await rejectTournamentPayment(payment.id);
      applySaved(saved);
      if (changed && setEvents) {
        setEvents((previous) => previous.map((entry) => (String(entry.id) === String(changed.id) ? { ...entry, ...changed } : entry)));
      }
      log(
        "Rejected tournament payment",
        `${saved.participant} was taken off ${whatFor}: the ${formatPeso(saved.amount)} entry fee could not be found in GCash. It is listed to send back to ${formatPayer(saved)}.`,
        "reject"
      );
      addNotification({ message: `${saved.participant} was taken off ${event.name}. Send the ${formatPeso(saved.amount)} back.` });
      setReviewId(null);
    } catch (rejectError) {
      setError(rejectError.message || "Unable to reject this payment.");
    } finally {
      setBusy(false);
    }
  };

  const finishRefund = (saved) => {
    applySaved(saved);
    log(
      "Sent back tournament payment",
      `${saved.participant}'s ${formatPeso(saved.amount)} entry fee for ${whatFor} went back to ${formatPayer(saved)}. ${describeRefund(saved)}`
    );
    addNotification({ message: `${saved.customerName}'s ${formatPeso(saved.amount)} is marked as sent back.` });
    setRefundId(null);
  };

  return (
    <div className={`tourna-payments ${className}`.trim()}>
      <span className={labelClassName}>{heading}</span>
      <ul className="pay-list">
        {list.map((payment) => {
          const action = ACTIONS[payment.status] || { label: "View", icon: "bi-receipt", className: "" };
          return (
            <li key={payment.id} className="pay-list-item">
              <div className="pay-list-who">
                <strong>{payment.participant || payment.customerName}</strong>
                <span>
                  {formatPeso(payment.amount)} from {formatPayer(payment) || "an unknown number"}
                </span>
              </div>
              <PaymentStatusChip payment={payment} short />
              <button type="button" className={`pay-list-btn ${action.className}`} onClick={() => open(payment)}>
                <i className={`bi ${action.icon}`} aria-hidden="true"></i>
                {action.label}
              </button>
            </li>
          );
        })}
      </ul>

      {reviewing && (
        <PaymentReviewModal
          key={reviewing.id}
          payment={reviewing}
          lines={[
            ["Player", reviewing.participant || reviewing.customerName],
            ["Tournament", whatFor],
            ["Contact", reviewing.phone || "Not given"],
          ]}
          busy={busy}
          error={error}
          rejectText="Use this when the entry fee cannot be found. The player is taken off the tournament and the fee is listed to send back."
          onAccept={accept}
          onReject={reject}
          onRefund={(payment) => {
            setReviewId(null);
            setRefundId(payment.id);
          }}
          onClose={() => setReviewId(null)}
        />
      )}

      {refunding && (
        <RefundModal
          key={refunding.id}
          payment={refunding}
          forWhat={`${refunding.participant} in ${whatFor}`}
          onDone={finishRefund}
          onClose={() => setRefundId(null)}
        />
      )}
    </div>
  );
}
