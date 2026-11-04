import { columnLetter, downloadExcel } from "./exportExcel";

/**
 * Every report as an Excel sheet laid out like its printed copy (see
 * ReportLetterhead): the letterhead (the logo on navy, the hall's name, the
 * report's title and period, the sign's four colours as a stripe), the report's
 * details, then each section: a navy header row, striped rows, pesos and dates
 * as real numbers Excel can add up and sort, and a total row. The printed sheet
 * repeats the hall's name and the page number at the foot of every page.
 *
 * `report`: {
 *   title, subtitle,
 *   details: [[label, value]],
 *   sections: [
 *     { title, figures: [{ label, value, format }] }                     (a summary, read down)
 *     { title, columns: [{ label, format }], rows: [[…]], total: […], empty }   (a table)
 *   ],
 * }
 * `format`: "text" (default), "wrap" (long text), "peso", "int", "date" (YYYY-MM-DD).
 */

export const HALL_NAME = "Break & Chill Billiard Hall";

/** Who is making a report: the signed-in staff's name, for "Prepared by". */
export const preparedByName = (user) => String(user?.full_name || user?.username || "").trim();

const NAVY = "#001233";
const TUBES = ["#FF3D9A", "#FFD23F", "#4FE06A", "#35C6F4"];
const LINE = "#CBD5E1";
const STRIPE = "#F1F5F9";

const ALIGN_BY_FORMAT = { peso: "right", int: "right", date: "left", text: "left", wrap: "left" };
const NUMBER_BY_FORMAT = { peso: "peso", int: "int", date: "date" };

// One style per kind of cell; the table's cells come plain and striped.
const buildStyles = () => {
  const styles = {
    banner: { fill: NAVY },
    brand: { fill: NAVY, font: { bold: true, size: 16, color: TUBES[1] }, align: { vertical: "bottom", indent: 1 } },
    title: { fill: NAVY, font: { bold: true, size: 13, color: "#FFFFFF" }, align: { indent: 1 } },
    subtitle: { fill: NAVY, font: { size: 10, color: LINE }, align: { vertical: "top", indent: 1 } },
    detailLabel: { font: { bold: true, size: 10, color: "#475569" } },
    detailValue: { font: { size: 10 } },
    section: { font: { bold: true, size: 11, color: NAVY }, border: { bottom: { style: "medium", color: NAVY } }, align: { vertical: "bottom" } },
    note: { font: { italic: true, size: 9, color: "#64748B" } },
  };
  // A summary's figures: a label and its amount, striped like a table.
  [["", null], ["-alt", STRIPE]].forEach(([suffix, fill]) => {
    styles[`figureLabel${suffix}`] = { font: { bold: true, size: 10, color: "#334155" }, border: { color: LINE }, fill: fill || undefined };
    styles[`figureValue${suffix}`] = { font: { bold: true, size: 12 }, border: { color: LINE }, fill: fill || undefined, numFmt: "peso", align: { horizontal: "right" } };
    styles[`figureCount${suffix}`] = { font: { bold: true, size: 12 }, border: { color: LINE }, fill: fill || undefined, numFmt: "int", align: { horizontal: "right" } };
  });
  // The sign's four colours in equal bands, across the merged stripe.
  styles.tubes = { fill: TUBES };
  Object.entries(ALIGN_BY_FORMAT).forEach(([format, horizontal]) => {
    const base = { border: { color: LINE }, numFmt: NUMBER_BY_FORMAT[format], align: { horizontal, vertical: "top", wrap: format === "wrap" } };
    styles[`th-${format}`] = { ...base, fill: NAVY, font: { bold: true, size: 10, color: "#FFFFFF" }, border: { color: NAVY }, numFmt: undefined, align: { horizontal, wrap: true } };
    styles[`td-${format}`] = { ...base, font: { size: 10 } };
    styles[`td-${format}-alt`] = { ...base, font: { size: 10 }, fill: STRIPE };
    styles[`total-${format}`] = {
      ...base,
      fill: "#ECFDF5",
      font: { bold: true, size: 10 },
      border: { color: LINE, top: { style: "medium", color: "#047857" } },
      align: { horizontal: format === "text" || format === "wrap" ? "right" : horizontal },
    };
  });
  return styles;
};

// "2026-10-31" → Excel's day number, so the cell is a date it can sort.
const excelDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000 + 25569 : null;
};

const cellValue = (value, format) => {
  if (value === null || value === undefined || value === "") return "";
  if (format === "peso" || format === "int") return Number.isFinite(Number(value)) ? Number(value) : String(value);
  if (format === "date") return excelDate(value) ?? String(value);
  return String(value);
};

// About how many characters a value takes once Excel shows it.
const shownLength = (value, format) => {
  if (value === "" || value === null || value === undefined) return 0;
  if (format === "peso" && typeof value === "number") return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.length;
  if (format === "int" && typeof value === "number") return value.toLocaleString("en-PH").length;
  if (format === "date" && typeof value === "number") return 12;
  return String(value).length;
};

