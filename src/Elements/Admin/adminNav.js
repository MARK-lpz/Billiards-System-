// The admin modules, grouped the way the hall runs: the floor, the money and
// stock, then the back office.
export const navGroups = [
  {
    label: "Overview",
    items: [{ icon: "bi-speedometer2", label: "Dashboard", id: "dashboard" }],
  },
  {
    label: "Floor",
    items: [
      { icon: "bi-circle", label: "Pool Tables", id: "pool-tables" },
      { icon: "bi-calendar-check", label: "Reservations", id: "reservations" },
      { icon: "bi-trophy", label: "Events", id: "events" },
    ],
  },
  {
    label: "Sales & Stock",
    items: [
      { icon: "bi-cart", label: "Sales / POS", id: "sales-pos" },
      { icon: "bi-box", label: "Inventory", id: "inventory" },
      { icon: "bi-tools", label: "Equipment", id: "equipment" },
      { icon: "bi-file-text", label: "Sales Reports", id: "reports" },
    ],
  },
  {
    label: "Administration",
    items: [
      { icon: "bi-people", label: "Accounts", id: "accounts" },
      { icon: "bi-list-check", label: "Audit Trail", id: "audit-trail" },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);
