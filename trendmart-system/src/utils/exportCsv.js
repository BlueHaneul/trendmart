// Generates and downloads a CSV entirely in the browser from data a report screen has already loaded.
// Columns use the shape { key, label, currency? } so a PDF exporter can reuse the same definitions.

// Spreadsheet apps in decimal-comma locales (e.g. South Africa, en-ZA) expect ';' as the field
// separator and ',' as the decimal mark. Detect the browser's locale once and match it, otherwise
// the file opens as one column of text.
const DECIMAL_MARK = (1.1).toLocaleString().charAt(1) === ',' ? ',' : '.';
const DELIMITER = DECIMAL_MARK === ',' ? ';' : ',';

// A text cell starting with one of these would be evaluated as a formula by Excel ("CSV injection").
const FORMULA_TRIGGERS = ['=', '+', '-', '@'];

function cellText(value, column) {
  if (value === null || value === undefined || value === '') return '';
  if (column.currency) return Number(value).toFixed(2).replace('.', DECIMAL_MARK);
  if (typeof value === 'number') return String(value).replace('.', DECIMAL_MARK);
  const text = String(value);
  return FORMULA_TRIGGERS.includes(text[0]) ? `'${text}` : text;
}

const quote = (text) => `"${String(text).replace(/"/g, '""')}"`;

export function downloadCsv(filename, columns, rows) {
  const header = columns.map((c) => quote(c.label)).join(DELIMITER);
  const lines = rows.map((row) => columns.map((c) => quote(cellText(row[c.key], c))).join(DELIMITER));

  // BOM so Excel reads the file as UTF-8; the sep= line tells Excel which separator to use.
  const csv = '\uFEFF' + `sep=${DELIMITER}\r\n` + [header, ...lines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}