/** The workbook for `report` (see downloadExcel), on `pageSetup` paper, with the `logo` PNG. */
export const buildReportWorkbook = (report, { pageSetup = null, logo = null, created = "" } = {}) => {
  const sections = report.sections || [];
  const width = Math.max(4, ...sections.map((section) => (section.figures ? 2 : (section.columns || []).length)));
  const last = columnLetter(width - 1);
  const rows = [];
  const merges = [];
  const rowHeights = {};
  const widths = Array.from({ length: width }, () => 10);
  const fit = (index, length, extra = 2) => {
    widths[index] = Math.max(widths[index], Math.min(length + extra, 60));
  };
  // A row spanning every column in one style, its text in the first cell.
  const spanRow = (text, style, height) => {
    rows.push([{ v: text, s: style }, ...Array.from({ length: width - 1 }, () => ({ v: "", s: style }))]);
    merges.push(`A${rows.length}:${last}${rows.length}`);
    if (height) rowHeights[rows.length - 1] = height;
  };

  // The letterhead: the logo in A1:A3, the name, title and period beside it.
  [
    [HALL_NAME.toUpperCase(), "brand", 24],
    [report.title, "title", 20],
    [report.subtitle || "", "subtitle", 18],
  ].forEach(([text, style, height]) => {
    rows.push([{ v: "", s: "banner" }, { v: text, s: style }, ...Array.from({ length: width - 2 }, () => ({ v: "", s: style }))]);
    merges.push(`B${rows.length}:${last}${rows.length}`);
    rowHeights[rows.length - 1] = height;
  });
  merges.push("A1:A3");
  // The four tubes of the sign, as a thin stripe under it.
  spanRow("", "tubes", 5);
  rows.push([]);
  rowHeights[rows.length - 1] = 8;

  (report.details || []).forEach(([label, value]) => {
    rows.push([{ v: label, s: "detailLabel" }, { v: String(value ?? ""), s: "detailValue" }]);
    merges.push(`B${rows.length}:${last}${rows.length}`);
    fit(0, String(label).length);
  });

  sections.forEach((section) => {
    rows.push([]);
    spanRow(section.title, "section", 22);

    // A summary reads down: each figure's name, then its amount.
    if (section.figures) {
      section.figures.forEach((figure, index) => {
        const value = cellValue(figure.value, figure.format);
        const stripe = index % 2 ? "-alt" : "";
        fit(0, figure.label.length, 3);
        fit(1, shownLength(value, figure.format), 5);
        rows.push([
          { v: figure.label, s: `figureLabel${stripe}` },
          { v: value, s: `${figure.format === "int" ? "figureCount" : "figureValue"}${stripe}` },
        ]);
        rowHeights[rows.length - 1] = 18;
      });
      return;
    }

    const columns = section.columns || [];
    rows.push(columns.map((column, index) => {
      fit(index, column.label.length, 3);
      return { v: column.label, s: `th-${column.format || "text"}` };
    }));
    rowHeights[rows.length - 1] = 18;
    if (!section.rows?.length) {
      spanRow(section.empty || "Nothing to show.", "note");
      return;
    }
    section.rows.forEach((row, rowIndex) => {
      rows.push(columns.map((column, index) => {
        const format = column.format || "text";
        const value = cellValue(row[index], format);
        if (format === "wrap") widths[index] = Math.max(widths[index], Math.min(Math.max(shownLength(value, format), 24), 48));
        else fit(index, shownLength(value, format));
        return { v: value, s: `td-${format}${rowIndex % 2 ? "-alt" : ""}` };
      }));
    });
    if (section.total) {
      rows.push(columns.map((column, index) => {
        const format = column.format || "text";
        const value = cellValue(section.total[index], format);
        fit(index, shownLength(value, format), 3);
        return { v: value, s: `total-${format}` };
      }));
    }
  });

  rows.push([]);
  spanRow(`Generated by the ${HALL_NAME} system.`, "note");

  // Room for the logo (about 84 × 72 px) in the first column.
  widths[0] = Math.max(widths[0], 14);

  return {
    sheetName: report.subtitle || report.title,
    rows,
    styles: buildStyles(),
    cols: widths,
    merges,
    rowHeights,
    gridLines: false,
    pageSetup,
    footer: { left: `${HALL_NAME} · ${report.title}${report.subtitle ? ` · ${report.subtitle}` : ""}` },
    image: logo ? { bytes: logo, col: 0, row: 0, offsetX: 6, offsetY: 4, width: 84, height: 72 } : null,
    properties: { title: `${report.title}${report.subtitle ? ` · ${report.subtitle}` : ""}`, creator: HALL_NAME, created },
  };
};

/**
 * The logo as PNG bytes for Excel: cropped to the sign (the file has wide empty
 * edges) and made small. Null when it cannot be loaded; the sheet still has the
 * hall's name.
 */
export const loadExcelLogo = async () => {
  try {
    const image = new Image();
    image.src = "/Logo.png";
    await image.decode();
    const scale = image.naturalWidth / 810;
    const canvas = document.createElement("canvas");
    canvas.width = 232;
    canvas.height = 200;
    canvas.getContext("2d").drawImage(image, 55 * scale, 125 * scale, 700 * scale, 605 * scale, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
};

/** Builds the report's workbook, with the logo, and downloads it as `fileName`. */
export const downloadReportExcel = async (report, { fileName, pageSetup }) => {
  const logo = await loadExcelLogo();
  // Excel's own format for when the file was made: no milliseconds.
  const created = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  downloadExcel({ fileName, ...buildReportWorkbook(report, { pageSetup, logo, created }) });
};
