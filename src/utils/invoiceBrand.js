// Shared invoice identity used by both the in-app invoice preview
// (OrderDetail) and the downloadable PDF (utils/invoicePdf.js), so the two
// never drift out of sync. Update here once and both surfaces pick it up.

export const BUSINESS_INFO = {
  name: 'MediStock',
  tagline: 'Medicine Stock Intelligence — trusted pharmacy inventory & billing',
  addressLine: '221B Health Avenue, MedPark Complex, Bengaluru - 560001',
  contactLine: '+91-9876543210 | support@medistock.in',
  gst: 'GSTIN: 29ABCDE1234F1Z5',
  pan: 'PAN: ABCDE1234F',
  placeOfSupply: 'Karnataka (29)',
  cin: 'CIN: U74999KA2019PTC123456',
  terms: 'This invoice is valid for the medicine(s) mentioned above. Please verify batch and expiry details on delivery. Goods once sold are exchangeable only per return policy. Subject to Bengaluru jurisdiction. E. & O.E.',
  signatoryName: 'Dr. Ramesh Iyer',
  signatoryTitle: 'Pharmacist-in-Charge',
};

export const BANK_DETAILS = {
  bankName: 'HDFC Bank',
  branch: 'MG Road, Bengaluru',
  accountNo: '50100123456789',
  ifsc: 'HDFC0000123',
};
