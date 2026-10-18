import { formatHoursLabel } from "../../utils/reservations";
import { formatClockTime } from "../../utils/tableCharges";
import { findChargeBill } from "../../utils/posBills";
import { countOrderItems, getUnpaidOrderLines } from "../../utils/tableOrders";

const fmtPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// "Incl. ₱85.00 ordered at the table (2 items)", counting only what is still to pay.
const OrdersNote = ({ charge }) => {
  const count = countOrderItems(getUnpaidOrderLines(charge.orders || []));
  const due = charge.ordersDue ?? charge.ordersTotal;
  return due > 0 ? (
    <div className="table-bill-meta">
      Incl. {fmtPeso(due)} ordered at the table ({count} {count === 1 ? "item" : "items"})
    </div>
  ) : null;
};

/**
 * Table bills to pay here: sessions that ended from a booking, and tables still
 * playing whose customer wants to pay now and keep playing. Add to Bill puts one
 * on the Running Bill, so table time and food are paid together, on one receipt.
 * Another table's Running Bill is paid first, so each table keeps its own
 * receipt; tables paying together are joined in End Session at Pool Tables.
 */
export default function TableBillsPanel({
  charges = [],
  liveBills = [],
  bills = [],
  activeBill = null,
  onAddToBill,
  onAddLive,
}) {
  const count = [charges.length ? `${charges.length} waiting` : "", liveBills.length ? `${liveBills.length} playing` : ""]
    .filter(Boolean)
    .join(" · ");

  const describeDestination = (chargeId, tableId) => {
    const chargeBill = findChargeBill(bills, chargeId);
    if (chargeBill) {
      return {
        chargeBill,
        text: chargeBill.id === activeBill?.id ? "On the Running Bill" : `On a saved bill (${chargeBill.label})`,
      };
    }
    if (!activeBill || !activeBill.cart.length) return { text: "Starts the Running Bill" };
    if (activeBill.tableId === null || String(activeBill.tableId) === String(tableId)) {
      return { text: "Adds to the Running Bill" };
    }
    return { blocked: true, text: `Pay ${activeBill.label} first` };
  };

  const renderSide = (amount, { chargeBill, blocked }, onAdd) => (
    <div className="table-bill-side">
      <strong className="table-bill-amount">{fmtPeso(amount)}</strong>
      <button
        type="button"
        className="table-bill-btn"
        onClick={onAdd}
        disabled={Boolean(chargeBill) || blocked}
        title={blocked ? "Each table gets its own receipt. To pay tables together, join them in End Session at Pool Tables." : undefined}
      >
        <i className={`bi ${chargeBill ? "bi-check2" : "bi-plus-lg"}`}></i>
        {chargeBill ? "On Bill" : "Add to Bill"}
      </button>
    </div>
  );

  const renderDestination = ({ chargeBill, blocked, text }) => (
    <div className={`table-bill-destination ${blocked ? "is-blocked" : ""}`}>
      <i className={`bi ${chargeBill ? "bi-check2-circle" : blocked ? "bi-hourglass-split" : "bi-arrow-return-right"}`}></i>
      {text}
    </div>
  );

  return (
    <div className="table-bills-panel">
      <div className="table-bills-header">
        <span>
          <i className="bi bi-grid-3x3-gap-fill"></i>
          Pool Table Bills
        </span>
        <span className={`table-bills-count ${count ? "has-bills" : ""}`}>{count || "None waiting"}</span>
      </div>

      {charges.length === 0 && liveBills.length === 0 ? (
        <p className="table-bills-empty">
          Tables still playing, and sessions ended from a booking, show up here to be paid.
        </p>
      ) : (
        <div className="table-bills-list">
          {charges.map((charge) => {
            const destination = describeDestination(charge.id, charge.tableId);
            return (
              <div key={charge.id} className={`table-bill-card ${destination.chargeBill ? "on-bill" : ""}`}>
                <div className="table-bill-main">
                  <div className="table-bill-title">
                    <strong>{charge.tableName}</strong>
                    <span>{charge.customer}</span>
                  </div>
                  <div className="table-bill-meta">
                    {formatHoursLabel(charge.bookedMinutes)} · {formatClockTime(charge.startTime)} -{" "}
                    {formatClockTime(charge.endTime)}
                  </div>
                  {charge.prepaid && (
                    <div className="table-bill-prepaid">
                      {fmtPeso(charge.prepaid.amount)} already paid online · only the added time
                      {charge.ordersTotal > 0 ? " and orders are" : " is"} due
                    </div>
                  )}
                  {charge.paidEarlier > 0 && (
                    <div className="table-bill-prepaid">{fmtPeso(charge.paidEarlier)} paid while playing</div>
                  )}
                  <OrdersNote charge={charge} />
                  {renderDestination(destination)}
                </div>
                {renderSide(charge.amountDue, destination, () => onAddToBill(charge))}
              </div>
            );
          })}

          {liveBills.map(({ chargeId, table, charge }) => {
            const destination = describeDestination(chargeId, table.id);
            const endsAt = Number(table.startTime) + charge.bookedMinutes * 60000;
            return (
              <div key={chargeId} className={`table-bill-card is-live ${destination.chargeBill ? "on-bill" : ""}`}>
                <div className="table-bill-main">
                  <div className="table-bill-title">
                    <strong>{charge.tableName}</strong>
                    <span>{charge.customer}</span>
                    <span className="table-bill-live">Still playing</span>
                  </div>
                  <div className="table-bill-meta">
                    {formatHoursLabel(charge.bookedMinutes)} · {formatClockTime(charge.startTime)} -{" "}
                    {formatClockTime(endsAt)} · pays now, keeps playing
                  </div>
                  {charge.prepaid && (
                    <div className="table-bill-prepaid">{fmtPeso(charge.prepaid.amount)} already paid online</div>
                  )}
                  {charge.paidEarlier > 0 && (
                    <div className="table-bill-prepaid">
                      {fmtPeso(charge.paidEarlier)} paid earlier · only what was added since is due
                    </div>
                  )}
                  <OrdersNote charge={charge} />
                  {renderDestination(destination)}
                </div>
                {renderSide(charge.amountDue, destination, () => onAddLive(table))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
