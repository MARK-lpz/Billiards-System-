import { useEffect, useState } from "react";
import { getTableSpares, getUnassignedSpares } from "../../utils/equipment";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The spares, table by table: the list of tables first, then the spares kept
 * for the one picked. Spares not given to a table come last, as Unassigned.
 * `renderItem(item, table)` draws one spare (its state and a flag to report it).
 */
export default function SpareEquipmentModal({ tables = [], equipment = [], renderItem, onBorrow, onClose }) {
  // null shows the tables; otherwise the id of the one open ("unassigned" for the rest).
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const groups = [...tables]
    .sort((first, second) => Number(first.id) - Number(second.id))
    .map((table) => ({
      id: String(table.id),
      table,
      title: table.name || `Table ${table.id}`,
      items: getTableSpares(equipment, table.id),
    }));
  const unassigned = getUnassignedSpares(equipment, tables);
  if (unassigned.length) groups.push({ id: "unassigned", table: null, title: "Unassigned", items: unassigned });

  const open = groups.find((group) => group.id === openId) || null;

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content qa-spare-modal">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-box-seam"></i> {open ? `${open.title} Spares` : "Spare Equipment"}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {open ? (
                <>
                  <button type="button" className="qa-spare-back" onClick={() => setOpenId(null)}>
                    <i className="bi bi-arrow-left"></i> All tables
                  </button>
                  {open.items.length ? (
                    <ul className="qa-item-list qa-item-list--spare">
                      {open.items.map((item) => renderItem(item, open.table))}
                    </ul>
                  ) : (
                    <p className="qa-item-empty qa-spare-empty">
                      No spares kept for {open.title} yet. Ask the admin to add one in Equipment Monitoring.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="qa-borrow-copy">
                    Each table keeps its own spares. Pick a table to see them; lend one through Borrow / Return.
                  </p>
                  <div className="qa-spare-tables">
                    {groups.map((group) => {
                      const out = group.items.filter((item) => item.status !== "active").length;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          className={`qa-spare-table${group.items.length ? " has-spares" : ""}${
                            group.id === "unassigned" ? " is-unassigned" : ""
                          }`}
                          onClick={() => setOpenId(group.id)}
                        >
                          <strong>{group.title}</strong>
                          <small>
                            {group.items.length ? plural(group.items.length, "spare") : "No spares"}
                            {out > 0 ? ` · ${out} out` : ""}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
              <button type="button" className="btn btn-success" onClick={onBorrow}>
                <i className="bi bi-arrow-left-right"></i> Borrow / Return
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
