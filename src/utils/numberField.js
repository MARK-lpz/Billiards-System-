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

const DIGIT = /^\d$/;

/**
 * A type="number" box still lets e, E, +, - and "." be typed or pasted in.
 * Spread this on the box so only digits go in, and one "." where it takes
 * centavos (`decimal`). `onKeyDown`: the box's own, still run.
 */
export const numberKeys = ({ decimal = false, onKeyDown } = {}) => ({
  onKeyDown: (event) => {
    const { key, currentTarget: box } = event;
    const typing = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const firstDot = decimal && key === "." && !box.value.includes(".") && !box.validity?.badInput;
    if (typing && !DIGIT.test(key) && !firstDot) event.preventDefault();
    onKeyDown?.(event);
  },
  onPaste: (event) => {
    const pasted = event.clipboardData.getData("text").trim();
    if (!(decimal ? /^\d*\.?\d*$/ : /^\d*$/).test(pasted)) event.preventDefault();
  },
});
