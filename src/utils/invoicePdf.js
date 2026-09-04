import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawLetterhead, letterheadAutoTableHook, finalizeFooters, LETTERHEAD_MARGIN } from './pdfBrand';
import { BUSINESS_INFO, BANK_DETAILS } from './invoiceBrand';
import { safeFixed, amountToWords } from './money';

// Crash-proof currency formatter for the PDF — mirrors utils/money.js so a
// missing/undefined price (e.g. an imported medicine with a blank price
// column) prints as 0.00 instead of throwing and silently failing to
// generate the PDF at all.
//
// "Rs." (text) stands in for the ₹ symbol: jsPDF's built-in "helvetica"
// font carries no glyph for ₹, so leading an amount with it prints as a
// broken/empty box. "Rs." reads unambiguously as rupees without that
// rendering problem.
const money = (currencySymbol, value) => {
  const label = currencySymbol === '₹' ? 'Rs.' : currencySymbol;
  return `${label}${safeFixed(value)}`;
};

// A generously tall scratch height used only to measure how much vertical
// space the invoice actually needs — see buildInvoiceDoc below.
const PROBE_HEIGHT = 3000;
const PAGE_WIDTH = 595.28; // A4 width in pt, kept fixed either way
const BOTTOM_RESERVE = 46; // room for the footer band below the last content

/**
 * Draws the full invoice body onto `doc` starting at the top of the page,
 * and returns the Y position where content ends (before the footer). Pure
 * function of (doc, order, opts) so it can be run twice: once on a tall
 * scratch page purely to measure the content height, then again on the
 * real, exactly-sized page — which is how the PDF ends up as one page
 * with no leftover blank space at the bottom.
 */
