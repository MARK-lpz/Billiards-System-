/**
 * The Inventory's search box. Words can come in any order, and each one has to
 * fit the product:
 *  - its name, category or product number ("cola", "drinks", "#3", "003"), with
 *    a small typo in a name forgiven ("coka" finds Coca Cola);
 *  - a status: low, out of stock, in stock, expired, expiring (within 30 days);
 *  - a price or stock limit: "<50", "price<=30", "stock<10", "stock>=5".
 * Results are ranked: names starting with the words first, typo matches last.
 */

export const EXPIRING_DAYS = 30;

const normalize = (text) =>
  String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
const wordsOf = (text) => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);

// Read as one status before the query is split into words.
const STATUS_PHRASES = [
  [/\bout\s+of\s+stock\b/g, " @out "],
  [/\blow\s+stock\b/g, " @low "],
  [/\bin\s+stock\b/g, " @in "],
  [/\bexpiring\s+soon\b/g, " @expiring "],
];

const STATUS_WORDS = {
  low: "low",
  out: "out",
  empty: "out",
  ubos: "out",
  instock: "in",
  available: "in",
  expired: "expired",
  expiring: "expiring",
};

const STATUS_LABELS = {
  low: "Low stock",
  out: "Out of stock",
  in: "In stock",
  expired: "Expired",
  expiring: `Expiring in ${EXPIRING_DAYS} days`,
};

// Other words staff use for the categories.
const SYNONYMS = {
  inumin: "drinks",
  drink: "drinks",
  beverage: "drinks",
  beverages: "drinks",
  softdrinks: "drinks",
  alak: "liquor",
  pagkain: "food",
  snack: "food",
  snacks: "food",
};

const COMPARISON = /^(price|presyo|stock)?(<=|>=|<|>|=)₱?(\d+(?:\.\d+)?)$/;
const OPERATOR_LABELS = { "<": "<", "<=": "≤", ">": ">", ">=": "≥", "=": "=" };

const compare = (value, operator, limit) =>
  operator === "<" ? value < limit
    : operator === "<=" ? value <= limit
      : operator === ">" ? value > limit
        : operator === ">=" ? value >= limit
          : value === limit;

// Edits (insert, remove, change a letter) between two short words.
const editDistance = (first, second) => {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= second.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[second.length];
};

// A typo allowance that grows with the word: none for short words.
const typoAllowance = (word) => (word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0);

const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toLocaleDateString("en-CA");
};

const productNumberOf = (product) => String(product.productNumber || product.id || "");

/** The query read into words to look for and filters to apply. */
export const parseInventoryQuery = (query) => {
  // "price >= 50" and "< 30" become one word each; "drinks <30" stays two.
  let text = normalize(query)
    .replace(/\b(price|presyo|stock)\s+(?=[<>=])/g, "$1")
    .replace(/(<=|>=|<|>|=)\s+/g, "$1");
  STATUS_PHRASES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  const terms = [];
  const statuses = [];
  const limits = [];
  text
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      if (token.startsWith("@")) {
        statuses.push(token.slice(1));
        return;
      }
      const comparison = token.match(COMPARISON);
      if (comparison) {
        limits.push({
          field: comparison[1] === "stock" ? "stock" : "price",
          operator: comparison[2],
          value: Number(comparison[3]),
        });
        return;
      }
      if (STATUS_WORDS[token]) {
        statuses.push(STATUS_WORDS[token]);
        return;
      }
      terms.push(token);
    });

  return { terms, statuses: [...new Set(statuses)], limits };
};

/** What the search understood, for the chips under the box: ["Low stock", "Price < ₱50"]. */
export const describeInventoryQuery = ({ statuses, limits }) => [
  ...statuses.map((status) => STATUS_LABELS[status]),
  ...limits.map(({ field, operator, value }) =>
    field === "price" ? `Price ${OPERATOR_LABELS[operator]} ₱${value}` : `Stock ${OPERATOR_LABELS[operator]} ${value} pcs`
  ),
];

const fitsStatus = (product, status, today) => {
  const stock = Number(product.stock) || 0;
  const minStock = Number(product.minStock) || 0;
  const expiry = String(product.expiryDate || "");
  if (status === "out") return stock <= 0;
  if (status === "low") return stock <= minStock;
  if (status === "in") return stock > minStock;
  if (status === "expired") return Boolean(expiry) && expiry < today;
  if (status === "expiring") return Boolean(expiry) && expiry >= today && expiry <= addDays(today, EXPIRING_DAYS);
  return true;
};

// How well one word fits a product: 0 when it does not.
const scoreTerm = (product, term) => {
  const name = normalize(product.name);
  const nameWords = wordsOf(product.name);
  const category = normalize(product.category);
  const alternative = SYNONYMS[term];

  if (term.startsWith("#")) {
    const number = term.slice(1).replace(/^0+/, "");
    return number && productNumberOf(product).replace(/^0+/, "") === number ? 4 : 0;
  }
  if (/^\d+$/.test(term) && productNumberOf(product).replace(/^0+/, "") === term.replace(/^0+/, "")) return 4;
  if (nameWords.some((word) => word.startsWith(term))) return 3;
  if (name.includes(term)) return 2;
  if (category.includes(term) || (alternative && category.includes(alternative))) return 1.5;
  if (/^\d+$/.test(term) && Number(product.price) === Number(term)) return 1.5;

  const allowance = typoAllowance(term);
  if (allowance && nameWords.some((word) => editDistance(term, word.slice(0, term.length)) <= allowance)) return 1;
  return 0;
};

/**
 * The products that fit the query, best first: { results, terms, filters, typos }.
 * `typos` is true when some word only fit with a typo forgiven.
 */
export const searchInventory = (products, query, today) => {
  const parsed = parseInventoryQuery(query);
  const filters = describeInventoryQuery(parsed);
  if (!parsed.terms.length && !parsed.statuses.length && !parsed.limits.length) {
    return { results: products, terms: [], filters, typos: false };
  }

  let typos = false;
  const ranked = [];
  products.forEach((product, index) => {
    if (!parsed.statuses.every((status) => fitsStatus(product, status, today))) return;
    if (!parsed.limits.every(({ field, operator, value }) => compare(Number(product[field]) || 0, operator, value))) return;

    const scores = parsed.terms.map((term) => scoreTerm(product, term));
    if (scores.some((score) => score === 0)) return;
    if (scores.some((score) => score === 1)) typos = true;
    ranked.push({ product, index, score: scores.reduce((sum, score) => sum + score, 0) });
  });

  ranked.sort((first, second) => second.score - first.score || first.index - second.index);
  return { results: ranked.map((entry) => entry.product), terms: parsed.terms, filters, typos };
};

/** A product name split into plain and matching parts, to mark what was found. */
export const markMatches = (name, terms = []) => {
  const text = String(name ?? "");
  const lower = text.toLowerCase();
  const hits = Array(text.length).fill(false);
  terms
    .filter((term) => term && !term.startsWith("#"))
    .forEach((term) => {
      let at = lower.indexOf(term);
      while (at !== -1) {
        for (let i = at; i < at + term.length; i += 1) hits[i] = true;
        at = lower.indexOf(term, at + term.length);
      }
    });

  const parts = [];
  for (let i = 0; i < text.length; i += 1) {
    const last = parts[parts.length - 1];
    if (last && last.hit === hits[i]) last.text += text[i];
    else parts.push({ text: text[i], hit: hits[i] });
  }
  return parts;
};
