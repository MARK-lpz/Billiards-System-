/**
 * A number input whose state is a number gets a stuck "0": clearing the box
 * turns "" straight back into 0, and React then keeps whatever is typed after
 * it, so typing 300 shows "0300". Zero is shown as an empty box instead (pair it
 * with a "0" placeholder), and an empty box still means 0.
 */
export const numberFieldValue = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isNaN(number) || number === 0 ? "" : value;
};

export const readNumberField = (event) => (event.target.value === "" ? 0 : Number(event.target.value));
