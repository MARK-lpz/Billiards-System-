// Product No. is a stable, unique label ("001", "002", ...). It is stored on the
// product itself, so a number never shifts when another product is deleted.

const readNumber = (product) => {
  const value = Number.parseInt(product?.productNumber, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const formatNumber = (value) => String(value).padStart(3, "0");

export const getNextProductNumber = (products = []) =>
  formatNumber(products.reduce((highest, product) => Math.max(highest, readNumber(product) ?? 0), 0) + 1);

// A product saved before numbers existed was shown with its id instead ("002"
// for id 2), so that is the number staff already know it by. Ids made from the
// clock are far too large to have been shown that way.
const readShownNumber = (product) => {
  const id = Number(product?.id);
  return readNumber(product) ?? (Number.isInteger(id) && id > 0 && id < 1000 ? id : null);
};

// Gives every product a number of its own. Two products could end up sharing
// one: a product with no number showed its id, e.g. "002", while the next new
// product was also given "002". Going down the list (oldest first), each product
// keeps the number it was shown with unless an earlier product already has it;
// the rest get the next free numbers.
export const normalizeProductNumbers = (products) => {
  if (!Array.isArray(products)) return products;

  const taken = new Set();
  const kept = products.map((product) => {
    const value = readShownNumber(product);
    if (value === null || taken.has(value)) return null;
    taken.add(value);
    return value;
  });

  let next = Math.max(0, ...taken);
  const numbered = products.map((product, index) => {
    const productNumber = formatNumber(kept[index] ?? ++next);
    return product.productNumber === productNumber ? product : { ...product, productNumber };
  });

  return numbered.every((product, index) => product === products[index]) ? products : numbered;
};
