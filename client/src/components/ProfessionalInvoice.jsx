import React from "react";
import { COMPANY } from "../config/constants";

const ProfessionalInvoice = ({ sale, onClose, onDownload }) => {
  const handlePrint = () => {
    // Trigger browser print dialog
    // Note: Browser will show "Save as PDF" if no printer is set as default
    // Users should select their printer from the destination dropdown
    window.print();
  };

  const handleDownload = async () => {
    if (onDownload) {
      await onDownload(sale._id, sale.invoiceNo);
    }
  };

  // Helper function to format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Helper function to format date + time
  const formatDateTime = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) + " " + d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "0.00";
    return Number(amount).toFixed(2);
  };

  // Calculate totals
  const subtotal =
    sale?.items?.reduce(
      (sum, item) =>
        sum + (item.qty || item.quantity || 0) * (item.saleRate || item.sellingPrice || item.rate || 0),
      0,
    ) || 0;
  const vat = sale?.vat || 0;
  const grandTotal = sale?.grandTotal || subtotal + vat;
  const paid = (sale?.cashPaid || 0) + (sale?.bankPaid || 0);
  const returnAmount = paid - grandTotal;

  // Invoice content component
  const InvoiceContent = () => (
    <div className="invoice-content bg-white p-6 max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-4 mb-4 p-4 rounded-lg">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img
              className="w-40 h-32 object-contain"
              src={COMPANY.LOGO_URL}
              alt={COMPANY.NAME}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = COMPANY.LOGO_FALLBACK;
              }}
            />
          </div>

          {/* Company Name - Larger and more prominent */}
          <div className="flex-grow text-center">
            <h1 className="text-5xl font-bold text-green-800 mb-2">
              {COMPANY.NAME}
            </h1>
            <div className="bg-orange-500 text-white px-6 py-2 inline-block text-base font-bold shadow-md">
              {COMPANY.TAGLINE}
            </div>
            <p className="text-sm text-green-800 mt-4 leading-relaxed font-medium px-4">
              All Kinds of Medical Equipment, Hospital Furniture, Pathological
              Reagent, Surgical Instrument, Import & Whole Sales, Service Order
              Supply
            </p>
          </div>
        </div>

        <div className="border-b-2 border-gray-300"></div>
      </header>

      {/* Bill To and Invoice Details */}
      <section className="mb-4">
        <div className="flex justify-between gap-6">
          {/* Bill To */}
          <div className="w-1/2">
            <h3 className="text-sm font-bold text-green-600 mb-2 uppercase flex items-center gap-1">
              <i className="fas fa-user text-xs"></i> Bill To
            </h3>
            <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
              <div className="mb-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Customer Name
                </label>
                <div className="font-semibold text-gray-900">
                  {sale?.customer?.name ||
                    sale?.customerName ||
                    "Cash Customer"}
                </div>
              </div>
              <div className="mb-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Address
                </label>
                <div className="text-gray-700 text-xs">
                  {sale?.customer?.address || 
                   sale?.customerAddress || 
                   (sale?.customer?.name && sale?.customer?.name !== "Cash Customer" ? "" : "")}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Phone
                </label>
                <div className="text-gray-700 text-xs">
                  {sale?.customer?.phone || 
                   sale?.customer?.mobile || 
                   sale?.customerPhone || 
                   sale?.customerMobile || 
                   (sale?.customer?.name && sale?.customer?.name !== "Cash Customer" ? "" : "")}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="w-1/2">
            <h3 className="text-sm font-bold text-green-600 mb-2 uppercase flex items-center gap-1">
              <i className="fas fa-receipt text-xs"></i> Invoice Details
            </h3>
            <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500">Invoice No:</span>
                <span className="font-mono font-bold text-gray-900 text-xs">
                  {sale?.invoiceNo || sale?.invoiceNumber || sale?._id?.toString()?.slice(-8) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500">Date & Time:</span>
                <span className="font-medium text-gray-900 text-xs">
                  {formatDateTime(sale?.saleDate || sale?.createdAt || sale?.date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Sale Type:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                  {sale?.salesType || sale?.saleType || sale?.customerType || "Retail"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Table */}
      <section className="mb-4">
        <div className="border border-gray-200 rounded">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="px-2 py-2 text-left font-medium uppercase w-12">
                  SL.
                </th>
                <th className="px-2 py-2 text-left font-medium uppercase">
                  Product Description
                </th>
                <th className="px-2 py-2 text-right font-medium uppercase w-16">
                  Qty
                </th>
                <th className="px-2 py-2 text-right font-medium uppercase w-24">
                  Rate (Tk)
                </th>
                <th className="px-2 py-2 text-right font-medium uppercase w-24">
                  Total (Tk)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {(sale?.items || []).map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="px-2 py-2 text-gray-500">
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium text-gray-900">
                      {item.name || item.productName}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {item.category || "Medical"} | SKU: {item.sku || "N/A"}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">
                    {item.quantity || item.qty}
                    {item.unit && (
                      <span className="text-[10px] text-gray-500 ml-0.5">
                        {item.unit}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">
                    {formatCurrency(
                      item.sellingPrice || item.saleRate || item.rate,
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-gray-900">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payment Information Strip */}
      <section className="mb-3">
        <div className="bg-gray-100 border border-gray-300 rounded p-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">
              <strong>Payment Method:</strong> {
                sale?.dueAmount > 0 && (sale?.cashPaid || 0) === 0 && (sale?.bankPaid || 0) === 0
                  ? "Due/Credit"
                  : sale?.paymentMethod || 
                    ((sale?.cashPaid || 0) > 0 && (sale?.bankPaid || 0) > 0 
                      ? "Cash + Bank" 
                      : (sale?.bankPaid || 0) > 0 
                        ? "Bank" 
                        : "Cash")
              }
            </span>
            <span className="text-gray-700">
              <strong>Cash Paid:</strong> Tk {formatCurrency(sale?.cashPaid || 0)}
            </span>
            <span className="text-gray-700">
              <strong>Bank Paid:</strong> Tk {formatCurrency(sale?.bankPaid || 0)}
            </span>
            {(sale?.changeAmount > 0 || sale?.returnAmount > 0 || returnAmount > 0) && (
              <span className="text-gray-700">
                <strong>Change:</strong> Tk {formatCurrency(sale?.changeAmount || sale?.returnAmount || returnAmount)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <section className="mb-4">
        <div className="flex justify-between gap-6">
          {/* Terms */}
          <div className="w-1/2">
            <div className="bg-blue-50 p-3 rounded border border-blue-100">
              <p className="text-[10px] text-blue-800 font-semibold mb-1">
                Terms & Conditions:
              </p>
              <ul className="text-[10px] text-blue-700 list-disc list-inside space-y-0.5">
                <li>Goods once sold will not be taken back.</li>
                <li>Warranty as per manufacturer policy.</li>
                <li>Payment is due upon receipt.</li>
              </ul>
            </div>
          </div>

          {/* Totals */}
          <div className="w-1/2">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">
                  Tk {formatCurrency(sale?.subtotal || subtotal)}
                </span>
              </div>
              {(sale?.discountAmount > 0 || sale?.discount > 0) && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-red-600">
                    -Tk {formatCurrency(sale?.discountAmount || sale?.discount)}
                  </span>
                </div>
              )}
              {sale?.vatAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    VAT ({sale?.vatPercent || 0}%)
                  </span>
                  <span className="font-medium">
                    Tk {formatCurrency(sale?.vatAmount)}
                  </span>
                </div>
              )}
              <div className="border-t border-dashed border-gray-300 pt-2"></div>
              <div className="flex justify-between text-base font-bold text-green-600">
                <span>Grand Total</span>
                <span>Tk {formatCurrency(sale?.grandTotal || grandTotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Paid</span>
                <span className="font-medium text-green-700">
                  Tk {formatCurrency((sale?.cashPaid || 0) + (sale?.bankPaid || 0))}
                </span>
              </div>
              {(sale?.changeAmount > 0 || sale?.returnAmount > 0 || returnAmount > 0) && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Return</span>
                  <span className="font-medium">
                    Tk {formatCurrency(sale?.changeAmount || sale?.returnAmount || returnAmount)}
                  </span>
                </div>
              )}

              {/* ── Previous Due System ── */}
              {(sale?.dueAmount > 0 || sale?.previousDue > 0 || sale?.totalOutstanding > 0) && (
                <>
                  <div className="border-t border-dashed border-gray-300 pt-2"></div>

                  {/* Current sale due */}
                  {(sale?.dueAmount > 0) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">This Sale Due</span>
                      <span className="font-semibold text-orange-600">
                        Tk {formatCurrency(sale.dueAmount)}
                      </span>
                    </div>
                  )}

                  {/* Previous due from earlier sales */}
                  {(sale?.previousDue > 0) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Previous Due</span>
                      <span className="font-semibold text-orange-600">
                        Tk {formatCurrency(sale.previousDue)}
                      </span>
                    </div>
                  )}

                  {/* Total outstanding — shown only when there's a previous due */}
                  {(sale?.previousDue > 0 && sale?.dueAmount > 0) && (
                    <div className="flex justify-between text-sm font-bold border-t border-red-200 pt-2 mt-1">
                      <span className="text-red-700">Total Outstanding</span>
                      <span className="text-red-700">
                        Tk {formatCurrency(sale?.totalOutstanding || (sale.previousDue + sale.dueAmount))}
                      </span>
                    </div>
                  )}

                  {/* Only previous due (current sale fully paid) */}
                  {(sale?.previousDue > 0 && !(sale?.dueAmount > 0)) && (
                    <div className="flex justify-between text-sm font-bold border-t border-red-200 pt-2 mt-1">
                      <span className="text-red-700">Total Outstanding</span>
                      <span className="text-red-700">
                        Tk {formatCurrency(sale.previousDue)}
                      </span>
                    </div>
                  )}

                  {/* Only current due (no previous due) */}
                  {(!(sale?.previousDue > 0) && sale?.dueAmount > 0) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-semibold">Due</span>
                      <span className="font-bold text-red-600">
                        Tk {formatCurrency(sale.dueAmount)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="mt-8 flex justify-between items-end">
          <div className="text-center">
            <div className="h-10 w-40 border-b-2 border-gray-400 mb-1"></div>
            <div className="text-xs font-bold text-gray-700">
              Authorized Signature
            </div>
          </div>
        </div>
      </section>

      {/* Shop Contact Footer */}
      <footer className="mt-4 pt-3 border-t border-gray-300 text-center">
        <div className="text-xs text-gray-600">
          <p className="mb-1">
            <strong>Contact:</strong> Phone: {COMPANY.PHONE} | Email: {COMPANY.EMAIL}
          </p>
          <p className="text-[10px] text-gray-500 italic">
            Thank you for your business! This is a computer generated invoice — no signature required.
          </p>
        </div>
      </footer>
    </div>
  );

  return (
    <>
      {/* Print Styles - Compact Layout for 12-15 Products per Page */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0.8cm 1.2cm 0.8cm 1.2cm;
          }
          
          body * { visibility: hidden; }
          .invoice-content, .invoice-content * { visibility: visible; }
          .invoice-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .print-hide { display: none !important; }
          
          /* Compact spacing */
          .invoice-content header { margin-bottom: 0.2cm !important; }
          .invoice-content section { margin-bottom: 0.2cm !important; }
          .invoice-content .mb-4 { margin-bottom: 0.2cm !important; }
          .invoice-content .mb-3 { margin-bottom: 0.15cm !important; }
          .invoice-content .mb-2 { margin-bottom: 0.12cm !important; }
          .invoice-content .mb-1 { margin-bottom: 0.08cm !important; }
          .invoice-content .mt-8 { margin-top: 0.3cm !important; }
          .invoice-content .mt-5 { margin-top: 0.2cm !important; }
          .invoice-content .mt-4 { margin-top: 0.2cm !important; }
          .invoice-content .mt-3 { margin-top: 0.15cm !important; }
          .invoice-content .mt-2 { margin-top: 0.12cm !important; }
          .invoice-content .mt-1 { margin-top: 0.08cm !important; }
          .invoice-content .pt-3 { padding-top: 0.15cm !important; }
          
          /* Compact padding */
          .invoice-content .p-6 { padding: 0.2cm !important; }
          .invoice-content .p-4 { padding: 0.2cm !important; }
          .invoice-content .p-3 { padding: 0.15cm !important; }
          .invoice-content .p-2 { padding: 0.08cm !important; }
          .invoice-content .py-2 { padding-top: 0.08cm !important; padding-bottom: 0.08cm !important; }
          .invoice-content .py-1 { padding-top: 0.05cm !important; padding-bottom: 0.05cm !important; }
          .invoice-content .px-4 { padding-left: 0.15cm !important; padding-right: 0.15cm !important; }
          .invoice-content .px-2 { padding-left: 0.12cm !important; padding-right: 0.12cm !important; }
          
          /* Compact gaps */
          .invoice-content .gap-6 { gap: 0.3cm !important; }
          .invoice-content .gap-4 { gap: 0.25cm !important; }
          .invoice-content .gap-1 { gap: 0.08cm !important; }
          .invoice-content .space-y-2 > * + * { margin-top: 0.1cm !important; }
          .invoice-content .space-y-0\\.5 > * + * { margin-top: 0.05cm !important; }
          
          /* Header - Compact */
          .invoice-content header img { width: 100px !important; height: 80px !important; }
          .invoice-content header h1 { font-size: 28pt !important; line-height: 1.2 !important; font-weight: bold !important; }
          .invoice-content header .text-sm { font-size: 9pt !important; line-height: 1.3 !important; }
          .invoice-content .inline-block { padding: 4px 12px !important; font-size: 10pt !important; font-weight: bold !important; }
          
          /* All font sizes - Compact but readable */
          .invoice-content .text-4xl { font-size: 20pt !important; line-height: 1.1 !important; }
          .invoice-content .text-base { font-size: 12pt !important; line-height: 1.2 !important; }
          .invoice-content .text-sm { font-size: 9pt !important; line-height: 1.2 !important; }
          .invoice-content .text-xs { font-size: 9pt !important; line-height: 1.2 !important; }
          .invoice-content .text-\\[10px\\] { font-size: 8pt !important; line-height: 1.2 !important; }
          
          /* Bill To and Invoice Details sections - Compact */
          .invoice-content .w-1\\/2 h3 { 
            font-size: 9pt !important; 
            font-weight: bold !important; 
            margin-bottom: 0.1cm !important;
          }
          .invoice-content .w-1\\/2 label { 
            font-size: 7.5pt !important; 
            font-weight: bold !important;
          }
          .invoice-content .w-1\\/2 .font-semibold { font-size: 9pt !important; }
          .invoice-content .w-1\\/2 .font-bold { font-size: 9pt !important; }
          .invoice-content .w-1\\/2 .font-medium { font-size: 9pt !important; }
          .invoice-content .w-1\\/2 .text-gray-700 { font-size: 9pt !important; }
          .invoice-content .w-1\\/2 .text-gray-900 { font-size: 9pt !important; }
          .invoice-content .w-1\\/2 .text-xs { font-size: 9pt !important; }
          
          /* Table - COMPACT (KEY: fits more products) */
          .invoice-content table { font-size: 9pt !important; }
          .invoice-content thead th { 
            padding: 4px 6px !important; 
            font-size: 9pt !important; 
            font-weight: bold !important;
          }
          .invoice-content tbody td { 
            padding: 3px 6px !important; 
            font-size: 9pt !important; 
            line-height: 1.2 !important; 
          }
          .invoice-content tbody td .font-medium { 
            font-size: 9pt !important; 
            font-weight: 600 !important;
          }
          /* HIDE Category/SKU line in print to save space */
          .invoice-content tbody td .text-\\[10px\\] { 
            display: none !important;
          }
          
          /* Payment Information Strip - Compact */
          .invoice-content .bg-gray-100 { 
            background-color: #f3f4f6 !important;
            font-size: 8pt !important;
            padding: 3px 6px !important;
          }
          
          /* Totals section - Compact but prominent */
          .invoice-content .space-y-2 { font-size: 9pt !important; }
          .invoice-content .space-y-2 .text-base { 
            font-size: 12pt !important; 
            font-weight: bold !important; 
          }
          .invoice-content .space-y-2 .text-sm { font-size: 9.5pt !important; font-weight: bold !important; }
          .invoice-content .space-y-2 .text-xs { font-size: 9pt !important; }
          
          /* Terms section - Compact */
          .invoice-content .bg-blue-50 { padding: 0.15cm !important; }
          .invoice-content .bg-blue-50 p { font-size: 7.5pt !important; }
          .invoice-content .bg-blue-50 li { font-size: 7.5pt !important; }
          
          /* Signature section - Compact */
          .invoice-content .h-10 { height: 25px !important; }
          .invoice-content .w-40 { width: 100px !important; }
          .invoice-content .text-center .text-xs { font-size: 8pt !important; }
          
          /* Footer section - Compact */
          .invoice-content footer { 
            margin-top: 0.2cm !important;
            padding-top: 0.15cm !important;
          }
          .invoice-content footer .text-xs { font-size: 8pt !important; }
          .invoice-content footer .text-\\[10px\\] { font-size: 8pt !important; }
          
          /* Colors - ensure they print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .bg-green-600 { background-color: #16a34a !important; color: white !important; }
          .bg-orange-500 { background-color: #f97316 !important; color: white !important; }
          .bg-gray-50 { background-color: #f9fafb !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-green-100 { background-color: #dcfce7 !important; }
          .text-green-600 { color: #16a34a !important; }
          .text-green-800 { color: #166534 !important; }
          .text-green-700 { color: #15803d !important; }
          .text-red-600 { color: #dc2626 !important; }
          .text-red-700 { color: #b91c1c !important; }
          .text-orange-600 { color: #ea580c !important; }
          .text-blue-800 { color: #1e40af !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
          .text-gray-400 { color: #9ca3af !important; }
          .text-gray-500 { color: #6b7280 !important; }
          .text-gray-600 { color: #4b5563 !important; }
          .text-gray-700 { color: #374151 !important; }
          .text-gray-900 { color: #111827 !important; }
          
          /* Page break control */
          .invoice-content { page-break-inside: avoid !important; }
          .invoice-content header, .invoice-content section { page-break-inside: avoid !important; }
          * { box-shadow: none !important; }
          .rounded, .rounded-lg { border-radius: 2px !important; }
          
          /* Border visibility */
          .border { border-width: 1px !important; }
          .border-b { border-bottom-width: 1px !important; }
          .border-b-2 { border-bottom-width: 2px !important; }
          .border-t { border-top-width: 1px !important; }
          .border-gray-200 { border-color: #e5e7eb !important; }
          .border-gray-300 { border-color: #d1d5db !important; }
          .border-gray-400 { border-color: #9ca3af !important; }
          .border-red-200 { border-color: #fecaca !important; }
          .border-blue-100 { border-color: #dbeafe !important; }
        }
      `}</style>

      {/* Modal Overlay - Hidden in Print */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print-hide">
        <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
            <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
            <div className="flex gap-3">
              {onDownload && (
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-download"></i>
                  Download PDF
                </button>
              )}
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-print"></i>
                Print Invoice
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          {/* Invoice Preview in Modal */}
          <div className="p-6">
            <InvoiceContent />
          </div>
        </div>
      </div>

      {/* Hidden Invoice for Print - Outside Modal */}
      <div className="hidden print:block">
        <InvoiceContent />
      </div>
    </>
  );
};

export default ProfessionalInvoice;
