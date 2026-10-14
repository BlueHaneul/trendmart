// Generates and downloads a PDF report in the browser from data a report screen has already loaded.
// Uses the same column definitions as the CSV export: { key, label, currency?, numeric? }.
import { jsPDF } from 'jspdf';
import * as autoTableModule from 'jspdf-autotable';

// jspdf-autotable has changed how it exports its function between versions (default vs named),
// so resolve it defensively instead of depending on one style.
const autoTable = autoTableModule.default ?? autoTableModule.autoTable;

// toLocaleString('en-ZA') uses special space characters (non-breaking / narrow no-break) for
// thousands grouping. jsPDF's built-in fonts can't draw some of them and print garbage, so
// replace every kind of whitespace with a plain space.
const plain = (text) => String(text).replace(/\s/g, ' ');

const money = (value) =>
  plain('R ' + Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const cellText = (value, column) => {
  if (value === null || value === undefined || value === '') return '';
  return column.currency ? money(value) : String(value);
};

export function downloadPdf({ filename, title, subtitle, columns, rows, generatedBy }) {
  if (typeof autoTable !== 'function') throw new Error('jspdf-autotable could not be loaded');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TrendMart', margin, 16);
  doc.setFontSize(13);
  doc.text(title, margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(subtitle, margin, 30);
  const who = generatedBy ? `${generatedBy.full_name} (${generatedBy.role})` : 'Unknown user';
  doc.text(plain(`Generated: ${new Date().toLocaleString('en-ZA')}  |  By: ${who}`), margin, 35);

  // Table: numeric columns right-aligned, header repeats automatically on every page
  autoTable(doc, {
    startY: 40,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => cellText(r[c.key], c))),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, { halign: c.currency || c.numeric ? 'right' : 'left' }])
    ),
    margin: { left: margin, right: margin },
    // Right-align the headings of numeric columns so they sit over their right-aligned figures
    didParseCell: (data) => {
      if (data.section === 'head') {
        const column = columns[data.column.index];
        if (column.currency || column.numeric) data.cell.styles.halign = 'right';
      }
    },
  });

  // Footer on every page, added after the table so the total page count is known
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('TrendMart Analytics System - Confidential, for internal use', margin, pageHeight - 8);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(filename);
}