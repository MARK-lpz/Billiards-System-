import { useEffect, useState } from "react";
import Pagination from "../Global/Pagination";
import { fetchEquipmentHistory } from "../../utils/equipmentApi";
import { EQUIPMENT_HISTORY_RETENTION_MONTHS, EQUIPMENT_STATUS_LABELS } from "../../utils/equipment";
import { formatReportDate } from "../../utils/issues";

const PAGE_SIZE = 15;

const SHOWN = [
  { value: "", label: "Everything" },
  { value: "deleted", label: "Deleted" },
  { value: "replaced", label: "Replaced" },
];

// "For replacement · Damaged": what the item was like when it was taken off.
const describeState = (entry) =>
  [EQUIPMENT_STATUS_LABELS[entry.status] || entry.status, entry.condition === "damaged" ? "Damaged" : ""]
    .filter(Boolean)
    .join(" · ");

/**
 * Removed: equipment deleted (with the reason) or replaced, newest first, kept
 * by the server for a set number of months. `refreshKey` changes whenever an
 * item is deleted or replaced here, so the list reloads.
 */
export default function EquipmentHistory({ refreshKey, onTotal }) {
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState("");
  const [attempt, setAttempt] = useState(0);
  // { key, status: "done" | "error", history } for the latest request answered.
  const [result, setResult] = useState(null);

  const requestKey = `${refreshKey}:${attempt}`;

  useEffect(() => {
    let cancelled = false;
    fetchEquipmentHistory()
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, status: "done", history: data.history });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, status: "error", history: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const history = result?.history || [];
  const total = result?.status === "done" ? history.length : null;

  useEffect(() => {
    if (total !== null) onTotal?.(total);
  }, [total, onTotal]);

  const matching = shown ? history.filter((entry) => entry.action === shown) : history;
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const shownPage = Math.min(page, pageCount);
  const rows = matching.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE);
  const loading = !result || result.key !== requestKey;

  return (
    <div className="report-history equipment-history">
      <p className="equipment-retention-note">
        <i className="bi bi-info-circle" aria-hidden="true"></i>
        Deleted and replaced equipment stays here for {EQUIPMENT_HISTORY_RETENTION_MONTHS} months, then is removed
        automatically.
      </p>

      <div className="report-history-filters">
        <label>
          <span>Show</span>
          <select
            className="report-history-select"
            value={shown}
            onChange={(event) => {
              setShown(event.target.value);
              setPage(1);
            }}
            aria-label="Show deleted or replaced equipment"
          >
            {SHOWN.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {loading && result && (
          <span className="report-history-loading" role="status">
            <i className="bi bi-arrow-repeat"></i> Updating…
          </span>
        )}
      </div>

      {result?.status === "error" ? (
        <p className="report-history-offline" role="status">
          <i className="bi bi-wifi-off" aria-hidden="true"></i>
          Couldn&apos;t reach the server to load the removed equipment.
          <button type="button" className="report-history-clear" onClick={() => setAttempt((count) => count + 1)}>
            <i className="bi bi-arrow-clockwise"></i> Try again
          </button>
        </p>
      ) : !result ? (
        <div className="reported-issues-empty">
          <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
          <strong>Loading removed equipment…</strong>
        </div>
      ) : matching.length === 0 ? (
        <div className="reported-issues-empty">
          <i className="bi bi-archive" aria-hidden="true"></i>
          <strong>{shown ? `Nothing ${shown} in the last ${EQUIPMENT_HISTORY_RETENTION_MONTHS} months` : "No equipment removed"}</strong>
          <span>Equipment you delete or replace is listed here for {EQUIPMENT_HISTORY_RETENTION_MONTHS} months.</span>
        </div>
      ) : (
        <>
          <table className="report-history-table">
            <thead>
              <tr>
                <th scope="col">Removed</th>
                <th scope="col">Item</th>
                <th scope="col">Table</th>
                <th scope="col">What happened</th>
                <th scope="col">It was</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Removed">
                    <strong>{formatReportDate(entry.createdAt) || "—"}</strong>
                    {entry.doneBy && <small>by {entry.doneBy}</small>}
                  </td>
                  <td data-label="Item" className="report-history-report">
                    <strong>{entry.name}</strong>
                    <small>{entry.type || "Equipment"}</small>
                  </td>
                  <td data-label="Table">
                    {entry.tableName || "Unassigned"}
                    {entry.spare && <small>{entry.tableName ? "Spare" : "Spare at the counter"}</small>}
                  </td>
                  <td data-label="What happened">
                    <span className={`equipment-history-action equipment-history-action--${entry.action}`}>
                      {entry.action === "replaced" ? "Replaced" : "Deleted"}
                    </span>
                    <small>{entry.action === "replaced" ? `by ${entry.replacedBy}` : entry.reason}</small>
                  </td>
                  <td data-label="It was">{describeState(entry) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={shownPage}
            pageCount={pageCount}
            pageStart={(shownPage - 1) * PAGE_SIZE}
            pageSize={PAGE_SIZE}
            total={matching.length}
            goToPage={(next) => setPage(Math.max(1, Math.min(next, pageCount)))}
          />
        </>
      )}
    </div>
  );
}
