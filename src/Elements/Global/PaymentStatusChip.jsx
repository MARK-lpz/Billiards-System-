import "../../styles/OnlinePayments.css";
import { paymentState } from "../../utils/onlinePayments";

/** Where a website GCash payment stands: held, accepted, to send back, or sent back. */
export default function PaymentStatusChip({ payment, short = false }) {
  const state = paymentState(payment);
  if (!state) return null;

  return (
    <span className={`pay-chip pay-chip--${state.tone}`}>
      <i className={`bi ${state.icon}`} aria-hidden="true"></i>
      {short ? state.short : state.label}
    </span>
  );
}
