import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ProfessionalInvoice from "../components/ProfessionalInvoice";
import SearchableProductSelect from "../components/SearchableProductSelect";

const Sales = () => {
  // State management
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  // POS Form State
  const [posData, setPosData] = useState({
    invoiceNo: `INV-${Date.now()}`,
    employee: "Current User",
    reference: "",
    saleDate: new Date().toISOString().split("T")[0],
    saleType: "Retail",
    customerName: "Cash Customer",
    customerMobile: "",
    customerAddress: "",
    selectedProduct: "",
    customProductName: "",
    saleRate: "",
    quantity: "",
    discount: 0,
    discountPercent: 0,
    vat: 0,
    vatPercent: 0,
    cashPaid: 0,
    bankPaid: 0,
  });

  // Fetch products for POS
  const fetchProducts = async () => {
    try {
      // Use real authenticated endpoint
      const response = await apiService.get("/products");

      if (response.success) {
        // Filter to only show products with stock > 0 for POS
        const availableProducts = response.data.filter(
          (p) => p.stockQuantity > 0,
        );
        setProducts(availableProducts);
      } else {
        console.error("Failed to fetch products:", response.message);
        setProducts([]);
      }
    } catch (error) {
      console.error("Fetch products error:", error);
      if (error.message?.includes("401")) {
        // Redirect to login
        window.location.href = "/login";
      }
      setProducts([]);
    }
  };

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      // Use real authenticated endpoint
      const response = await apiService.get("/customers");

      if (response.success) {
        // Apply search filter on frontend if needed
        let filteredCustomers = response.data;
        if (customerSearchTerm) {
          filteredCustomers = filteredCustomers.filter(
            (customer) =>
              customer.name
                .toLowerCase()
                .includes(customerSearchTerm.toLowerCase()) ||
              customer.phone.includes(customerSearchTerm) ||
              (customer.email &&
                customer.email
                  .toLowerCase()
                  .includes(customerSearchTerm.toLowerCase())),
          );
        }
        setCustomers(filteredCustomers.slice(0, 20)); // Limit to 20 results
      } else {
        console.error("Failed to fetch customers:", response.message);
        setCustomers([]);
      }
    } catch (error) {
      console.error("Fetch customers error:", error);
      setCustomers([]);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchTerm]);

  useEffect(() => {
    fetchCustomers();
  }, [customerSearchTerm]);

  // Handle form changes
  const handlePosDataChange = (field, value) => {
    setPosData((prev) => ({ ...prev, [field]: value }));
  };

  // Add product to cart
  const addToCart = () => {
    if (!posData.quantity || !posData.saleRate) {
      setError("Please enter quantity and sale rate");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (!posData.customProductName.trim()) {
      setError("Please enter product name");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const quantity = parseFloat(posData.quantity);
    const rate = parseFloat(posData.saleRate);

    // Check stock only if a product from inventory is selected
    if (posData.selectedProduct) {
      const product = products.find((p) => p._id === posData.selectedProduct);
      if (product && quantity > product.stockQuantity) {
        setError(`Only ${product.stockQuantity} units available in stock`);
        setTimeout(() => setError(""), 3000);
        return;
      }
    }

    // Use custom product name or generate unique ID for custom items
    const productId = posData.selectedProduct || `custom-${Date.now()}`;
    const productName = posData.customProductName.trim();

    const existingItemIndex = cart.findIndex(
      (item) => item.productId === productId && item.name === productName,
    );

    if (existingItemIndex >= 0) {
      const newQuantity = cart[existingItemIndex].quantity + quantity;

      // Check stock for inventory items
      if (posData.selectedProduct) {
        const product = products.find((p) => p._id === posData.selectedProduct);
        if (product && newQuantity > product.stockQuantity) {
          setError(
            `Total quantity cannot exceed ${product.stockQuantity} units`,
          );
          setTimeout(() => setError(""), 3000);
          return;
        }
      }

      const updatedCart = [...cart];
      updatedCart[existingItemIndex] = {
        ...updatedCart[existingItemIndex],
        quantity: newQuantity,
        total: newQuantity * rate,
      };
      setCart(updatedCart);
    } else {
      const product = posData.selectedProduct
        ? products.find((p) => p._id === posData.selectedProduct)
        : null;

      const cartItem = {
        productId: productId,
        name: productName,
        category: product
          ? typeof product.category === "object"
            ? product.category.name
            : product.category
          : "Custom Item",
        rate: rate,
        quantity: quantity,
        total: quantity * rate,
        unit: product?.unit || "pcs",
        maxStock: product?.stockQuantity || 999999,
        isCustom: !posData.selectedProduct,
      };
      setCart([...cart, cartItem]);
    }

    // Clear product selection
    setPosData((prev) => ({
      ...prev,
      selectedProduct: "",
      customProductName: "",
      saleRate: "",
      quantity: "",
    }));
  };

  // Remove from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  // Update cart quantity
  const updateCartQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find((p) => p._id === productId);
    if (product && newQuantity > product.stockQuantity) {
      setError(`Only ${product.stockQuantity} units available`);
      setTimeout(() => setError(""), 3000);
      return;
    }

    setCart(
      cart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: newQuantity, total: newQuantity * item.rate }
          : item,
      ),
    );
  };

  // Update cart item price
  const updateCartPrice = (productId, newPrice) => {
    const price = parseFloat(newPrice) || 0;
    if (price < 0) {
      setError("Price cannot be negative");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setCart(
      cart.map((item) =>
        item.productId === productId
          ? { ...item, rate: price, total: item.quantity * price }
          : item,
      ),
    );
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount =
    posData.discountPercent > 0
      ? (subtotal * posData.discountPercent) / 100
      : posData.discount;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount =
    posData.vatPercent > 0
      ? (afterDiscount * posData.vatPercent) / 100
      : posData.vat;
  const grandTotal = afterDiscount + vatAmount;
  const totalPaid =
    (parseFloat(posData.cashPaid) || 0) + (parseFloat(posData.bankPaid) || 0);
  const returnAmount = Math.max(0, totalPaid - grandTotal);

  // Process sale
  const processSale = async () => {
    if (cart.length === 0) {
      setError("Please add items to cart");
      return;
    }

    console.log("Payment validation:", {
      totalPaid,
      grandTotal,
      cashPaid: posData.cashPaid,
      bankPaid: posData.bankPaid,
      cashPaidParsed: parseFloat(posData.cashPaid) || 0,
      bankPaidParsed: parseFloat(posData.bankPaid) || 0,
    });

    // Allow partial payment (due sales) - no minimum payment required
    // if (totalPaid < grandTotal) {
    //   setError(
    //     `Insufficient payment amount. Total: ${grandTotal.toFixed(2)}, Paid: ${totalPaid.toFixed(2)}`,
    //   );
    //   return;
    // }

    setLoading(true);
    try {
      const dueAmount = Math.max(0, grandTotal - totalPaid);

      const saleData = {
        invoiceNumber: posData.invoiceNo,
        customer: selectedCustomer
          ? {
              id: selectedCustomer._id,
              name: selectedCustomer.name,
            }
          : {
              name: posData.customerName,
            },
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          sellingPrice: item.rate,
        })),
        subtotal,
        discount: discountAmount,
        vatAmount,
        vatPercent: posData.vatPercent,
        grandTotal,
        cashPaid: parseFloat(posData.cashPaid) || 0,
        bankPaid: parseFloat(posData.bankPaid) || 0,
        dueAmount: dueAmount,
        paymentStatus: dueAmount > 0 ? "Partial" : "Paid",
        notes: posData.reference,
      };

      // Use real authenticated endpoint
      const response = await apiService.post("/sales", saleData);

      if (response.success) {
        // Create sale object for invoice
        const saleForInvoice = {
          ...response.data,
          invoiceNo: response.data.invoiceNo || posData.invoiceNo,
          items: cart.map((item) => ({
            ...item,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            qty: item.quantity,
            sellingPrice: item.rate,
            rate: item.rate,
            total: item.total,
          })),
          customer: selectedCustomer || {
            name: posData.customerName,
            phone: posData.customerMobile,
            address: posData.customerAddress,
          },
          customerName: selectedCustomer?.name || posData.customerName,
          subtotal,
          discountAmount,
          discount: discountAmount,
          vatAmount,
          vatPercent: posData.vatPercent,
          grandTotal,
          cashPaid: parseFloat(posData.cashPaid) || 0,
          bankPaid: parseFloat(posData.bankPaid) || 0,
          dueAmount: dueAmount,
          changeAmount: returnAmount,
          returnAmount: returnAmount,
          paymentStatus: dueAmount > 0 ? "Partial" : "Paid",
          saleDate: new Date(),
        };

        setLastSale(saleForInvoice);

        // Clear form and cart
        clearSale();
        setError("");
        setShowInvoiceModal(true);

        // Refresh products to update stock
        fetchProducts();
      } else {
        setError(response.message || "Failed to process sale");
      }
    } catch (error) {
      if (error.message?.includes("401")) {
        setError("Session expired. Please login again.");
        setTimeout(() => (window.location.href = "/login"), 2000);
      } else {
        setError(error.message || "Failed to process sale");
      }
      console.error("Process sale error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Clear sale
  const clearSale = () => {
    setCart([]);
    setSelectedCustomer(null);
    setPosData({
      invoiceNo: `INV-${Date.now()}`,
      employee: "Current User",
      reference: "",
      saleDate: new Date().toISOString().split("T")[0],
      saleType: "Retail",
      customerName: "Cash Customer",
      customerMobile: "",
      customerAddress: "",
      selectedProduct: "",
      customProductName: "",
      saleRate: "",
      quantity: "",
      discount: 0,
      discountPercent: 0,
      vat: 0,
      vatPercent: 0,
      cashPaid: 0,
      bankPaid: 0,
    });
  };

  // Handle product selection
  const handleProductSelect = (productId) => {
    const product = products.find((p) => p._id === productId);
    if (product) {
      setPosData((prev) => ({
        ...prev,
        selectedProduct: productId,
        customProductName: product.name,
        saleRate: product.sellingPrice.toString(),
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-400 to-pink-400 p-4 rounded-t-lg">
        <div className="grid grid-cols-5 gap-4 text-black">
          <div>
            <label className="block text-sm font-medium mb-1">Invoice no</label>
            <input
              type="text"
              value={posData.invoiceNo}
              onChange={(e) => handlePosDataChange("invoiceNo", e.target.value)}
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70"
              placeholder="Invoice number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Employee</label>
            <select
              value={posData.employee}
              onChange={(e) => handlePosDataChange("employee", e.target.value)}
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white"
            >
              <option value="Current User">Current User</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reference</label>
            <input
              type="text"
              value={posData.reference}
              onChange={(e) => handlePosDataChange("reference", e.target.value)}
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70"
              placeholder="Reference"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sale Date</label>
            <input
              type="date"
              value={posData.saleDate}
              onChange={(e) => handlePosDataChange("saleDate", e.target.value)}
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={clearSale}
              className="w-full bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded border border-white/30 transition-colors"
            >
              <i className="fas fa-refresh mr-2"></i>
              New Sale
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-4 bg-white rounded-b-lg shadow-lg">
        {/* Customer Information */}
        <div className="p-4">
          <div className="bg-blue-600 text-white p-3 rounded-t-lg">
            <h3 className="font-semibold flex items-center">
              <i className="fas fa-user mr-2"></i>
              Customer Information
            </h3>
          </div>
          <div className="bg-blue-50 p-4 rounded-b-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sales Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="saleType"
                    value="Retail"
                    checked={posData.saleType === "Retail"}
                    onChange={(e) =>
                      handlePosDataChange("saleType", e.target.value)
                    }
                    className="mr-2"
                  />
                  Retail
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="saleType"
                    value="Wholesale"
                    checked={posData.saleType === "Wholesale"}
                    onChange={(e) =>
                      handlePosDataChange("saleType", e.target.value)
                    }
                    className="mr-2"
                  />
                  Wholesale
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer
              </label>
              <div className="flex">
                <select
                  value={selectedCustomer?._id || "cash"}
                  onChange={(e) => {
                    if (e.target.value === "cash") {
                      setSelectedCustomer(null);
                      handlePosDataChange("customerName", "Cash Customer");
                    } else {
                      const customer = customers.find(
                        (c) => c._id === e.target.value,
                      );
                      setSelectedCustomer(customer);
                      handlePosDataChange("customerName", customer?.name || "");
                      handlePosDataChange(
                        "customerMobile",
                        customer?.phone || "",
                      );
                      handlePosDataChange(
                        "customerAddress",
                        customer?.address || "",
                      );
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash Customer</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-r"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={posData.customerName}
                onChange={(e) =>
                  handlePosDataChange("customerName", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Customer Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile No
              </label>
              <input
                type="text"
                value={posData.customerMobile}
                onChange={(e) =>
                  handlePosDataChange("customerMobile", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mobile No"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={posData.customerAddress}
                onChange={(e) =>
                  handlePosDataChange("customerAddress", e.target.value)
                }
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Address"
              />
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div className="p-4">
          <div className="bg-blue-600 text-white p-3 rounded-t-lg">
            <h3 className="font-semibold flex items-center">
              <i className="fas fa-box mr-2"></i>
              Product Information
            </h3>
          </div>
          <div className="bg-blue-50 p-4 rounded-b-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
              </label>
              <SearchableProductSelect
                products={products}
                value={posData.selectedProduct}
                onChange={(productId) => handleProductSelect(productId)}
                placeholder="Search and select product..."
                showStock={true}
                autoFocus={false}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                <span>Product Name</span>
                <span className="text-xs text-gray-500 italic">
                  (Editable for custom items)
                </span>
              </label>
              <input
                type="text"
                value={posData.customProductName}
                onChange={(e) =>
                  handlePosDataChange("customProductName", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter or edit product name..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Rate
                </label>
                <input
                  type="number"
                  value={posData.saleRate}
                  onChange={(e) =>
                    handlePosDataChange("saleRate", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Qty
                </label>
                <input
                  type="number"
                  value={posData.quantity}
                  onChange={(e) =>
                    handlePosDataChange("quantity", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total
              </label>
              <input
                type="text"
                value={
                  posData.saleRate && posData.quantity
                    ? (
                        parseFloat(posData.saleRate) *
                        parseFloat(posData.quantity)
                      ).toFixed(2)
                    : "0.00"
                }
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100"
              />
            </div>

            <button
              onClick={addToCart}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded font-semibold transition-colors"
              disabled={
                !posData.customProductName.trim() ||
                !posData.quantity ||
                !posData.saleRate
              }
            >
              Add Cart
            </button>
          </div>
        </div>

        {/* Amount Details */}
        <div className="p-4">
          <div className="bg-blue-600 text-white p-3 rounded-t-lg">
            <h3 className="font-semibold flex items-center">
              <i className="fas fa-calculator mr-2"></i>
              Amount Details
            </h3>
          </div>
          <div className="bg-blue-50 p-4 rounded-b-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SubTotal
              </label>
              <input
                type="text"
                value={subtotal.toFixed(2)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={posData.discount}
                  onChange={(e) =>
                    handlePosDataChange(
                      "discount",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <div className="flex">
                  <span className="bg-gray-200 px-3 py-2 border border-r-0 border-gray-300 rounded-l">
                    %
                  </span>
                  <input
                    type="number"
                    value={posData.discountPercent}
                    onChange={(e) =>
                      handlePosDataChange(
                        "discountPercent",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vat
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={posData.vat}
                  onChange={(e) =>
                    handlePosDataChange("vat", parseFloat(e.target.value) || 0)
                  }
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <div className="flex">
                  <span className="bg-gray-200 px-3 py-2 border border-r-0 border-gray-300 rounded-l">
                    %
                  </span>
                  <input
                    type="number"
                    value={posData.vatPercent}
                    onChange={(e) =>
                      handlePosDataChange(
                        "vatPercent",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total
              </label>
              <input
                type="text"
                value={grandTotal.toFixed(2)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 font-bold text-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Paid
                </label>
                <input
                  type="number"
                  value={posData.cashPaid}
                  onChange={(e) =>
                    handlePosDataChange(
                      "cashPaid",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Paid
                </label>
                <input
                  type="number"
                  value={posData.bankPaid}
                  onChange={(e) =>
                    handlePosDataChange(
                      "bankPaid",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Return
              </label>
              <input
                type="text"
                value={returnAmount.toFixed(2)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-green-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due
              </label>
              <input
                type="text"
                value={Math.max(0, grandTotal - totalPaid).toFixed(2)}
                readOnly
                className={`w-full px-3 py-2 border border-gray-300 rounded font-bold ${
                  grandTotal - totalPaid > 0
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              />
            </div>

            {/* Payment Status Indicator */}
            <div className="bg-gray-50 p-3 rounded border">
              <div className="flex justify-between text-sm mb-1">
                <span>Payment Status:</span>
                <span
                  className={`font-semibold ${
                    totalPaid >= grandTotal
                      ? "text-green-600"
                      : totalPaid > 0
                        ? "text-orange-600"
                        : "text-red-600"
                  }`}
                >
                  {totalPaid >= grandTotal
                    ? "Paid"
                    : totalPaid > 0
                      ? "Partial"
                      : "Unpaid"}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Required: ৳{grandTotal.toFixed(2)}</span>
                <span>Paid: ৳{totalPaid.toFixed(2)}</span>
              </div>
              {totalPaid < grandTotal && (
                <div className="text-xs text-red-600 mt-1 font-semibold">
                  Due: ৳{(grandTotal - totalPaid).toFixed(2)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button
                onClick={processSale}
                disabled={loading || cart.length === 0}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-3 px-4 rounded font-semibold transition-colors"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {grandTotal - totalPaid > 0 ? (
                      <>
                        <i className="fas fa-clock mr-2"></i>
                        Sale (Due)
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check mr-2"></i>
                        Sale
                      </>
                    )}
                  </>
                )}
              </button>
              <button
                onClick={clearSale}
                className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded font-semibold transition-colors"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Table */}
      <div className="mt-4 bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-4 py-3 text-left">SL</th>
              <th className="px-4 py-3 text-left">Product Name</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cart.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                  <i className="fas fa-shopping-cart text-4xl mb-4"></i>
                  <p className="text-lg">No items in cart</p>
                  <p className="text-sm">Add products to start selling</p>
                </td>
              </tr>
            ) : (
              cart.map((item, index) => (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.isCustom && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded mt-1 inline-block">
                        <i className="fas fa-tag mr-1"></i>
                        Custom Item
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end">
                      <span className="text-gray-500 mr-1">৳</span>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) =>
                          updateCartPrice(item.productId, e.target.value)
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() =>
                          updateCartQuantity(item.productId, item.quantity - 1)
                        }
                        className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded text-xs flex items-center justify-center"
                      >
                        <i className="fas fa-minus"></i>
                      </button>
                      <span className="w-12 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateCartQuantity(item.productId, item.quantity + 1)
                        }
                        className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded text-xs flex items-center justify-center"
                        disabled={item.quantity >= item.maxStock}
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    ৳{item.total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <CustomerModal
          customers={customers}
          searchTerm={customerSearchTerm}
          onSearchChange={setCustomerSearchTerm}
          onSelectCustomer={(customer) => {
            setSelectedCustomer(customer);
            if (customer) {
              handlePosDataChange("customerName", customer.name);
              handlePosDataChange("customerMobile", customer.phone || "");
              handlePosDataChange("customerAddress", customer.address || "");
            }
            setShowCustomerModal(false);
          }}
          onClose={() => setShowCustomerModal(false)}
          onCreateNew={() => {
            setShowCustomerModal(false);
            setShowCustomerForm(true);
          }}
        />
      )}

      {/* Customer Creation Modal */}
      {showCustomerForm && (
        <CustomerFormModal
          onClose={() => setShowCustomerForm(false)}
          onCustomerCreated={(customer) => {
            setSelectedCustomer(customer);
            handlePosDataChange("customerName", customer.name);
            handlePosDataChange("customerMobile", customer.phone || "");
            handlePosDataChange("customerAddress", customer.address || "");
            setShowCustomerForm(false);
            fetchCustomers();
          }}
        />
      )}

      {/* Professional Invoice Modal */}
      {showInvoiceModal && lastSale && (
        <ProfessionalInvoice
          sale={lastSale}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </div>
  );
};

// Customer Selection Modal Component
const CustomerModal = ({
  customers,
  searchTerm,
  onSearchChange,
  onSelectCustomer,
  onClose,
  onCreateNew,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Select Customer
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customers..."
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="max-h-48 overflow-y-auto mb-4">
          <div
            onClick={() => onSelectCustomer(null)}
            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
          >
            <div className="font-medium">Cash Customer</div>
            <div className="text-sm text-gray-500">No customer information</div>
          </div>

          {customers.map((customer) => (
            <div
              key={customer._id}
              onClick={() => onSelectCustomer(customer)}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
            >
              <div className="font-medium">{customer.name}</div>
              <div className="text-sm text-gray-500">{customer.phone}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onCreateNew}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        >
          <i className="fas fa-plus mr-2"></i>
          Add New Customer
        </button>
      </div>
    </div>
  );
};

// Customer Form Modal Component
const CustomerFormModal = ({ onClose, onCustomerCreated }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    type: "Regular",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Name and phone are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Use real authenticated endpoint
      const response = await apiService.post("/customers", formData);

      if (response.success) {
        onCustomerCreated(response.data);
      } else {
        setError(response.message || "Failed to create customer");
      }
    } catch (error) {
      if (error.message?.includes("401")) {
        setError("Session expired. Please login again.");
        setTimeout(() => (window.location.href = "/login"), 2000);
      } else {
        setError(error.message || "Failed to create customer");
      }
      console.error("Create customer error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Add New Customer
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <div className="flex items-center">
              <i className="fas fa-exclamation-circle mr-2"></i>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter address"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <i className="fas fa-user-plus mr-2"></i>
                  Create Customer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Sales;
