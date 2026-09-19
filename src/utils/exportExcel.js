// Minimal .xlsx writer. Builds a real Office Open XML workbook and packs it into
// a ZIP with stored (uncompressed) entries, so no third-party library is needed.

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

const buildSheet = (rows) => {
  const widths = [];
  const body = rows
    .map((row, rowIndex) => {
      const cells = (row || [])
        .map((value, colIndex) => {
          const text = value === null || value === undefined ? "" : String(value);
          widths[colIndex] = Math.max(widths[colIndex] || 10, Math.min(text.length + 2, 60));
          if (text === "") return "";

          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
          if (isNumeric(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const cols = widths.length
    ? `<cols>${widths
        .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
};

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

// Excel limits a sheet name to 31 characters and forbids : \ / ? * [ ]
const safeSheetName = (name) =>
  (String(name || "Sheet1").replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet1").slice(0, 31);

const buildWorkbookXml = (sheetName) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
  safeSheetName(sheetName)
)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

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
    const data = utf8(file.content);
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

/** Builds the raw bytes of a single-sheet .xlsx file. */
export const buildWorkbook = ({ sheetName = "Sheet1", rows = [] } = {}) =>
  zipStore([
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: ROOT_RELS },
    { name: "xl/workbook.xml", content: buildWorkbookXml(sheetName) },
    { name: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS },
    { name: "xl/worksheets/sheet1.xml", content: buildSheet(rows) },
  ]);

export const safeFileName = (name) =>
  `${String(name || "report").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "report"}.xlsx`;

/** Builds the workbook and hands it to the browser as a download. */
export const downloadExcel = ({ fileName, sheetName, rows }) => {
  const bytes = buildWorkbook({ sheetName, rows });
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
