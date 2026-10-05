// Prints one part of the page, such as a receipt or a report. It is copied into
// a hidden frame with the page's styles, so the dashboard behind a pop-up never
// ends up on the paper.
export const printElement = (element, { title = "Print", bodyClass = "", extraCss = "" } = {}) => {
  if (!element) return;

  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
    .map((node) => node.outerHTML)
    .join("");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.className = "print-frame";
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 0);
  };
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>${styles}${
    extraCss ? `<style>${extraCss}</style>` : ""
  }</head><body class="${bodyClass}">${element.outerHTML}</body></html>`;
  document.body.appendChild(frame);
};
