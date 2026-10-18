/**
 * The paper a report is printed or downloaded on: its size and which way it
 * turns. The preview, the printout (@page) and the Excel page setup all follow
 * the same choice. `excel` is the paper's code in an .xlsx page setup.
 */

export const PAPER_SIZES = [
  { key: "a4", label: "A4 (210 × 297 mm)", width: 210, height: 297, excel: 9 },
  { key: "letter", label: "Letter (8.5 × 11 in)", width: 215.9, height: 279.4, excel: 1 },
  { key: "long", label: "Long (8.5 × 13 in)", width: 215.9, height: 330.2, excel: 14 },
  { key: "legal", label: "Legal (8.5 × 14 in)", width: 215.9, height: 355.6, excel: 5 },
];

export const ORIENTATIONS = [
  { key: "portrait", label: "Portrait" },
  { key: "landscape", label: "Landscape" },
];

// The white edge left on every side of the printed page.
export const PAPER_MARGIN_MM = 10;

const STORAGE_KEY = "salesReportPaper";
export const DEFAULT_PAPER = { size: "a4", orientation: "portrait" };

const findSize = (key) => PAPER_SIZES.find((size) => size.key === key) || PAPER_SIZES[0];

/** The page's width and height in mm, turned for landscape. */
export const paperDimensions = ({ size, orientation }) => {
  const paper = findSize(size);
  return orientation === "landscape"
    ? { width: paper.height, height: paper.width }
    : { width: paper.width, height: paper.height };
};

/** The printer's page rule for this paper. */
export const pagePrintCss = (paper) => {
  const { width, height } = paperDimensions(paper);
  return `@page { size: ${width}mm ${height}mm; margin: ${PAPER_MARGIN_MM}mm; }`;
};

/** The .xlsx page setup for this paper (see downloadExcel). */
export const excelPageSetup = ({ size, orientation }) => ({
  paperSize: findSize(size).excel,
  orientation: orientation === "landscape" ? "landscape" : "portrait",
});

/** The paper last picked on this device, or A4 portrait. */
export const readPaperChoice = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (
      stored &&
      PAPER_SIZES.some((size) => size.key === stored.size) &&
      ORIENTATIONS.some((entry) => entry.key === stored.orientation)
    ) {
      return { size: stored.size, orientation: stored.orientation };
    }
  } catch {
    // Unreadable or blocked: the default below.
  }
  return DEFAULT_PAPER;
};

export const savePaperChoice = (paper) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paper));
  } catch {
    // Not kept on this device; the report still prints on the chosen paper.
  }
};
