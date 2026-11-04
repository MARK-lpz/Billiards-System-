// Minimal .xlsx writer. Builds a real Office Open XML workbook and packs it into
// a ZIP with stored (uncompressed) entries, so no third-party library is needed.
// A sheet can carry cell styles (fonts, fills, borders, number formats), merged
// cells, row heights, a picture (the logo) and a printed footer.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const encoder = new TextEncoder();
const utf8 = (text) => encoder.encode(text);

// Tab, newline and carriage return are the only control characters XML allows.
// Anything else below 0x20 would make the file unreadable, so it is dropped.
const stripIllegalXmlChars = (text) => {
  let output = "";
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    output += char;
  }
  return output;
};

const escapeXml = (value) =>
  stripIllegalXmlChars(String(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const columnLetter = (index) => {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

const isNumeric = (value) =>
  typeof value === "number" && Number.isFinite(value);

// ---- Styles: each named style becomes one cell format (xf) in styles.xml.

// "#001233" → "FF001233"
const argb = (color) => `FF${String(color || "#000000").replace("#", "").toUpperCase()}`;

// Number formats by name; anything else is used as Excel's own format code.
const NUMBER_FORMATS = {
  int: 3, // #,##0, built in
  peso: '"₱"#,##0.00;-"₱"#,##0.00',
  date: "mmm d, yyyy",
};

const fontXml = ({ bold, italic, size = 10, color = "#111827", name = "Calibri" } = {}) =>
  `<font>${bold ? "<b/>" : ""}${italic ? "<i/>" : ""}<sz val="${size}"/><color rgb="${argb(color)}"/><name val="${escapeXml(name)}"/><family val="2"/></font>`;

// One colour, or a list of colours side by side in equal bands (left to right).
const fillXml = (color) => {
  if (!Array.isArray(color)) {
    return `<fill><patternFill patternType="solid"><fgColor rgb="${argb(color)}"/><bgColor indexed="64"/></patternFill></fill>`;
  }
  const stops = color
    .flatMap((band, index) => [index / color.length, (index + 1) / color.length].map((position) => [position, band]))
    .map(([position, band]) => `<stop position="${Number(position.toFixed(4))}"><color rgb="${argb(band)}"/></stop>`)
    .join("");
  return `<fill><gradientFill degree="0">${stops}</gradientFill></fill>`;
};

// `border`: { color, top, bottom } — every side thin in `color`, with a heavier
// top or bottom when given ({ style, color }); or { bottom } alone.
const borderXml = (border) => {
  if (!border) return "<border><left/><right/><top/><bottom/><diagonal/></border>";
  const side = (name, override) => {
    const style = override?.style || (border.color ? "thin" : null);
    const color = override?.color || border.color;
    return style ? `<${name} style="${style}"><color rgb="${argb(color)}"/></${name}>` : `<${name}/>`;
  };
  return `<border>${side("left")}${side("right")}${side("top", border.top)}${side("bottom", border.bottom)}<diagonal/></border>`;
};

/**
 * `specs`: { name: { font, fill (a colour, or colours in bands), border, numFmt,
 * align: { horizontal, vertical, wrap, indent } } }.
 * Returns the styles.xml text and each name's index (0 is the plain default).
 */
const buildStyles = (specs = {}) => {
  const fonts = [fontXml()];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = [borderXml(null)];
  const numFmts = [];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const indexOf = {};
  const pick = (list, xml) => {
    const found = list.indexOf(xml);
    if (found !== -1) return found;
    list.push(xml);
    return list.length - 1;
  };

  Object.entries(specs).forEach(([name, spec]) => {
    const fontId = spec.font ? pick(fonts, fontXml(spec.font)) : 0;
    const fillId = spec.fill?.length ? pick(fills, fillXml(spec.fill)) : 0;
    const borderId = spec.border ? pick(borders, borderXml(spec.border)) : 0;
    let numFmtId = 0;
    if (spec.numFmt) {
      const format = NUMBER_FORMATS[spec.numFmt] ?? spec.numFmt;
      if (typeof format === "number") {
        numFmtId = format;
      } else {
        const known = numFmts.findIndex((code) => code === format);
        numFmtId = 164 + (known === -1 ? numFmts.push(format) - 1 : known);
      }
    }
    const align = spec.align || {};
    const alignment = [
      align.horizontal ? `horizontal="${align.horizontal}"` : "",
      `vertical="${align.vertical || "center"}"`,
      align.wrap ? 'wrapText="1"' : "",
      align.indent ? `indent="${align.indent}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    xfs.push(
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment ${alignment}/></xf>`
    );
    indexOf[name] = xfs.length - 1;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${
    numFmts.length
      ? `<numFmts count="${numFmts.length}">${numFmts.map((code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escapeXml(code)}"/>`).join("")}</numFmts>`
      : ""
  }<fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join(
    ""
  )}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join(
    ""
  )}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { xml, indexOf };
};

// ---- The sheet.

// How the sheet prints: the paper (`paperSize`, an Excel paper code) and its
// `orientation`, fitted to one page wide with as many pages down as it needs.
const buildPageSetup = (pageSetup) =>
  pageSetup
    ? `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="${Number(pageSetup.paperSize) || 9}" orientation="${
        pageSetup.orientation === "landscape" ? "landscape" : "portrait"
      }" fitToWidth="1" fitToHeight="0"/>`
    : "";

// Excel's header/footer codes: "&L" left, "&R" right, "&P" page, "&N" pages; a
// literal "&" is written "&&".
const footerText = (footer) =>
  footer
    ? `<headerFooter><oddFooter>${escapeXml(
        `&L&8${String(footer.left || "").replace(/&/g, "&&")}&R&8${footer.right === undefined ? "Page &P of &N" : String(footer.right).replace(/&/g, "&&")}`
      )}</oddFooter></headerFooter>`
    : "";

// A cell is a plain value, or { v, s } with `s` a style name.
const cellParts = (cell) => (cell !== null && typeof cell === "object" ? { value: cell.v, style: cell.s } : { value: cell, style: null });

const buildSheet = ({ rows, pageSetup = null, cols = null, merges = [], rowHeights = {}, gridLines = true, footer = null, hasDrawing = false }, styleIndex = {}) => {
  const widths = [];
  const body = rows
    .map((row, rowIndex) => {
      const cells = (row || [])
        .map((cell, colIndex) => {
          const { value, style } = cellParts(cell);
          const text = value === null || value === undefined ? "" : String(value);
          if (!cols) widths[colIndex] = Math.max(widths[colIndex] || 10, Math.min(text.length + 2, 60));
          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
          const s = style && styleIndex[style] ? ` s="${styleIndex[style]}"` : "";
          // A styled empty cell still carries its fill and borders.
          if (text === "") return s ? `<c r="${ref}"${s}/>` : "";
          if (isNumeric(value)) {
            return `<c r="${ref}"${s}><v>${value}</v></c>`;
          }
          return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
        })
        .join("");

      const height = rowHeights[rowIndex];
      return `<row r="${rowIndex + 1}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells}</row>`;
    })
    .join("");

  const columnWidths = cols || widths;
  const colsXml = columnWidths.length
    ? `<cols>${columnWidths
        .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";
  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  const views = gridLines ? "" : '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${
    pageSetup ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : ""
  }${views}${colsXml}<sheetData>${body}</sheetData>${mergeXml}${buildPageSetup(pageSetup)}${footerText(footer)}${hasDrawing ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
};

// ---- A picture on the sheet (the logo), at a cell, `width` × `height` px.

const EMU_PER_PX = 9525;

const buildDrawing = ({ col = 0, row = 0, offsetX = 0, offsetY = 0, width, height, name = "Logo" }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${
  offsetX * EMU_PER_PX
}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${offsetY * EMU_PER_PX}</xdr:rowOff></xdr:from><xdr:ext cx="${width * EMU_PER_PX}" cy="${
  height * EMU_PER_PX
}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="${escapeXml(name)}" descr="${escapeXml(name)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${
  width * EMU_PER_PX
}" cy="${height * EMU_PER_PX}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;

const RELS = (entries) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries
  .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
  .join("")}</Relationships>`;

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const buildContentTypes = (hasDrawing) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${
  hasDrawing ? '<Default Extension="png" ContentType="image/png"/>' : ""
}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${
  hasDrawing ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ""
}</Types>`;

// The file's own details (File > Info in Excel): its title and who made it.
const buildCoreProps = ({ title = "", creator = "", created }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(
  title
)}</dc:title><dc:creator>${escapeXml(creator)}</dc:creator>${
  created ? `<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>` : ""
}</cp:coreProperties>`;

// Excel limits a sheet name to 31 characters and forbids : \ / ? * [ ]
const safeSheetName = (name) =>
  (String(name || "Sheet1").replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet1").slice(0, 31);

const buildWorkbookXml = (sheetName) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
  safeSheetName(sheetName)
)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

// `files`: { name, content } with content text or bytes.
const zipStore = (files) => {
  const chunks = [];
  const central = [];
  let offset = 0;

  const push = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  const u16 = (value) => [value & 0xff, (value >>> 8) & 0xff];
  const u32 = (value) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];

  files.forEach((file) => {
    const nameBytes = utf8(file.name);
    const data = file.content instanceof Uint8Array ? file.content : utf8(file.content);
    const crc = crc32(data);
    const localOffset = offset;

    push(
      new Uint8Array([
        0x50, 0x4b, 0x03, 0x04,
        ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nameBytes.length), ...u16(0),
      ])
    );
    push(nameBytes);
    push(data);

    central.push(
      new Uint8Array([
        0x50, 0x4b, 0x01, 0x02,
        ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nameBytes.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(localOffset),
        ...nameBytes,
      ])
    );
  });

  const centralStart = offset;
  central.forEach(push);
  const centralSize = offset - centralStart;

  push(
    new Uint8Array([
      0x50, 0x4b, 0x05, 0x06,
      ...u16(0), ...u16(0),
      ...u16(files.length), ...u16(files.length),
      ...u32(centralSize), ...u32(centralStart),
      ...u16(0),
    ])
  );

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, cursor);
    cursor += chunk.length;
  });
  return output;
};

