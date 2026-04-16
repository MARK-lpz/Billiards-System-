export const MENU_ITEMS = [
  { id:1,  name:"Red Horse Beer",   cat:"Drinks",  price:75,  emoji:"🍺", stock:48 },
  { id:2,  name:"San Miguel Light", cat:"Drinks",  price:70,  emoji:"🍺", stock:36 },
  { id:3,  name:"Energy Drink",     cat:"Drinks",  price:90,  emoji:"⚡", stock:24 },
  { id:4,  name:"Softdrinks",       cat:"Drinks",  price:40,  emoji:"🥤", stock:60 },
  { id:5,  name:"Water (500ml)",    cat:"Drinks",  price:20,  emoji:"💧", stock:80 },
  { id:6,  name:"Nachos",           cat:"Food",    price:120, emoji:"🌮", stock:15 },
  { id:7,  name:"French Fries",     cat:"Food",    price:85,  emoji:"🍟", stock:20 },
  { id:8,  name:"Chicken Wings",    cat:"Food",    price:150, emoji:"🍗", stock:12 },
  { id:9,  name:"Peanuts",          cat:"Food",    price:35,  emoji:"🥜", stock:30 },
  { id:10, name:"Instant Noodles",  cat:"Food",    price:55,  emoji:"🍜", stock:18 },
  { id:11, name:"Cue Stick Rental", cat:"Rental",  price:50,  emoji:"🎱", stock:10 },
  { id:12, name:"Ball Set Rental",  cat:"Rental",  price:30,  emoji:"⚪", stock:8  },
];

// ── Initial State ─────────────────────────────────────────────────────────────

export const INIT_TABLES = [
  { id:1, name:"Table 1", player:"Juan Cruz",   timer:4520, rate:15, startTime:"10:30 AM" },
  { id:4, name:"Table 4", player:"Pedro Reyes", timer:1800, rate:15, startTime:"11:00 AM" },
  { id:9, name:"Table 9", player:"Carlo B.",    timer:7200, rate:15, startTime:"09:00 AM" },
];

// All 12 pool tables — open ones have no player/timer
export const ALL_TABLES = [
  { id:1,  name:"Table 1"  },
  { id:2,  name:"Table 2"  },
  { id:3,  name:"Table 3"  },
  { id:4,  name:"Table 4"  },
  { id:5,  name:"Table 5"  },
  { id:6,  name:"Table 6"  },
  { id:7,  name:"Table 7"  },
  { id:8,  name:"Table 8"  },
  { id:9,  name:"Table 9"  },
  { id:10, name:"Table 10" },
  { id:11, name:"Table 11" },
  { id:12, name:"Table 12" },
];

export const HOURLY_RATE = 15; // ₱ per hour, default rate

export const INIT_ORDERS = [
  { id:1, tableId:1, table:"Table 1", player:"Juan Cruz",   item:"Red Horse Beer",  qty:2, price:75,  status:"served",  time:"10:45 AM", emoji:"🍺" },
  { id:2, tableId:4, table:"Table 4", player:"Pedro Reyes", item:"Nachos",          qty:1, price:120, status:"pending", time:"11:15 AM", emoji:"🌮" },
  { id:3, tableId:1, table:"Table 1", player:"Juan Cruz",   item:"Energy Drink",    qty:1, price:90,  status:"pending", time:"11:20 AM", emoji:"⚡" },
  { id:4, tableId:9, table:"Table 9", player:"Carlo B.",    item:"French Fries",    qty:2, price:85,  status:"served",  time:"09:30 AM", emoji:"🍟" },
];

// ── Inventory (mirrors MENU_ITEMS stock levels) ───────────────────────────────

export const INIT_INVENTORY = [
  { id:1,  name:"Red Horse Beer",   cat:"Drinks",  emoji:"🍺", stock:48, minStock:10, cost:45,  price:75  },
  { id:2,  name:"San Miguel Light", cat:"Drinks",  emoji:"🍺", stock:36, minStock:10, cost:40,  price:70  },
  { id:3,  name:"Energy Drink",     cat:"Drinks",  emoji:"⚡", stock:24, minStock:8,  cost:55,  price:90  },
  { id:4,  name:"Softdrinks",       cat:"Drinks",  emoji:"🥤", stock:60, minStock:12, cost:22,  price:40  },
  { id:5,  name:"Water (500ml)",    cat:"Drinks",  emoji:"💧", stock:80, minStock:20, cost:10,  price:20  },
  { id:6,  name:"Nachos",           cat:"Food",    emoji:"🌮", stock:15, minStock:5,  cost:70,  price:120 },
  { id:7,  name:"French Fries",     cat:"Food",    emoji:"🍟", stock:20, minStock:5,  cost:45,  price:85  },
  { id:8,  name:"Chicken Wings",    cat:"Food",    emoji:"🍗", stock:12, minStock:4,  cost:90,  price:150 },
  { id:9,  name:"Peanuts",          cat:"Food",    emoji:"🥜", stock:30, minStock:8,  cost:18,  price:35  },
  { id:10, name:"Instant Noodles",  cat:"Food",    emoji:"🍜", stock:18, minStock:5,  cost:28,  price:55  },
  { id:11, name:"Cue Stick Rental", cat:"Rental",  emoji:"🎱", stock:10, minStock:2,  cost:0,   price:50  },
  { id:12, name:"Ball Set Rental",  cat:"Rental",  emoji:"⚪", stock:8,  minStock:2,  cost:0,   price:30  },
];

