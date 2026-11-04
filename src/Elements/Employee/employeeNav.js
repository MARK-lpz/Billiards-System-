// The employee pages, grouped like the admin panel: the dashboard first, then
// the front desk, then the jobs around the hall.
export const navGroups = [
  {
    label: "Overview",
    items: [{ icon: "bi-speedometer2", label: "Dashboard", id: "dashboard" }],
  },
  {
    label: "Front Desk",
    items: [
      { icon: "bi-circle", label: "Pool Tables", id: "pool-tables" },
      { icon: "bi-cart", label: "Sales POS", id: "sales" },
      { icon: "bi-box-seam", label: "Stock Alarm", id: "stock-alarm" },
      { icon: "bi-calendar2-check", label: "Reservations", id: "reservations" },
      { icon: "bi-clock-history", label: "History", id: "history" },
    ],
  },
  {
    label: "Hall",
    items: [
      { icon: "bi-clipboard-check", label: "Actions", id: "quick-actions" },
      { icon: "bi-trophy", label: "Tournament Schedule", id: "tournaments" },
      { icon: "bi-globe2", label: "Content Management", id: "content-management" },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);