function renderInvoiceContent(doc, order, { currencySymbol = '₹' } = {}) {
  const margin = LETTERHEAD_MARGIN;
  let y = drawLetterhead(doc, { reportTitle: 'Tax Invoice', subtitle: order.orderNumber });

  // Business identity line (address, contact, GST/PAN/CIN) under the letterhead band.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(BUSINESS_INFO.addressLine, margin, y);
  doc.text(`Contact: ${BUSINESS_INFO.contactLine}`, margin, y + 11);
  doc.text(`${BUSINESS_INFO.gst} | ${BUSINESS_INFO.pan} | ${BUSINESS_INFO.cin}`, margin, y + 22);
  doc.setTextColor(30, 41, 59);
  y += 38;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Bill To', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const custLines = [
    order.customer?.name,
    order.customer?.address,
    [order.customer?.city, order.customer?.pincode].filter(Boolean).join(' — '),
    order.customer?.phone,
    order.customer?.email,
  ].filter(Boolean);
  custLines.forEach((line, idx) => doc.text(String(line), margin, y + 13 + idx * 12));

  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Order Details', rightX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  // Invoice No. (distinct from the order number), place of supply, and the
  // payment/order status lines — the extra fields a real tax invoice needs
  // beyond just "here's the order".
  const orderLines = [
    `Invoice No.: INV-${order.orderNumber}`,
    `Invoice date: ${new Date(order.createdAt).toLocaleDateString()}`,
    `Place of supply: ${BUSINESS_INFO.placeOfSupply}`,
    `Payment mode: ${order.paymentMethod}`,
    `Payment status: ${order.paymentStatus}`,
    `Order status: ${order.status}`,
  ];
  orderLines.forEach((line, idx) => doc.text(line, rightX, y + 13 + idx * 12, { align: 'right' }));

  const tableStartY = y + 13 + Math.max(custLines.length, orderLines.length) * 12 + 14;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['#', 'Medicine', 'Batch', 'Qty', 'Unit Price', 'Total']],
    body: (order.items || []).map((item, idx) => [
      idx + 1,
      item.medicine_name,
      item.batch_number || '—',
      item.quantity,
      money(currencySymbol, item.unit_price),
      money(currencySymbol, item.line_total),
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [4, 120, 87], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 253, 249] },
    didDrawPage: letterheadAutoTableHook(doc, { reportTitle: 'Tax Invoice', subtitle: order.orderNumber }),
  });

  // Order Journey — the full cart-to-delivery timeline (Placed → ... →
  // current status), so the invoice documents the whole order lifecycle,
  // not just the final line items. Falls back to a single "Placed" row
  // built from createdAt if statusHistory wasn't populated (e.g. legacy
  // orders), so this section never silently disappears.
  const journeyRows =
    Array.isArray(order.statusHistory) && order.statusHistory.length > 0
      ? order.statusHistory
      : [{ status: order.status || 'Placed', changedAt: order.createdAt, changedByName: order.placedByName || '—' }];

  let journeyY = (doc.lastAutoTable?.finalY || tableStartY) + 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(4, 120, 87);
  doc.text('Order Journey', margin, journeyY);
  doc.setTextColor(30, 41, 59);

  autoTable(doc, {
    startY: journeyY + 6,
    margin: { left: margin, right: margin },
    head: [['Status', 'Date & Time', 'Updated By', 'Note']],
    body: journeyRows.map((h) => [
      h.status || '—',
      h.changedAt ? new Date(h.changedAt).toLocaleString() : '—',
      h.changedByName || '—',
      h.note || '—',
    ]),
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: letterheadAutoTableHook(doc, { reportTitle: 'Tax Invoice', subtitle: order.orderNumber }),
  });

  let summaryY = (doc.lastAutoTable?.finalY || journeyY) + 20;
  const summaryX = rightX - 170;

  // Bank details, left-aligned, sitting alongside the totals block.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(4, 120, 87);
  doc.text('Our Bank Details', margin, summaryY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const bankLines = [
    `Bank Name: ${BANK_DETAILS.bankName}`,
    `Branch: ${BANK_DETAILS.branch}`,
    `Account No.: ${BANK_DETAILS.accountNo}`,
    `IFSC Code: ${BANK_DETAILS.ifsc}`,
  ];
  bankLines.forEach((line, idx) => doc.text(line, margin, summaryY + 13 + idx * 11));

  const rows = [
    ['Subtotal', money(currencySymbol, order.subtotal)],
    [`GST (${Math.round((order.taxRate || 0) * 100)}%)`, money(currencySymbol, order.taxAmount)],
  ];
  doc.setFontSize(9.5);
  rows.forEach(([label, value], idx) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, summaryX, summaryY + idx * 14);
    doc.text(value, rightX, summaryY + idx * 14, { align: 'right' });
  });
  summaryY += rows.length * 14 + 5;
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX, summaryY - 9, rightX, summaryY - 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(4, 120, 87);
  doc.text('Total Payable', summaryX, summaryY + 6);
  doc.text(money(currencySymbol, order.grandTotal), rightX, summaryY + 6, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  summaryY += 12;

  // Amount in words — standard on Indian tax invoices, and useful extra
  // information beyond the raw figures above.
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  const wordsLine = `Amount in words: ${amountToWords(order.grandTotal)}`;
  const wordsWrapped = doc.splitTextToSize(wordsLine, rightX - summaryX);
  doc.text(wordsWrapped, summaryX, summaryY + 10);
  doc.setTextColor(30, 41, 59);

  const bankBlockBottom = summaryY - (rows.length * 14 + 5) - 12 + 13 + bankLines.length * 11;
  const wordsBlockBottom = summaryY + 10 + wordsWrapped.length * 9;
  const bottomY = Math.max(bankBlockBottom, wordsBlockBottom) + 16;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, bottomY, rightX, bottomY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Terms & Conditions:', margin, bottomY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  const termsLines = doc.splitTextToSize(BUSINESS_INFO.terms, rightX - margin - 130);
  doc.text(termsLines, margin, bottomY + 25);

  // Sample signature — a stylised, italic script rendering of the
  // signatory's name sitting just above the signature line, so the
  // invoice doesn't ship with a bare unsigned line.
  doc.setFont('times', 'italic');
  doc.setFontSize(20);
  doc.setTextColor(6, 78, 59);
  doc.text(BUSINESS_INFO.signatoryName, rightX, bottomY + 38, { align: 'right' });
  doc.setTextColor(30, 41, 59);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`For ${BUSINESS_INFO.name}`, rightX, bottomY + 12, { align: 'right' });
  doc.setDrawColor(148, 163, 184);
  doc.line(rightX - 130, bottomY + 46, rightX, bottomY + 46);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${BUSINESS_INFO.signatoryName} — ${BUSINESS_INFO.signatoryTitle}`, rightX, bottomY + 56, { align: 'right' });
  doc.setTextColor(30, 41, 59);

  const contentEndY = Math.max(bottomY + 56, bottomY + 25 + termsLines.length * 9.5);
  return contentEndY;
}

/**
 * Builds the tax-invoice PDF for a single order, reusing the shared
 * MediStock letterhead/footer so it looks like every other report the app
 * generates. Returns the jsPDF document — caller decides whether to save
 * it, open it, or turn it into a Blob for sharing.
 *
 * The page height is sized to the content in two passes: a scratch,
 * generously-tall page measures exactly how far the content runs, then the
 * real page is created at that height (plus room for the footer). That's
 * what keeps a normal invoice to a single page with no dead space at the
 * bottom, instead of a fixed A4 page with a half-empty second half.
 */
export function buildInvoiceDoc(order, opts = {}) {
  const probe = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, PROBE_HEIGHT] });
  const contentEndY = renderInvoiceContent(probe, order, opts);

  const pageHeight = Math.min(PROBE_HEIGHT, Math.max(contentEndY + BOTTOM_RESERVE, 400));
  const doc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, pageHeight] });
  renderInvoiceContent(doc, order, opts);
  finalizeFooters(doc);
  return doc;
}

export function downloadInvoicePdf(order, opts) {
  const doc = buildInvoiceDoc(order, opts);
  doc.save(`Invoice-${order.orderNumber}.pdf`);
}

export function openInvoicePdf(order, opts) {
  const doc = buildInvoiceDoc(order, opts);
  // `dataurlnewwindow` silently fails in several browsers (Safari, and any
  // popup blocker) once the PDF exceeds the data-URL size some browsers
  // tolerate for a new tab — the tab opens blank with no visible error.
  // A Blob object URL is far smaller and universally supported, so the
  // invoice reliably renders instead of appearing "not visible".
  const blobUrl = doc.output('bloburl');
  const win = window.open(blobUrl, '_blank', 'noopener');
  if (!win) {
    // Popup blocked outright — fall back to a same-tab download so the
    // person can still get to the invoice.
    doc.save(`Invoice-${order.orderNumber}.pdf`);
  }
}

export async function invoicePdfBlob(order, opts) {
  const doc = buildInvoiceDoc(order, opts);
  return doc.output('blob');
}