/**
 * Builds the raw bytes of a single-sheet .xlsx file. `rows`: rows of cells (see
 * cellParts); `styles`: named cell styles (see buildStyles); `cols`: column
 * widths (else sized to the text); `merges`: ranges like "A1:H1"; `rowHeights`:
 * { rowIndex: points }; `gridLines`: false hides them; `pageSetup`: see
 * buildPageSetup; `footer`: { left, right } printed on every page; `image`:
 * { bytes (PNG), col, row, offsetX, offsetY, width, height }; `properties`:
 * { title, creator, created }.
 */
export const buildWorkbook = ({
  sheetName = "Sheet1",
  rows = [],
  pageSetup = null,
  styles = {},
  cols = null,
  merges = [],
  rowHeights = {},
  gridLines = true,
  footer = null,
  image = null,
  properties = {},
} = {}) => {
  const { xml: stylesXml, indexOf } = buildStyles(styles);
  const hasDrawing = Boolean(image?.bytes?.length);
  return zipStore([
    { name: "[Content_Types].xml", content: buildContentTypes(hasDrawing) },
    {
      name: "_rels/.rels",
      content: RELS([
        ["rId1", `${REL}/officeDocument`, "xl/workbook.xml"],
        ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"],
      ]),
    },
    { name: "docProps/core.xml", content: buildCoreProps(properties) },
    { name: "xl/workbook.xml", content: buildWorkbookXml(sheetName) },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: RELS([
        ["rId1", `${REL}/worksheet`, "worksheets/sheet1.xml"],
        ["rId2", `${REL}/styles`, "styles.xml"],
      ]),
    },
    { name: "xl/styles.xml", content: stylesXml },
    { name: "xl/worksheets/sheet1.xml", content: buildSheet({ rows, pageSetup, cols, merges, rowHeights, gridLines, footer, hasDrawing }, indexOf) },
    ...(hasDrawing
      ? [
          { name: "xl/worksheets/_rels/sheet1.xml.rels", content: RELS([["rId1", `${REL}/drawing`, "../drawings/drawing1.xml"]]) },
          { name: "xl/drawings/drawing1.xml", content: buildDrawing(image) },
          { name: "xl/drawings/_rels/drawing1.xml.rels", content: RELS([["rId1", `${REL}/image`, "../media/image1.png"]]) },
          { name: "xl/media/image1.png", content: image.bytes },
        ]
      : []),
  ]);
};

export const safeFileName = (name) =>
  `${String(name || "report").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "report"}.xlsx`;

/** Builds the workbook (see buildWorkbook) and hands it to the browser as a download. */
export const downloadExcel = ({ fileName, ...workbook }) => {
  const bytes = buildWorkbook(workbook);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
