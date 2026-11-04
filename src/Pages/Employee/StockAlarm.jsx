import { useState } from "react";
import "../../styles/Employee/StockAlarm.css";
import DashboardStatCards from "../../Elements/Global/DashboardStatCards";
import { useNotifications } from "../../Elements/Global/useNotifications";
import {
  NEW_PRODUCT_DAYS,
  addedAtOf,
  describeStockReport,
  getStockHeadline,
  shelfStateOf,
  stockAlarmKey,
} from "../../utils/productShelf";
import { EXPIRY_ALERT_DAYS, daysUntil, describeDaysLeft } from "../../utils/expiryAlerts";
import { formatExpiryDate } from "../../utils/inventoryValidation";
import { markMatches, searchInventory } from "../../utils/inventorySearch";
import { formatPeso } from "../../utils/tableSession";
import { appendAuditLog } from "../../utils/audit";
import { sendNotice } from "../../utils/noticeApi";

const REPORTED_KEY = "reportedStockAlarms";
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const stockOf = (product) => Math.max(0, Number(product.stock) || 0);
const piecesOf = (product) => `${stockOf(product)} ${product.unit || "pcs"}`;
const formatAddedDay = (ms) => new Date(ms).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
const formatClock = (iso) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
// Read only from click handlers, never while rendering.
const getCurrentTimestamp = () => Date.now();

// One card per alarm, in the order they show. `steps`: what the front desk does about it.
const KINDS = {
  fresh: {
    label: "New products",
    icon: "bi-stars",
    hint: `Added by the admin in the last ${NEW_PRODUCT_DAYS} days. They are already in the Sales / POS.`,
    empty: `No new products in the last ${NEW_PRODUCT_DAYS} days.`,
    guide: "A new product",
    steps: ["Learn its price and where it is kept.", "It is already in the Sales / POS and table orders.", "Tell customers it is new."],
  },
  low: {
    label: "Low stock",
    icon: "bi-box-seam",
    hint: "Running out. Tell the admin so these get restocked.",
    empty: "Every product is above its minimum stock.",
    guide: "When stock runs low",
    steps: ["Check that the shelf count matches.", "Tell the admin before it runs out.", "When it is out, offer the customer something similar."],
  },
  soon: {
    label: "Expiring soon",
    icon: "bi-hourglass-split",
    hint: "Sell these first, before they expire.",
    empty: `Nothing expires within ${EXPIRY_ALERT_DAYS} days.`,
    guide: "When a product nears its date",
    steps: ["Put these at the front of the shelf.", "Offer them to customers first.", "Tell the admin if they will not sell in time."],
  },
  expired: {
    label: "Expired",
    icon: "bi-calendar-x",
    hint: "Past their expiry date: the POS will not sell them. Take them off the shelf and tell the admin.",
    empty: "Nothing on the shelf has expired.",
    guide: "When a product expires",
    steps: [
      "Take every piece off the shelf and set it aside.",
      "Do not sell it: the POS and table orders refuse it anyway.",
      "Tell the admin, who removes the expired stock or restocks it.",
    ],
  },
};

// The stock list's filters, each by where a product stands (shelfStateOf).
const LIST_FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "low", label: "Low / out" },
  { id: "soon", label: "Expiring soon" },
  { id: "expired", label: "Expired" },
];

const STATES = {
  expired: { label: "Expired · Do not sell", tone: "danger" },
  out: { label: "Out of stock", tone: "danger" },
  low: { label: "Low stock", tone: "warning" },
  soon: { label: "Expiring soon", tone: "warning" },
  ok: { label: "In stock", tone: "ok" },
};

// The first list worth opening: something expired, then low, then new, then expiring.
const firstTab = (alarm, isNew) =>
  (alarm.expired.length && "expired") ||
  (alarm.low.length && "low") ||
  (alarm.fresh.some((entry) => isNew("fresh", entry)) && "fresh") ||
  (alarm.soon.length && "soon") ||
  "fresh";

