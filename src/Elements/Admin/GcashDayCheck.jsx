import { useEffect, useState } from "react";
import PaymentStatusChip from "../Global/PaymentStatusChip";
import Pagination from "../Global/Pagination";
import usePagination from "../Global/usePagination";
import { fetchGcashDay } from "../../utils/paymentsApi";
import { formatPayer, formatPeso } from "../../utils/onlinePayments";
import { dayInManila } from "../../utils/siteSettings";

// Read once when the report opens, never while rendering.
const todayInManila = () => dayInManila(Date.now());

// "2026-10-19" moved by `days` (the calendar day, whatever the time zone).
const shiftDay = (day, days) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatClock = (ms) =>
  ms ? new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }) : "—";

const sumOf = (payments) => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

// What a payment was for.
const PAID_FOR = {
  pos: "Sale at the counter",
  reservation: "Table booking (website)",
  tournament: "Tournament entry fee (website)",
};

const nameOf = (payment) => payment.participant || payment.customerName;

/**
 * One day's GCash, to tick off against the history in the Break & Chill GCash
 * app: what came in (counter sales, and website payments whatever became of
 * them) and what was sent back by GCash. Read from the server, so every
 * device's counter sales are in it. The day steps back and forward with the
 * arrows; each list is 10 a page, with the day's total under it.
 */
