// Shared MediStock PDF letterhead.
//
// Previously, report PDFs drew a plain text title block (title / generated
// date / date range / summary) followed immediately by the data table's own
// coloured head row — the two sat back-to-back and read as two separate,
// mismatched "headers", and only the table head repeated on later pages.
//
// This module draws ONE consistent, branded header band (with a vector
// MediStock logo — no external image asset required) plus a matching footer
// with page numbers, applied uniformly to every page via autoTable's
// `didDrawPage` hook (or manually for non-table PDFs).

const BRAND = {
  primaryDark: [6, 78, 59],    // deep forest green (emerald-900)
  primary: [4, 120, 87],       // emerald-700
  primaryLight: [52, 211, 153], // emerald-400
  ink: [30, 41, 59],
  muted: [100, 116, 139],
};

const HEADER_HEIGHT = 62;
const MARGIN = 40;

/**
 * Draws the MediStock logo mark: a rounded blue tile with a plus/cross
 * glyph, matching the in-app BrandMark component, entirely with vector
 * primitives (no raster asset, so it never fails to load).
 */
function drawLogoMark(doc, x, y, size = 34) {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, size, size, size * 0.28, size * 0.28, 'F');

  doc.setFillColor(...BRAND.primary);
  const inset = size * 0.14;
  const innerSize = size - inset * 2;
  doc.roundedRect(x + inset, y + inset, innerSize, innerSize, innerSize * 0.3, innerSize * 0.3, 'F');

  // Plus / cross glyph
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(size * 0.09);
  doc.setLineCap('round');
  const cx = x + size / 2;
  const cy = y + size / 2;
  const arm = size * 0.19;
  doc.line(cx, cy - arm, cx, cy + arm);
  doc.line(cx - arm, cy, cx + arm, cy);
}

/**
 * Draws the single, repeated header band for the given page. Call this
 * once per page (directly for page 1, and from an autoTable `didDrawPage`
 * hook for subsequent pages so tables stay in sync).
 */
export function drawLetterhead(doc, { reportTitle = 'Report', subtitle = '' } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND.primaryDark);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, HEADER_HEIGHT - 3, pageWidth, 3, 'F');

  drawLogoMark(doc, MARGIN, 14, 34);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MediStock', MARGIN + 44, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setCharSpace(0.6);
  doc.text('MEDICINE STOCK INTELLIGENCE', MARGIN + 44, 40);
  doc.setCharSpace(0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(reportTitle, pageWidth - MARGIN, 27, { align: 'right' });
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(subtitle, pageWidth - MARGIN, 39, { align: 'right' });
  }

  doc.setTextColor(...BRAND.ink);
  doc.setCharSpace(0);
  return HEADER_HEIGHT + 18; // suggested Y to start body content on page 1
}

/** Draws the shared footer (page number + generation timestamp). */
export function drawFooter(doc, pageNumber, pageCount) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 22;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y - 10, pageWidth - MARGIN, y - 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text('MediStock — Medicine Stock Intelligence', MARGIN, y);
  doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - MARGIN, y, { align: 'right' });
  doc.setTextColor(...BRAND.ink);
}

/**
 * Convenience hook factory for jspdf-autotable's `didDrawPage`: draws the
 * letterhead + footer on every page the table spans, and returns the Y
 * position where the table body should begin.
 */
export function letterheadAutoTableHook(doc, { reportTitle, subtitle }) {
  return (data) => {
    drawLetterhead(doc, { reportTitle, subtitle });
    const pageCount = doc.internal.getNumberOfPages();
    drawFooter(doc, data.pageNumber, pageCount);
  };
}

/** After the document is fully built, backfills the correct total page count in every footer. */
export function finalizeFooters(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    drawFooter(doc, i, pageCount);
  }
}

export const LETTERHEAD_HEIGHT = HEADER_HEIGHT;
export const LETTERHEAD_MARGIN = MARGIN;
