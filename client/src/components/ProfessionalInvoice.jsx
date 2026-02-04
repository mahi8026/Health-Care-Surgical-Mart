import React from "react";

const ProfessionalInvoice = ({ sale, onClose }) => {
  const handlePrint = () => {
    window.print();
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

  // Helper function to format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "0.00";
    return Number(amount).toFixed(2);
  };

  // Calculate totals
  const subtotal =
    sale?.items?.reduce(
      (sum, item) =>
        sum + (item.qty || item.quantity) * (item.saleRate || item.rate),
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
        <div className="flex items-center bg-gradient-to-r from-green-800 to-green-300 justify-between gap-4 mb-4 p-4 rounded-lg">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img
              className="w-28 h-20"
              src="https://i.ibb.co.com/GvmSMXXM/Untitled-design-1.png"
              alt="logo"
            />
          </div>

          {/* Company Name */}
          <div className="flex-grow text-center">
            <h1 className="text-3xl font-bold text-white">
              Health Care Surgical Mart
            </h1>
            <div className="bg-orange-500 text-white px-4 py-1 inline-block mt-1 text-sm font-medium">
              A Trust Medical Equipment Company
            </div>
            <p className="text-[10px] text-white mt-2 leading-tight">
              All Kinds of Medical Equipment, Hospital Furniture, Pathological
              Reagent, Surgical Instrument, Import & Whole Sales, Service Order
              Supply
            </p>
          </div>
        </div>

        <div className="border-b border-gray-300"></div>
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
                  {sale?.customer?.address || "N/A"}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Phone
                </label>
                <div className="text-gray-700 text-xs">
                  {sale?.customer?.phone || "N/A"}
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
                  {sale?.invoiceNo || sale?.invoiceNumber || "N/A"}
                </span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500">Date:</span>
                <span className="font-medium text-gray-900 text-xs">
                  {formatDate(sale?.saleDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Sale Type:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                  Retail
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
                  Rate (৳)
                </th>
                <th className="px-2 py-2 text-right font-medium uppercase w-24">
                  Total (৳)
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
                  {formatCurrency(sale?.subtotal || subtotal)} ৳
                </span>
              </div>
              {(sale?.discountAmount > 0 || sale?.discount > 0) && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(sale?.discountAmount || sale?.discount)} ৳
                  </span>
                </div>
              )}
              {sale?.vatAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    VAT ({sale?.vatPercent || 0}%)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(sale?.vatAmount)} ৳
                  </span>
                </div>
              )}
              <div className="border-t border-dashed border-gray-300 pt-2"></div>
              <div className="flex justify-between text-base font-bold text-green-600">
                <span>Grand Total</span>
                <span>{formatCurrency(sale?.grandTotal || grandTotal)} ৳</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Paid</span>
                <span className="font-medium">
                  {formatCurrency(
                    (sale?.cashPaid || 0) + (sale?.bankPaid || 0),
                  )}{" "}
                  ৳
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Return</span>
                <span className="font-medium">
                  {formatCurrency(
                    sale?.changeAmount || sale?.returnAmount || returnAmount,
                  )}{" "}
                  ৳
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="mt-8 flex justify-between items-end">
          <div className="text-[10px] text-gray-400 italic">
            Computer generated invoice
          </div>
          <div className="text-center">
            <div className="h-10 w-40 border-b-2 border-gray-400 mb-1"></div>
            <div className="text-xs font-bold text-gray-700">
              Authorized Signature
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0.3cm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .invoice-content,
          .invoice-content * {
            visibility: visible;
          }
          
          .invoice-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0.3cm !important;
            margin: 0 !important;
          }
          
          .print-hide {
            display: none !important;
          }
          
          /* Reduce all spacing for print */
          .invoice-content header {
            margin-bottom: 0.3cm !important;
          }
          
          .invoice-content section {
            margin-bottom: 0.3cm !important;
          }
          
          .invoice-content .mb-4 {
            margin-bottom: 0.2cm !important;
          }
          
          .invoice-content .mb-3 {
            margin-bottom: 0.15cm !important;
          }
          
          .invoice-content .mb-2 {
            margin-bottom: 0.1cm !important;
          }
          
          .invoice-content .mt-8 {
            margin-top: 0.3cm !important;
          }
          
          .invoice-content .p-6 {
            padding: 0.2cm !important;
          }
          
          .invoice-content .p-3 {
            padding: 0.15cm !important;
          }
          
          .invoice-content .gap-6 {
            gap: 0.3cm !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .bg-green-600 {
            background-color: #16a34a !important;
            color: white !important;
          }
          
          .bg-orange-500 {
            background-color: #f97316 !important;
            color: white !important;
          }
          
          .bg-gradient-to-r {
            background: linear-gradient(to right, #166534, #86efac) !important;
          }
          
          .from-green-800 {
            --tw-gradient-from: #166534 !important;
          }
          
          .to-green-300 {
            --tw-gradient-to: #86efac !important;
          }
          
          .bg-gray-50 {
            background-color: #f9fafb !important;
          }
          
          .bg-blue-50 {
            background-color: #eff6ff !important;
          }
          
          .text-green-600 {
            color: #16a34a !important;
          }
          
          .text-green-700 {
            color: #15803d !important;
          }
          
          .text-red-600 {
            color: #dc2626 !important;
          }
          
          .text-blue-800 {
            color: #1e40af !important;
          }
          
          .text-blue-700 {
            color: #1d4ed8 !important;
          }
          
          .border-green-600 {
            border-color: #16a34a !important;
          }
        }
      `}</style>

      {/* Modal Overlay - Hidden in Print */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print-hide">
        <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
            <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
            <div className="flex gap-3">
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
