import { useEffect, useState } from "react";
import "../../styles/Admin/CartPanel.css";
import ConfirmDialog from "../Global/ConfirmDialog";
import { useNotifications } from "../Global/useNotifications";
import { appendAuditLog } from "../../utils/audit";
import { addMissingOnlineSales, fetchMissingOnlineSales } from "../../utils/paymentsApi";
import { MONTHS, formatPesoAmount as peso } from "../../utils/salesReport";

const monthLabel = (month) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/**
 * Website GCash payments the hall kept used to stay out of the sales. This shows
 * the ones still missing, month by month, and adds them once the admin has looked
 * (config/online_sales.php). A sale cannot be edited afterwards, so nothing is
 * added on its own. Running it again adds nothing twice. Hidden when none are missing.
 */
export default function MissingOnlineSales({ setLogs }) {
  const { showToast } = useNotifications();
  const [missing, setMissing] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchMissingOnlineSales()
      .then((found) => {
        if (active) setMissing(found);
      })
      .catch((failure) => console.warn("Unable to check the past online payments", failure));
    return () => {
      active = false;
    };
  }, []);

  if (!missing?.count) return null;

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const added = await addMissingOnlineSales();
      appendAuditLog(setLogs, {
        type: "sale",
        staff: "Admin",
        action: "Added past online payments to Sales",
        detail: `${added} past online ${added === 1 ? "payment" : "payments"} added to the sales, ${peso(missing.total)} in all.`,
      });
      showToast({ icon: "bi-check-circle", title: "Added to Sales", message: `${added} past online ${added === 1 ? "payment is" : "payments are"} in the Sales Report now.` });
      setOpen(false);
      setMissing(await fetchMissingOnlineSales());
    } catch (failure) {
      setError(failure.message || "Unable to add those sales. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="missing-sales" role="status">
        <i className="bi bi-info-circle" aria-hidden="true"></i>
        <span>
          <strong>
            {missing.count} past online {missing.count === 1 ? "payment is" : "payments are"} not in the sales yet
          </strong>{" "}
          ({peso(missing.total)}).
        </span>
        <button type="button" className="reports-export-btn" onClick={() => setOpen(true)}>
          Review
        </button>
      </div>

      {open && (
        <ConfirmDialog
          title="Add past online payments to Sales?"
          icon="bi-cash-stack"
          message="These website GCash payments were kept by the hall but never counted as sales."
          detail="Each goes in the month it was accepted, so those months' totals will change. A sale cannot be edited afterwards."
          confirmLabel={busy ? "Adding..." : `Add ${missing.count} to Sales`}
          cancelLabel="Not Now"
          confirmClassName="btn-success"
          confirmDisabled={busy}
          onConfirm={add}
          onClose={() => setOpen(false)}
        >
          <div className="payment-review-summary">
            {missing.months.map((entry) => (
              <div className="payment-review-row" key={entry.month}>
                <span>
                  {monthLabel(entry.month)} · {entry.count} {entry.count === 1 ? "payment" : "payments"}
                </span>
                <strong>{peso(entry.total)}</strong>
              </div>
            ))}
            <div className="payment-review-total">
              <span>Total</span>
              <strong>{peso(missing.total)}</strong>
            </div>
          </div>
          {error && (
            <p className="payment-field-error" role="alert">
              {error}
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