/** One line of an alarm list: what is wrong, its state, and what it is worth. */
const describe = (kind, entry) => {
  const { product } = entry;
  const worth = `${formatPeso(stockOf(product) * (Number(product.price) || 0))} at retail`;
  if (kind === "expired") {
    return {
      detail: `Expired ${formatExpiryDate(product.expiryDate)} · ${piecesOf(product)} on the shelf · ${worth}`,
      state: { label: "Do not sell", tone: "danger" },
    };
  }
  if (kind === "low") {
    const out = entry.state === "out";
    return {
      detail: out ? "None left" : `${piecesOf(product)} left · alert at ${Number(product.minStock) || 0}`,
      state: out ? { label: "Out of stock", tone: "danger" } : { label: "Low stock", tone: "warning" },
      meter: out ? 0 : Math.min(100, (stockOf(product) / Math.max(Number(product.minStock) || 0, 1)) * 100),
    };
  }
  if (kind === "soon") {
    return {
      detail: `Expires ${formatExpiryDate(product.expiryDate)} · ${piecesOf(product)} · ${worth}`,
      state: { label: describeDaysLeft(entry.days), tone: "warning" },
    };
  }
  return {
    detail: `Added ${formatAddedDay(entry.addedAt)} · ${formatPeso(product.price)} each · ${piecesOf(product)}`,
    state: null,
  };
};

// The alarms told to the admin on this device: { alarm key: ISO time }.
const readReported = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(REPORTED_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
};

/**
 * The front desk's Stock Alarm (see useStockAlarm): new products, low stock,
 * products expiring soon and expired ones, a card each, with the picked card's
 * products under them and what to do about them. Low, expiring and expired
 * ones can be told to the admin (a notice in the admin's bell). Under all that,
 * every product on sale, searchable, with where it stands. `products`: the
 * products still in the Inventory. `initialTab`: the list the bell opened.
 */
