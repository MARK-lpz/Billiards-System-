import { useState } from "react";
import "../../styles/Admin/SalesPOS.css";
import "../../styles/Admin/CartPanel.css";
import EndSessionModal from "./EndSessionModal";
import PaymentConfirmationModal from "./PaymentConfirmationModal";
import ReceiptModal from "./ReceiptModal";
import { nowStr, todayStr } from "./salesPosConfig";
import { useNotifications } from "../Global/useNotifications";
import { appendAuditLog } from "../../utils/audit";
import { saveTableReservationStatus } from "../../utils/reservationApi";
import { formatPeso } from "../../utils/tableSession";
import { countOrderItems } from "../../utils/tableOrders";
import {
  ENDED_SESSION_FIELDS,
  createTableCharge,
  createTableSale,
  describeEndedCharge,
  recordTablePayment,
  toChargeOrderLines,
  toLiveTableLines,
  toTableChargeLine,
} from "../../utils/tableCharges";

// Read only from click handlers, never while rendering.
const getCurrentTimestamp = () => Date.now();

const roundPeso = (value) => Math.round(value * 100) / 100;

const sameSession = (table, tableId, startTime) =>
  table.id === tableId && table.status === "occupied" && table.startTime === startTime;

/**
 * Ends a table session and takes its payment on the spot: the bill (table time
 * and the table's orders), then cash or GCash, then the receipt. Nothing goes
 * to Sales / POS; the sale is recorded like one paid there.
 *
 * Other tables can join the receipt when the customers pay together. Each one
 * either ends too, or keeps playing with its bill so far paid (as paying in
 * Sales / POS while playing would).
 *
 * `checkout` is { tableId, startTime, at }: the session being ended and when End
 * Session was pressed, which is the time the bill is worked out for.
 */
