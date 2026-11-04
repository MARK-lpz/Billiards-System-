import "../../styles/OnlinePayments.css";
import { deskPaymentState } from "../../utils/bookingPayments";
import { paymentState } from "../../utils/onlinePayments";

/**
 * Where a website GCash `payment` stands: held, accepted, to send back, or sent
 * back. Or, for a `booking` paid at the desk, how it was paid and if it went back.
 */
export default function PaymentStatusChip({ payment = null, booking = null, short = false }) {
  const state = paymentState(payment) || deskPaymentState(booking);
  if (!state) return null;

  return (
    <span className={`pay-chip pay-chip--${state.tone}`}>
      <i className={`bi ${state.icon}`} aria-hidden="true"></i>
      {short ? state.short : state.label}
    </span>
  );
}
