import { useState } from "react";

/**
 * When a form shows its field errors. `errors` is { field: message } from a
 * validator. A field's message appears once that field has been left, or for
 * every field once Save is pressed, so a fresh form does not open covered in red.
 *
 *   const { errorFor, touch, canSave } = useFormErrors(errors);
 *   <input onBlur={() => touch("name")} ... />
 *   <FieldError id="x-name-error" message={errorFor("name")} />
 *   onClick={() => canSave(["name", "rate"], "x-") && onSave()}
 */
export default function useFormErrors(errors = {}) {
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);

  const errorFor = (field) => ((attempted || touched[field]) && errors[field]) || "";
  const touch = (field) => setTouched((previous) => ({ ...previous, [field]: true }));

  // True when nothing is wrong. Otherwise every message is shown and the first
  // field with a problem (in `order`, found by id `${idPrefix}${field}`) gets focus.
  const canSave = (order = Object.keys(errors), idPrefix = "") => {
    const first = order.find((field) => errors[field]);
    if (!first) return true;
    setAttempted(true);
    document.getElementById(`${idPrefix}${first}`)?.focus();
    return false;
  };

  return { errorFor, touch, canSave, attempted };
}
