import { useEffect, useRef, useState } from "react";

/**
 * Which step a step-by-step guest form is on (FormSteps.jsx). Moving to another
 * step puts focus on that step's title (`title`, a heading with tabIndex -1) and
 * scrolls the form back to its top, so a guest who pressed Next at the bottom of
 * a long step starts the next one from its beginning.
 */
export function useFormSteps() {
  const [step, setStep] = useState(0);
  const title = useRef(null);
  // Only a move asked for by the guest moves focus, never the first render.
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const heading = title.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const top = heading.closest("form")?.querySelector(".form-steps") || heading;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }, [step]);

  const goTo = (next) => {
    moved.current = true;
    setStep(next);
  };

  return { step, goTo, title };
}