export default function GcashDayCheck() {
  const [day, setDay] = useState(todayInManila);
  const [maxDay] = useState(todayInManila);
  // Bumped by Refresh to read the same day again.
  const [asked, setAsked] = useState(0);
  const [result, setResult] = useState({ day: null, asked: -1, data: null, error: "" });

  useEffect(() => {
    let active = true;
    fetchGcashDay(day)
      .then((data) => {
        if (active) setResult({ day, asked, data, error: "" });
      })
      .catch((error) => {
        if (active) setResult({ day, asked, data: null, error: error.message || "Unable to load that day's GCash payments." });
      });
    return () => {
      active = false;
    };
  }, [day, asked]);

  const loading = result.day !== day || result.asked !== asked;
  // The day's list stays on screen while the same day is read again.
  const shown = result.day === day ? result.data : null;
  const received = shown?.received || [];
  const sentBack = shown?.sentBack || [];
  const totalIn = sumOf(received);
  const totalOut = sumOf(sentBack);
  const receivedPages = usePagination(received, undefined, 1, day);
  const sentBackPages = usePagination(sentBack, undefined, 1, day);
  const totalLabel = (pages) => (pages.pageCount > 1 ? `Total (all ${pages.total})` : "Total");

  const stats = [
    { label: `Received (${received.length})`, value: formatPeso(totalIn), icon: "bi-box-arrow-in-down", tone: "green" },
    { label: `Sent back by GCash (${sentBack.length})`, value: formatPeso(totalOut), icon: "bi-arrow-counterclockwise", tone: "yellow" },
    { label: "Net for the day", value: formatPeso(totalIn - totalOut), icon: "bi-phone", tone: "blue" },
  ];

  const emptyNote = (text) => <p className="reports-empty-note">{loading && !shown ? "Loading..." : text}</p>;

  return (
    <div className="gcash-check">
      <div className="reports-toolbar gcash-check-toolbar">
        <div className="reports-toolbar-fields">
          <div>
            <label className="reports-toolbar-label" htmlFor="gcash-check-day">Day</label>
            <div className="gcash-check-day">
              <button type="button" className="gcash-check-step" onClick={() => setDay(shiftDay(day, -1))} aria-label="Day before">
                <i className="bi bi-chevron-left" aria-hidden="true"></i>
              </button>
              <input
                id="gcash-check-day"
                type="date"
                className="reports-toolbar-select"
                value={day}
                max={maxDay}
                onChange={(event) => event.target.value && setDay(event.target.value)}
              />
              <button
                type="button"
                className="gcash-check-step"
                onClick={() => setDay(shiftDay(day, 1))}
                disabled={day >= maxDay}
                aria-label="Day after"
              >
                <i className="bi bi-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
        <button type="button" className="reports-export-btn" onClick={() => setAsked((count) => count + 1)} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          {loading ? "Loading..." : "Refresh"}
        </button>
        <p className="gcash-check-note">
          <i className="bi bi-info-circle" aria-hidden="true"></i>
          <span>
            Open the history in the Break &amp; Chill GCash app for this day and tick each one off. A payment in the app
            that is not here, or one here that is not in the app, needs a look.
          </span>
        </p>
      </div>

      {result.error && result.day === day && !loading ? (
        <p className="gcash-check-error" role="alert">{result.error}</p>
      ) : (
        <>
          <div className="row g-3 mb-4">
            {stats.map((stat) => (
              <div className="col-md-4" key={stat.label}>
                <div className={`card reports-stat-card reports-stat-${stat.tone}`}>
                  <div className="card-body">
                    <i className={`bi ${stat.icon} reports-stat-icon`}></i>
                    <div className="reports-stat-value">{shown ? stat.value : "—"}</div>
                    <div className="reports-stat-label">{stat.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card reports-card mb-4">
            <div className="card-body">
              <div className="reports-card-title">Received ({received.length})</div>
              {received.length ? (
                <div className="table-responsive">
                  <table className="table reports-table sales-report-table gcash-check-table">
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">From</th>
                        <th scope="col">For</th>
                        <th scope="col">Reference</th>
                        <th scope="col" className="reports-num">Amount</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivedPages.items.map((payment) => (
                        <tr key={payment.id}>
                          <td className="sales-report-nowrap">{formatClock(payment.createdAt)}</td>
                          <td className="reports-table-name">
                            {nameOf(payment)}
                            {payment.kind !== "pos" && payment.payerNumber && (
                              <span className="gcash-check-sub">from {formatPayer(payment)}</span>
                            )}
                          </td>
                          <td>{PAID_FOR[payment.kind] || "Payment"}</td>
                          <td className="gcash-check-ref">{payment.reference}</td>
                          <td className="reports-num reports-table-price">{formatPeso(payment.amount)}</td>
                          <td className="sales-report-nowrap">
                            {payment.kind === "pos" ? (
                              <span className="gcash-check-taken">Taken by {payment.decidedBy || "staff"}</span>
                            ) : (
                              <PaymentStatusChip payment={payment} short />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={4}>{totalLabel(receivedPages)}</th>
                        <td className="reports-num">{formatPeso(totalIn)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                emptyNote("No GCash came in on this day.")
              )}
              <Pagination {...receivedPages} />
            </div>
          </div>

          <div className="card reports-card">
            <div className="card-body">
              <div className="reports-card-title">Sent back by GCash ({sentBack.length})</div>
              {sentBack.length ? (
                <div className="table-responsive">
                  <table className="table reports-table sales-report-table gcash-check-table">
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">To</th>
                        <th scope="col">For</th>
                        <th scope="col">Refund reference</th>
                        <th scope="col" className="reports-num">Amount</th>
                        <th scope="col">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentBackPages.items.map((payment) => (
                        <tr key={payment.id}>
                          <td className="sales-report-nowrap">{formatClock(payment.refundedAt)}</td>
                          <td className="reports-table-name">
                            {nameOf(payment)}
                            <span className="gcash-check-sub">{formatPayer(payment)}</span>
                          </td>
                          <td>{PAID_FOR[payment.kind] || "Payment"}</td>
                          <td className="gcash-check-ref">{payment.refundReference}</td>
                          <td className="reports-num reports-table-price">{formatPeso(payment.amount)}</td>
                          <td>{payment.refundedBy || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={4}>{totalLabel(sentBackPages)}</th>
                        <td className="reports-num">{formatPeso(totalOut)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                emptyNote("Nothing was sent back by GCash on this day.")
              )}
              <Pagination {...sentBackPages} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