export default function StockAlarm({ products = [], stockAlarm, setLogs, initialTab = null }) {
  const { showToast } = useNotifications();
  const { alarm, today, now, isNew, markKindSeen } = stockAlarm;
  const [tab, setTab] = useState(() => initialTab || firstTab(alarm, isNew));
  const [reported, setReported] = useState(readReported);
  const [sending, setSending] = useState(null);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState("all");

  const unseen = (kind) => alarm[kind].filter((entry) => isNew(kind, entry)).length;
  const outCount = alarm.low.filter((entry) => entry.state === "out").length;
  const freshUnseen = unseen("fresh");

  const stats = [
    {
      id: "fresh",
      tone: "blue",
      value: alarm.fresh.length,
      note: freshUnseen
        ? `${freshUnseen} not seen yet`
        : alarm.fresh.length
          ? `Latest: ${alarm.fresh[0].product.name}`
          : `None in ${NEW_PRODUCT_DAYS} days`,
    },
    {
      id: "low",
      tone: outCount ? "red" : alarm.low.length ? "amber" : "green",
      value: alarm.low.length,
      note: outCount ? `${plural(outCount, "product")} out of stock` : alarm.low.length ? "Running low" : "Everything is stocked",
    },
    {
      id: "soon",
      tone: alarm.soon.length ? "amber" : "green",
      value: alarm.soon.length,
      note: alarm.soon.length
        ? `Next: ${alarm.soon[0].product.name} (${describeDaysLeft(alarm.soon[0].days).toLowerCase()})`
        : `Nothing within ${EXPIRY_ALERT_DAYS} days`,
    },
    {
      id: "expired",
      tone: alarm.expired.length ? "red" : "green",
      value: alarm.expired.length,
      note: alarm.expired.length ? "Do not sell · take off the shelf" : "Nothing expired",
    },
  ].map((stat) => ({
    ...stat,
    page: { id: stat.id, label: KINDS[stat.id].label },
    icon: KINDS[stat.id].icon,
    label: KINDS[stat.id].label,
    title: `Show ${KINDS[stat.id].label.toLowerCase()}`,
  }));

  // The line over the cards: the most pressing thing, or that all is well.
  const headline = getStockHeadline(alarm, freshUnseen);

  // Tells the admin about one alarm, once: a notice in their bell, opening at the product.
  const report = async (kind, entry) => {
    const key = stockAlarmKey(kind, entry);
    const message = describeStockReport(kind, entry);
    setSending(key);
    try {
      await sendNotice({
        id: `stock-${getCurrentTimestamp()}-${entry.product.id}`,
        type: "stock-report",
        message,
        data: { productId: entry.product.id, kind },
      });
      const at = new Date(getCurrentTimestamp()).toISOString();
      setReported((previous) => {
        // Only the alarms still showing are kept.
        const showing = new Set(Object.keys(KINDS).flatMap((name) => alarm[name].map((item) => stockAlarmKey(name, item))));
        const next = Object.fromEntries(Object.entries({ ...previous, [key]: at }).filter(([name]) => showing.has(name)));
        try {
          localStorage.setItem(REPORTED_KEY, JSON.stringify(next));
        } catch {
          // Storage may be off (private window): it is only remembered until the page reloads.
        }
        return next;
      });
      appendAuditLog(setLogs, {
        type: "inventory",
        staff: "Employee",
        action: "Told the admin about stock",
        detail: message.replace(/^Front desk: /, ""),
        entity: "product",
        entityId: String(entry.product.id),
      });
      showToast({ icon: "bi-send-check", title: "Sent to the admin", message: `${entry.product.name}: the admin sees it in their bell.` });
    } catch (error) {
      showToast({ tone: "error", icon: "bi-x-circle", title: "Not sent", message: error.message || "Check the connection and try again." });
    } finally {
      setSending(null);
    }
  };

  const kind = KINDS[tab];
  const entries = alarm[tab];
  const tabUnseen = unseen(tab);

  // ---- Every product on sale.
  const newIds = new Set(alarm.fresh.map((entry) => entry.product.id));
  const stateOf = (product) => shelfStateOf(product, today);
  const filterMatches = {
    all: () => true,
    new: (product) => newIds.has(product.id),
    low: (product) => ["low", "out"].includes(stateOf(product)),
    soon: (product) => stateOf(product) === "soon",
    expired: (product) => stateOf(product) === "expired",
  };
  // The most pressing first, then by name.
  const ORDER = { expired: 0, out: 1, low: 2, soon: 3, ok: 4 };
  const sorted = [...products].sort(
    (first, second) => ORDER[stateOf(first)] - ORDER[stateOf(second)] || String(first.name).localeCompare(String(second.name))
  );
  const filtered = sorted.filter(filterMatches[listFilter]);
  const found = searchInventory(filtered, search, today);

  return (
    <div className="stock-module">
      <p className={`stock-alarm-headline is-${headline.tone}`} role="status">
        <i className={`bi ${headline.icon}`} aria-hidden="true"></i>
        {headline.text}
      </p>

      <DashboardStatCards stats={stats} label="Stock alarm" activeId={tab} onOpen={setTab} />

      <div className="stock-focus">
        <section className="stock-panel" aria-labelledby="stock-list-title">
          <div className="stock-panel-head">
            <p>
              <strong id="stock-list-title">
                <i className={`bi ${kind.icon}`} aria-hidden="true"></i>
                {kind.label}
                <span className="stock-panel-count">{entries.length}</span>
              </strong>
              <span>{kind.hint}</span>
            </p>
            {tabUnseen > 0 && (
              <button type="button" className="stock-ghost-btn" onClick={() => markKindSeen(tab)}>
                <i className="bi bi-check2-all" aria-hidden="true"></i>
                Mark {tabUnseen} as seen
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="stock-alarm-empty">
              <i className="bi bi-check-circle" aria-hidden="true"></i>
              {kind.empty}
            </p>
          ) : (
            <ul className="stock-alarm-list">
              {entries.map((entry) => {
                const { product } = entry;
                const { detail, state, meter } = describe(tab, entry);
                const key = stockAlarmKey(tab, entry);
                const sentAt = reported[key];
                return (
                  <li key={product.id} className={`stock-alarm-item is-${tab}`}>
                    <span className="stock-alarm-item-icon" aria-hidden="true">
                      <i className={`bi ${kind.icon}`}></i>
                    </span>
                    <span className="stock-alarm-item-text">
                      <span className="stock-alarm-item-name">
                        {product.name}
                        {product.productNumber && <span className="stock-alarm-item-no">#{product.productNumber}</span>}
                        {isNew(tab, entry) && <span className="stock-alarm-new">New</span>}
                      </span>
                      <span className="stock-alarm-item-meta">
                        {product.category ? `${product.category} · ` : ""}
                        {detail}
                      </span>
                      {meter !== undefined && (
                        <span className="stock-meter" aria-hidden="true">
                          <span style={{ width: `${meter}%` }}></span>
                        </span>
                      )}
                    </span>
                    <span className="stock-alarm-item-side">
                      {state && <span className={`stock-alarm-state is-${state.tone}`}>{state.label}</span>}
                      {tab !== "fresh" &&
                        (sentAt ? (
                          <span className="stock-reported" title="The admin has it in their bell">
                            <i className="bi bi-check2" aria-hidden="true"></i>
                            Told admin {formatClock(sentAt)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="stock-ghost-btn"
                            onClick={() => report(tab, entry)}
                            disabled={sending === key}
                          >
                            <i className="bi bi-send" aria-hidden="true"></i>
                            {sending === key ? "Sending…" : "Tell admin"}
                          </button>
                        ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="stock-panel stock-guide" aria-labelledby="stock-guide-title">
          <p className="stock-guide-title" id="stock-guide-title">
            <i className="bi bi-lightbulb" aria-hidden="true"></i>
            {kind.guide}
          </p>
          <ol>
            {kind.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </aside>
      </div>

      <section className="stock-panel stock-all" aria-labelledby="stock-all-title">
        <div className="stock-panel-head">
          <p>
            <strong id="stock-all-title">
              <i className="bi bi-list-ul" aria-hidden="true"></i>
              All products on sale
              <span className="stock-panel-count">{products.length}</span>
            </strong>
            <span>What the counter has, the most pressing first.</span>
          </p>
          <label className="stock-search">
            <i className="bi bi-search" aria-hidden="true"></i>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a product, #no. or category"
              aria-label="Search products"
            />
          </label>
        </div>

        <div className="stock-filters" role="group" aria-label="Show">
          {LIST_FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`stock-filter${listFilter === entry.id ? " is-active" : ""}`}
              aria-pressed={listFilter === entry.id}
              onClick={() => setListFilter(entry.id)}
            >
              {entry.label}
              <span>{sorted.filter(filterMatches[entry.id]).length}</span>
            </button>
          ))}
        </div>

        <div className="stock-table-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {found.results.length === 0 && (
                <tr>
                  <td colSpan={6} className="stock-table-empty">
                    {search.trim() ? `No product matches “${search.trim()}”.` : "No products here."}
                  </td>
                </tr>
              )}
              {found.results.map((product) => {
                const state = STATES[stateOf(product)];
                const addedAt = addedAtOf(product);
                const minStock = Math.max(Number(product.minStock) || 0, 1);
                const days = product.expiryDate ? daysUntil(product.expiryDate, today) : null;
                return (
                  <tr key={product.id} className={`is-${stateOf(product)}`}>
                    <td className="stock-table-no">{product.productNumber || "—"}</td>
                    <td>
                      <span className="stock-table-name">
                        {markMatches(product.name, found.terms).map((part, index) =>
                          part.hit ? <mark key={index}>{part.text}</mark> : part.text
                        )}
                        {newIds.has(product.id) && (
                          <span className="stock-alarm-new" title={addedAt ? `Added ${formatAddedDay(addedAt)}` : undefined}>
                            New
                          </span>
                        )}
                      </span>
                      <span className="stock-table-sub">{product.category}</span>
                    </td>
                    <td className="stock-table-price">{formatPeso(product.price)}</td>
                    <td>
                      <span className="stock-table-qty">{piecesOf(product)}</span>
                      <span className="stock-meter" aria-hidden="true">
                        <span
                          className={`is-${stateOf(product)}`}
                          style={{ width: `${Math.min(100, (stockOf(product) / (minStock * 2)) * 100)}%` }}
                        ></span>
                      </span>
                    </td>
                    <td>
                      {product.expiryDate ? formatExpiryDate(product.expiryDate) : "No expiry"}
                      {days !== null && days >= 0 && days <= EXPIRY_ALERT_DAYS && (
                        <span className="stock-table-sub">{describeDaysLeft(days)}</span>
                      )}
                    </td>
                    <td>
                      <span className={`stock-alarm-state is-${state.tone}`}>{state.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="stock-all-foot">
          Updated {new Date(now).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })} · Only the admin changes stock and
          prices.
        </p>
      </section>
    </div>
  );
}