export default function TableCheckout({
  checkout,
  tables = [],
  setTables,
  reservations = [],
  setReservations,
  tableCharges = [],
  setTableCharges,
  transactions = [],
  setTransactions,
  setLogs,
  cashierLabel,
  onClose,
}) {
  const { addNotification, showToast } = useNotifications();
  const [method, setMethod] = useState("cash");
  const [step, setStep] = useState("review");
  const [receipt, setReceipt] = useState(null);
  // Tables joined to this receipt: { tableId, startTime, mode: "end" | "keep" }.
  const [joined, setJoined] = useState([]);

  // The same session only: if the other counter ended it meanwhile, there is
  // nothing left to end here.
  const findSession = () => tables.find((table) => sameSession(table, checkout.tableId, checkout.startTime)) || null;
  const chargeFor = (table) =>
    createTableCharge({ table, reservations, tableCharges, endedBy: cashierLabel, now: checkout.at });
  // Each joined table as it is now; one ended elsewhere meanwhile has no table.
  const joinedNow = () =>
    joined.map((entry) => ({
      ...entry,
      table: tables.find((table) => sameSession(table, entry.tableId, entry.startTime)) || null,
    }));

  if (receipt) return <ReceiptModal receipt={receipt} onClose={onClose} />;

  const table = findSession();
  if (!table) return null;

  const tableName = table.name || `Table ${table.id}`;
  const charge = chargeFor(table);
  const joinedBills = joinedNow()
    .filter((entry) => entry.table)
    .map((entry) => ({ table: entry.table, charge: chargeFor(entry.table), mode: entry.mode }));
  // Other tables still playing that owe something, to join this receipt.
  const candidates = tables
    .filter(
      (entry) =>
        entry.status === "occupied" &&
        entry.startTime &&
        entry.id !== table.id &&
        !joined.some((join) => join.tableId === entry.id)
    )
    .map((entry) => ({ table: entry, charge: chargeFor(entry) }))
    .filter((entry) => entry.charge.amountDue > 0)
    .sort((first, second) => Number(first.table.id) - Number(second.table.id));
  const total = roundPeso(charge.amountDue + joinedBills.reduce((sum, entry) => sum + entry.charge.amountDue, 0));
  const usedReferences = transactions.map((tx) => tx.paymentDetails?.referenceNumber).filter(Boolean);
  const label = [tableName, ...joinedBills.map((entry) => entry.charge.tableName)].join(" + ");
  const billLabel = table.customer ? `${label} · ${table.customer}` : label;

  const join = (entry) =>
    setJoined((prev) => [...prev, { tableId: entry.id, startTime: entry.startTime, mode: "end" }]);
  const unjoin = (tableId) => setJoined((prev) => prev.filter((entry) => entry.tableId !== tableId));
  const setMode = (tableId, mode) =>
    setJoined((prev) => prev.map((entry) => (entry.tableId === tableId ? { ...entry, mode } : entry)));

  const finish = (paymentDetails = {}) => {
    const current = findSession();
    if (!current) {
      showToast({ tone: "error", icon: "bi-x-circle", title: "Already ended", message: `${tableName}'s session was ended at another counter.` });
      onClose();
      return;
    }
    // A joined table ended at another counter meanwhile: show the bill again without it.
    const others = joinedNow();
    const gone = others.filter((entry) => !entry.table);
    if (gone.length) {
      setJoined((prev) => prev.filter((entry) => !gone.some((left) => left.tableId === entry.tableId)));
      setStep("review");
      showToast({
        tone: "error",
        icon: "bi-x-circle",
        title: "Bill changed",
        message: "A joined table's session was ended at another counter, so it was taken off this bill. Check the total again.",
      });
      return;
    }

    const ending = [current, ...others.filter((entry) => entry.mode === "end").map((entry) => entry.table)];
    const playing = others.filter((entry) => entry.mode === "keep").map((entry) => ({ table: entry.table, charge: chargeFor(entry.table) }));
    const endedCharges = ending.map(chargeFor);
    const amount = roundPeso([...endedCharges, ...playing.map((entry) => entry.charge)].reduce((sum, entry) => sum + entry.amountDue, 0));
    const txId = getCurrentTimestamp();

    setTables((prev) =>
      prev.map((entry) => {
        if (ending.some((done) => sameSession(entry, done.id, done.startTime))) return { ...entry, ...ENDED_SESSION_FIELDS };
        const keep = playing.find((live) => sameSession(entry, live.table.id, live.table.startTime));
        return keep
          ? recordTablePayment(entry, { charge: keep.charge, transactionId: txId, method, at: txId, by: cashierLabel })
          : entry;
      })
    );
    ending.forEach((done) =>
      saveTableReservationStatus({ table: done, reservations, setReservations, from: ["seated"], status: "completed" })
    );

    // Paid already (online, or in Sales / POS while playing): nothing to collect,
    // but the customer still gets the receipt for the whole session. It records
    // no new sale; the payments were recorded when they were made.
    if (amount <= 0) {
      const [ended] = endedCharges;
      setTableCharges?.((prev) => [ended, ...prev]);
      appendAuditLog(setLogs, {
        type: "table",
        staff: cashierLabel,
        action: "Ended session",
        detail: `Ended session for ${tableName}, already paid ${
          ended.paidEarlier > 0 ? `while playing (${formatPeso(ended.paidEarlier)})` : `online (${formatPeso(ended.sessionTotal)})`
        }`,
        entity: "table",
        table: { id: current.id, name: tableName, previousStatus: "occupied", currentStatus: "available" },
      });
      addNotification({ message: describeEndedCharge(ended) });
      setReceipt({
        ...createTableSale({ charge: ended, method: null, cashier: cashierLabel, id: txId, date: todayStr(), time: nowStr() }),
        sessionOnly: true,
      });
      return;
    }

    const paidAt = new Date(txId).toISOString();
    const paidCharges = endedCharges.map((entry) => ({
      ...entry,
      status: "paid",
      paidVia: entry.amountDue > 0 ? method : entry.paidVia,
      paidAt,
      paidBy: cashierLabel,
      transactionId: txId,
    }));
    const sale = createTableSale({
      charges: paidCharges,
      live: playing,
      method,
      paymentDetails,
      cashier: cashierLabel,
      id: txId,
      date: todayStr(),
      time: nowStr(),
    });
    const methodLabel = method === "cash" ? "cash" : "GCash";
    const orderedCount = [...paidCharges, ...playing.map((entry) => entry.charge)].reduce(
      (sum, entry) => sum + countOrderItems(entry.orders),
      0
    );
    const ordered = orderedCount ? ` and ${orderedCount} ordered ${orderedCount === 1 ? "item" : "items"}` : "";
    const joinedNote = others.length
      ? ` (joined: ${others.map((entry) => `${entry.table.name} ${entry.mode === "end" ? "ended" : "keeps playing"}`).join(", ")})`
      : "";

    setTableCharges?.((prev) => [...paidCharges, ...prev]);
    setTransactions?.((prev) => [sale, ...prev]);
    appendAuditLog(setLogs, {
      type: "sale",
      staff: cashierLabel,
      action: "Processed sale",
      detail: `${sale.billLabel}: table time${ordered} paid via ${methodLabel} for ${formatPeso(sale.total)} when the session ended${joinedNote}`,
      entity: "payment",
      payment: { transactionId: txId, total: sale.total, subtotal: sale.subtotal, discount: 0, method, ...paymentDetails },
      table: { id: current.id, name: tableName, previousStatus: "occupied", currentStatus: "available" },
    });
    addNotification({
      message: `${cashierLabel} ended ${ending.map((done) => done.name).join(", ")}${
        playing.length ? ` and took ${playing.map((entry) => entry.table.name).join(", ")}'s bill so far` : ""
      }: ${formatPeso(sale.total)} by ${methodLabel}.`,
    });
    setReceipt(sale);
  };

  if (step === "pay") {
    return (
      <PaymentConfirmationModal
        cart={[
          toTableChargeLine(charge),
          ...toChargeOrderLines(charge),
          ...joinedBills.flatMap((entry) =>
            entry.mode === "end"
              ? [toTableChargeLine(entry.charge), ...toChargeOrderLines(entry.charge)]
              : toLiveTableLines(entry.table, entry.charge)
          ),
        ]}
        total={total}
        method={method}
        billLabel={billLabel}
        usedReferences={usedReferences}
        onCancel={() => setStep("review")}
        onConfirm={finish}
      />
    );
  }

  return (
    <EndSessionModal
      table={table}
      charge={charge}
      joined={joinedBills}
      candidates={candidates}
      total={total}
      method={method}
      onMethodChange={setMethod}
      onJoin={join}
      onUnjoin={unjoin}
      onModeChange={setMode}
      onClose={onClose}
      onContinue={() => (total > 0 ? setStep("pay") : finish())}
    />
  );
}
