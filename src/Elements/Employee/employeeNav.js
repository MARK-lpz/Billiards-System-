// The employee pages, grouped like the admin panel: the floor first, then the
// front desk, then the jobs around the hall.
export const navGroups = [
  {
    label: "Overview",
    items: [{ icon: "bi-speedometer2", label: "Pool Tables", id: "Pool Tables" }],
  },
  {
    label: "Front Desk",
    items: [
      { icon: "bi-cart", label: "Sales POS", id: "sales" },
      { icon: "bi-calendar2-check", label: "Reservations", id: "reservations" },
    ],
  },
  {
    label: "Hall",
    items: [
      { icon: "bi-clipboard-check", label: "Actions", id: "quick-actions" },
      { icon: "bi-trophy", label: "Tournament Schedule", id: "tournaments" },
      { icon: "bi-globe2", label: "Website", id: "website" },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);
