export const DISCOUNTS = [
  { id: "none", label: "No Discount", pct: 0 },
  { id: "senior", label: "Senior (20%)", pct: 20 },
  { id: "pwd", label: "PWD (20%)", pct: 20 },
  { id: "promo", label: "Promo (10%)", pct: 10 },
  { id: "staff", label: "Staff (15%)", pct: 15 },
];

export const defaultExtraForm = {
  name: "",
  amount: "",
  category: "Rental",
};

export const todayStr = () => new Date().toLocaleDateString("en-CA");

export const nowStr = () =>
  new Date().toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const readStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};
