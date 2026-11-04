import "../../styles/TournamentFees.css";
import { formatPeso } from "../../utils/onlinePayments";
import { summarizeEntryFees } from "../../utils/tournamentFees";

/**
 * A paid tournament's entry fees in one line, for the admin's Events and the
 * front desk's Tournament Schedule: what was collected and how, and how many
 * players still owe it or wait for their GCash to be checked.
 */
export default function EntryFeeSummary({ event, payments = [], className = "" }) {
  const summary = summarizeEntryFees(event, payments);
  const ways = [
    ["Cash", summary.byMethod.cash],
    ["GCash", summary.byMethod.gcash],
    ["GCash online", summary.byMethod.online],
  ].filter(([, amount]) => amount > 0);

  return (
    <p className={`fee-summary ${className}`.trim()}>
      <span className="fee-summary-collected">
        <i className="bi bi-cash-stack" aria-hidden="true"></i>
        Collected <strong>{formatPeso(summary.collected)}</strong>
        {ways.length > 0 && ` (${ways.map(([label, amount]) => `${label} ${formatPeso(amount)}`).join(" · ")})`}
      </span>
      {summary.unpaid > 0 && <span className="fee-chip tone-red">{summary.unpaid} unpaid</span>}
      {summary.check > 0 && <span className="fee-chip tone-amber">{summary.check} to check</span>}
      {summary.refund > 0 && <span className="fee-chip tone-red">{summary.refund} refund due</span>}
      {summary.unpaid === 0 && summary.check === 0 && summary.paid > 0 && (
        <span className="fee-chip tone-green">Everyone paid</span>
      )}
    </p>
  );
}
