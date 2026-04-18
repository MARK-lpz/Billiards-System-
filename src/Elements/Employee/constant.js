
export const fmt = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const LOYALTY_TIERS = [
  {
    tier: "Bronze",
    minVisits: 0,
    color: "#cd7f32",
    bg: "rgba(205, 127, 50, 0.12)",
  },
  {
    tier: "Silver",
    minVisits: 5,
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
  },
  {
    tier: "Gold",
    minVisits: 10,
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.12)",
  },
];
