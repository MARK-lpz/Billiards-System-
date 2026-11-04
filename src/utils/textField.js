/**
 * What a text box keeps as it is typed, so a wrong letter never shows: a
 * person's name keeps to letters, spaces and . ' - (the names' own check, see
 * reservationIssues.js) with each word starting with a capital; the name of a
 * thing (a product, a table, a tournament) starts each word with a capital;
 * other text (notes, reasons, messages) starts with one. Read the box with
 * these in its onChange, like readNumberField.
 */

const NOT_IN_A_NAME = /[^\p{L}\p{M} .'-]/gu;
const WORD_START = /(^|[\s(-])(\p{Ll})/gu;
const FIRST_LETTER = /^(\s*)(\p{Ll})/u;

const upper = (_, before, letter) => before + letter.toUpperCase();

/** "juan  dela cruz2" -> "Juan Dela Cruz". */
export const toNameCase = (value = "") =>
  value.replace(NOT_IN_A_NAME, "").replace(/^ +/, "").replace(/ {2,}/g, " ").replace(WORD_START, upper);

/** "coca cola 1.5L" -> "Coca Cola 1.5L". */
export const toTitleCase = (value = "") => value.replace(WORD_START, upper);

/** "table 3 is wobbly" -> "Table 3 is wobbly". */
export const toSentenceCase = (value = "") => value.replace(FIRST_LETTER, upper);

// Puts the kept text in the box at once with the caret where it was (the kept
// text is never longer), and returns it for the form. Left alone while a phone
// keyboard is still composing a word; the next key cleans it.
const readWith = (clean) => (event) => {
  const box = event.target;
  const typed = box.value;
  if (event.nativeEvent?.isComposing) return typed;
  const kept = clean(typed);
  if (kept !== typed) {
    const caret = box.selectionStart;
    box.value = kept;
    if (caret !== null) {
      const at = clean(typed.slice(0, caret)).length;
      box.setSelectionRange(at, at);
    }
  }
  return kept;
};

export const readNameField = readWith(toNameCase);
export const readTitleField = readWith(toTitleCase);
export const readTextField = readWith(toSentenceCase);