// ── Seed sales log (today's already-processed sessions) ───────────────────────

export const INIT_SALES_LOG = [
  { id:1, table:"Table 3", player:"Mark Santos",  duration:"1h 20min", tableCharge:20.00, extrasTotal:195, total:215.00, method:"cash",    time:"08:45 AM", extras:[{ name:"Red Horse Beer", qty:2, price:75 }, { name:"Peanuts", qty:1, price:35 }] },
  { id:2, table:"Table 7", player:"Rico Delos R.", duration:"0h 45min", tableCharge:11.25, extrasTotal:120, total:131.25, method:"ewallet", time:"09:10 AM", extras:[{ name:"Nachos", qty:1, price:120 }] },
  { id:3, table:"Table 2", player:"Bong Villanueva",duration:"2h 05min",tableCharge:31.25, extrasTotal:260, total:291.25, method:"cash",    time:"10:00 AM", extras:[{ name:"San Miguel Light", qty:2, price:70 }, { name:"French Fries", qty:1, price:85 }, { name:"Softdrinks", qty:1, price:40 }] },
];

// ── Discounts ─────────────────────────────────────────────────────────────────

export const DISCOUNTS = [
  { id:"none",   label:"No Discount",  pct:0  },
  { id:"senior", label:"Senior (20%)", pct:20 },
  { id:"pwd",    label:"PWD (20%)",    pct:20 },
  { id:"promo",  label:"Promo (10%)",  pct:10 },
  { id:"staff",  label:"Staff (15%)",  pct:15 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export const fmt    = n => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits:2 })}`;
export const fmtT   = s => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
export const fmtHM  = s => `${Math.floor(s/3600)}h ${String(Math.floor((s%3600)/60)).padStart(2,"0")}min`;
export const nowStr = () => new Date().toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit" });

// ── Shift Management ──────────────────────────────────────────────────────────

export const CASHIERS = ["Maria Santos", "Jose Reyes", "Ana Cruz", "Ramon Dela Rosa"];

export const EXPENSE_CATEGORIES = ["Supplies", "Utilities", "Maintenance", "Food & Drinks Restock", "Other"];

// ── Customer Management ───────────────────────────────────────────────────────

export const INIT_CUSTOMERS = [
  { id:1, name:"Juan Cruz",        phone:"09171234567", visits:12, totalSpent:3240, lastVisit:"Today",      notes:"Prefers Table 1",    loyalty:"Gold"   },
  { id:2, name:"Pedro Reyes",      phone:"09281234567", visits:8,  totalSpent:1870, lastVisit:"Yesterday",  notes:"",                   loyalty:"Silver" },
  { id:3, name:"Carlo B.",         phone:"09391234567", visits:21, totalSpent:6100, lastVisit:"Today",      notes:"Regular, Mon-Fri",   loyalty:"Gold"   },
  { id:4, name:"Mark Santos",      phone:"09451234567", visits:5,  totalSpent:890,  lastVisit:"2 days ago", notes:"",                   loyalty:"Bronze" },
  { id:5, name:"Rico Delos R.",    phone:"09561234567", visits:3,  totalSpent:420,  lastVisit:"Last week",  notes:"",                   loyalty:"Bronze" },
  { id:6, name:"Bong Villanueva",  phone:"09671234567", visits:15, totalSpent:4350, lastVisit:"Today",      notes:"Likes San Mig Light",loyalty:"Gold"   },
];

export const LOYALTY_TIERS = [
  { tier:"Bronze", minVisits:0,  color:"#cd7f32", bg:"rgba(205,127,50,0.1)"  },
  { tier:"Silver", minVisits:5,  color:"#94a3b8", bg:"rgba(148,163,184,0.1)" },
  { tier:"Gold",   minVisits:10, color:"#f59e0b", bg:"rgba(245,158,11,0.1)"  },
];
