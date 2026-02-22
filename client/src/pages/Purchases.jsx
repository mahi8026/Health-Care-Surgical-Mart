import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchableProductSelect from "../components/SearchableProductSelect";

const Purchases = () => {
  // State management
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Purchase Form State
  const [purchaseData, setPurchaseData] = useState({
    invoiceNo: `PO-${Date.now()}`,
    purchaseDate: new Date().toISOString().split("T")[0],
    reference: "",
    supplierName: "",
    supplierContact: "",
    supplierAddress: "",
    selectedProduct: "",
    unitCost: "",
    quantity: "",
    discount: 0,
    discountPercent: 0,
    vat: 0,
    vatPercent: 0,
    notes: "",
  });

  // Fetch products
  const fetchProducts = async () => {
    try {
      // Use real authenticated endpoint
      const response = await apiService.get("/products");

      if (response.success) {
        // Filter to only show active products
        setProducts(response.data.filter((p) => p.isActive));
      } else {
        console.error("Failed to fetch products:", response.message);
        setProducts([]);
      }
    } catch (error) {
      console.error("Fetch products error:", error);
      if (error.message?.includes("401")) {
        window.location.href = "/login";
      }
      setProducts([]);
    }
  };

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      // Use real authenticated endpoint
      const response = await apiService.get("/suppliers");

      if (response.success) {
        setSuppliers(response.data);
      } else {
        console.error("Failed to fetch suppliers:", response.message);
        setSuppliers([]);
      }
    } catch (error) {
      console.error("Fetch suppliers error:", error);
      if (error.message?.includes("401")) {
        window.location.href = "/login";
      }
      setSuppliers([]);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  // Handle form changes
  const handlePurchaseDataChange = (field, value) => {
    setPurchaseData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle product selection
  const handleProductSelect = (productId) => {
    const product = products.find((p) => p._id === productId);
    if (product) {
      setPurchaseData((prev) => ({
        ...prev,
        selectedProduct: productId,
        unitCost:
          product.purchasePrice?.toString() ||
          product.sellingPrice?.toString() ||
          "",
      }));
    }
  };

  // Add product to cart
  const addToCart = () => {
    if (
      !purchaseData.selectedProduct ||
      !purchaseData.quantity ||
      !purchaseData.unitCost
    ) {
      setError("Please select product, enter quantity and unit cost");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const quantity = parseFloat(purchaseData.quantity);
    const cost = parseFloat(purchaseData.unitCost);
    const product = products.find(
      (p) => p._id === purchaseData.selectedProduct,
    );

    if (!product) {
      setError("Product not found");
      return;
    }

    const existingItemIndex = cart.findIndex(
      (item) => item.productId === purchaseData.selectedProduct,
    );

    if (existingItemIndex >= 0) {
      const newQuantity = cart[existingItemIndex].quantity + quantity;
      const updatedCart = [...cart];
      updatedCart[existingItemIndex] = {
        ...updatedCart[existingItemIndex],
        quantity: newQuantity,
        total: newQuantity * cost,
      };
      setCart(updatedCart);
    } else {
      const cartItem = {
        productId: product._id,
        name: product.name,
        category:
          typeof product.category === "object"
            ? product.category.name
            : product.category,
        cost: cost,
        quantity: quantity,
        total: quantity * cost,
        unit: product.unit || "pcs",
      };
      setCart([...cart, cartItem]);
    }

    // Clear product selection
    setPurchaseData((prev) => ({
      ...prev,
      selectedProduct: "",
      unitCost: "",
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

    setCart(
      cart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: newQuantity, total: newQuantity * item.cost }
          : item,
      ),
    );
  };

  // Update cart item cost
  const updateCartCost = (productId, newCost) => {
    const cost = parseFloat(newCost) || 0;
    if (cost < 0) {
      setError("Cost cannot be negative");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setCart(
      cart.map((item) =>
        item.productId === productId
          ? { ...item, cost: cost, total: item.quantity * cost }
          : item,
      ),
    );
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount =
    purchaseData.discountPercent > 0
      ? (subtotal * purchaseData.discountPercent) / 100
      : purchaseData.discount;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount =
    purchaseData.vatPercent > 0
      ? (afterDiscount * purchaseData.vatPercent) / 100
      : purchaseData.vat;
  const grandTotal = afterDiscount + vatAmount;

  // Process purchase order
  const processPurchase = async () => {
    if (cart.length === 0) {
      setError("Please add items to cart");
      return;
    }

    if (!selectedSupplier && !purchaseData.supplierName) {
      setError("Please select or enter supplier information");
      return;
    }

    setLoading(true);
    try {
      const purchaseOrderData = {
        supplierId: selectedSupplier?._id,
        supplierName: selectedSupplier?.name || purchaseData.supplierName,
        invoiceNo: purchaseData.invoiceNo,
        purchaseDate: purchaseData.purchaseDate,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          qty: item.quantity,
          unitCost: item.cost,
          totalCost: item.total,
        })),
        subtotal,
        discount: discountAmount,
        vatAmount,
        vatPercent: purchaseData.vatPercent,
        grandTotal,
        notes: purchaseData.notes,
        status: "pending",
      };

      // Use real authenticated endpoint
      const response = await apiService.post("/purchases", purchaseOrderData);

      if (response.success) {
        alert("Purchase order created successfully!");
        clearPurchase();
        setError("");
        // Refresh products to update stock
        fetchProducts();
      } else {
        setError(response.message || "Failed to create purchase order");
      }
    } catch (error) {
      if (error.message?.includes("401")) {
        setError("Session expired. Please login again.");
        setTimeout(() => (window.location.href = "/login"), 2000);
      } else {
        setError(error.message || "Failed to create purchase order");
      }
      console.error("Process purchase error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Clear purchase
  const clearPurchase = () => {
    setCart([]);
    setSelectedSupplier(null);
    setPurchaseData({
      invoiceNo: `PO-${Date.now()}`,
      purchaseDate: new Date().toISOString().split("T")[0],
      reference: "",
      supplierName: "",
      supplierContact: "",
      supplierAddress: "",
      selectedProduct: "",
      unitCost: "",
      quantity: "",
      discount: 0,
      discountPercent: 0,
      vat: 0,
      vatPercent: 0,
      notes: "",
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-4 rounded-t-lg">
        <div className="grid grid-cols-5 gap-4 text-white">
          <div>
            <label className="block text-sm font-medium mb-1">
              Purchase Order No
            </label>
            <input
              type="text"
              value={purchaseData.invoiceNo}
              onChange={(e) =>
                handlePurchaseDataChange("invoiceNo", e.target.value)
              }
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70"
              placeholder="PO Number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseData.purchaseDate}
              onChange={(e) =>
                handlePurchaseDataChange("purchaseDate", e.target.value)
              }
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reference</label>
            <input
              type="text"
              value={purchaseData.reference}
              onChange={(e) =>
                handlePurchaseDataChange("reference", e.target.value)
              }
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70"
              placeholder="Reference"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded text-white"
              disabled
            >
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearPurchase}
              className="w-full bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded border border-white/30 transition-colors"
            >
              <i className="fas fa-refresh mr-2"></i>
              New Purchase
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

      {/* Main Content - Three Column Layout */}
      <div className="grid grid-cols-3 gap-4 bg-white rounded-b-lg shadow-lg">
        {/* Supplier Information */}
        <div className="p-4">
          <div className="bg-purple-600 text-white p-3 rounded-t-lg">
            <h3 className="font-semibold flex items-center">
              <i className="fas fa-truck mr-2"></i>
              Supplier Information
            </h3>
          </div>
          <div className="bg-purple-50 p-4 rounded-b-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <div className="flex">
                <select
                  value={selectedSupplier?._id || ""}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setSelectedSupplier(null);
                      handlePurchaseDataChange("supplierName", "");
                    } else {
                      const supplier = suppliers.find(
                        (s) => s._id === e.target.value,
                      );
                      setSelectedSupplier(supplier);
                      handlePurchaseDataChange(
                        "supplierName",
                        supplier?.name || "",
                      );
                      handlePurchaseDataChange(
                        "supplierContact",
                        supplier?.phone || "",
                      );
                      handlePurchaseDataChange(
                        "supplierAddress",
                        supplier?.address || "",
                      );
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name} - {supplier.company}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-r"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name
              </label>
              <input
                type="text"
                value={purchaseData.supplierName}
                onChange={(e) =>
                  handlePurchaseDataChange("supplierName", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Supplier Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={purchaseData.supplierContact}
                onChange={(e) =>
                  handlePurchaseDataChange("supplierContact", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Contact Number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={purchaseData.supplierAddress}
                onChange={(e) =>
                  handlePurchaseDataChange("supplierAddress", e.target.value)
                }
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Supplier Address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={purchaseData.notes}
                onChange={(e) =>
                  handlePurchaseDataChange("notes", e.target.value)
                }
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div className="p-4">
          <div className="bg-purple-600 text-white p-3 rounded-t-lg">
            <h3 className="font-semibold flex items-center">
              <i className="fas fa-box mr-2"></i>
              Product Information
            </h3>
          </div>
          <div className="bg-purple-50 p-4 rounded-b-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
              </label>
              <SearchableProductSelect
                products={products}
                value={purchaseData.selectedProduct}
                onChange={(productId) => handleProductSelect(productId)}
                placeholder="Search and select product..."
                showStock={true}
                autoFocus={false}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost
                </label>
                <input
                  type="number"
                  value={purchaseData.unitCost}
                  onChange={(e) =>
                    handlePurchaseDataChange("unitCost", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={purchaseData.quantity}
                  onChange={(e) =>
                    handlePurchaseDataChange("quantity", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  purchaseData.unitCost && purchaseData.quantity
                    ? (
                        parseFloat(purchaseData.unitCost) *
                        parseFloat(purchaseData.quantity)
                      ).toFixed(2)
                    : "0.00"
                }
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100"
              />
            </div>

            <button
              onClick={addToCart}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded font-semibold transition-colors"
              disabled={
                !purchaseData.selectedProduct ||
                !purchaseData.quantity ||
                !purchaseData.unitCost
              }
            >
              <i className="fas fa-plus mr-2"></i>
              Add to Cart
            </button>

            {/* Cart Summary */}
            <div className="bg-white p-3 rounded border border-purple-200 mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Cart Summary
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-semibold">{cart.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Qty:</span>
                  <span className="font-semibold">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-700 font-medium">Subtotal:</span>
                  <span className="font-bold text-purple-600">
                    ৳{subtotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Amount Details */}
        <div className="p-4">
          <div className="bg-purple-600 text-white p-3 rounded-t-lg">
            <h3 className="font-semibold flex items-center">
              <i className="fas fa-calculator mr-2"></i>
              Amount Details
            </h3>
          </div>
          <div className="bg-purple-50 p-4 rounded-b-lg space-y-4">
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
                  value={purchaseData.discount}
                  onChange={(e) =>
                    handlePurchaseDataChange(
                      "discount",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    value={purchaseData.discountPercent}
                    onChange={(e) =>
                      handlePurchaseDataChange(
                        "discountPercent",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                VAT/Tax
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={purchaseData.vat}
                  onChange={(e) =>
                    handlePurchaseDataChange(
                      "vat",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    value={purchaseData.vatPercent}
                    onChange={(e) =>
                      handlePurchaseDataChange(
                        "vatPercent",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                Grand Total
              </label>
              <input
                type="text"
                value={grandTotal.toFixed(2)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 font-bold text-lg"
              />
            </div>

            {/* Purchase Summary */}
            <div className="bg-white p-3 rounded border border-purple-200">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Purchase Summary
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>৳{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="text-red-600">
                    -৳{discountAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT/Tax:</span>
                  <span>+৳{vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span className="text-gray-700">Total Amount:</span>
                  <span className="text-purple-600">
                    ৳{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button
                onClick={processPurchase}
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
                    <i className="fas fa-check mr-2"></i>
                    Create Order
                  </>
                )}
              </button>
              <button
                onClick={clearPurchase}
                className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded font-semibold transition-colors"
              >
                <i className="fas fa-refresh mr-2"></i>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Table */}
      <div className="mt-4 bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-purple-600 text-white">
            <tr>
              <th className="px-4 py-3 text-left">SL</th>
              <th className="px-4 py-3 text-left">Product Name</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
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
                  <p className="text-sm">
                    Add products to create purchase order
                  </p>
                </td>
              </tr>
            ) : (
              cart.map((item, index) => (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                  </td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end">
                      <span className="text-gray-500 mr-1">৳</span>
                      <input
                        type="number"
                        value={item.cost}
                        onChange={(e) =>
                          updateCartCost(item.productId, e.target.value)
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
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
          {cart.length > 0 && (
            <tfoot className="bg-purple-50 border-t-2 border-purple-600">
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-3 text-right font-bold text-gray-700"
                >
                  Grand Total:
                </td>
                <td className="px-4 py-3 text-right font-bold text-purple-600 text-lg">
                  ৳{grandTotal.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <SupplierModal
          onClose={() => setShowSupplierModal(false)}
          onSupplierCreated={() => {
            fetchSuppliers();
            setShowSupplierModal(false);
          }}
        />
      )}
    </div>
  );
};

// Supplier Modal Component
const SupplierModal = ({ onClose, onSupplierCreated }) => {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.company || !formData.phone) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Use real authenticated endpoint
      const response = await apiService.post("/suppliers", formData);

      if (response.success) {
        alert("Supplier created successfully!");
        onSupplierCreated();
      } else {
        setError(response.message || "Failed to create supplier");
      }
    } catch (error) {
      if (error.message?.includes("401")) {
        setError("Session expired. Please login again.");
        setTimeout(() => (window.location.href = "/login"), 2000);
      } else {
        setError(error.message || "Failed to create supplier");
      }
      console.error("Create supplier error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-md w-full rounded-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Add New Supplier
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter supplier name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter company name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter phone number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter email (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter address (optional)"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded font-semibold"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create Supplier"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Purchases;
