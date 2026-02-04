/**
 * Searchable Product Select Component
 * A dropdown with search functionality for selecting products
 */

import React, { useState, useEffect, useRef } from "react";

const SearchableProductSelect = ({
  products = [],
  value = "",
  onChange,
  placeholder = "Search and select product...",
  className = "",
  disabled = false,
  showStock = true,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Get selected product
  const selectedProduct = products.find((p) => p._id === value);

  // Filter products based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = products.filter((product) => {
        // Get category name (handle both string and object)
        const categoryName =
          typeof product.category === "object"
            ? product.category?.name
            : product.category;

        return (
          product.name?.toLowerCase().includes(term) ||
          product.sku?.toLowerCase().includes(term) ||
          product.brand?.toLowerCase().includes(term) ||
          categoryName?.toLowerCase().includes(term)
        );
      });
      setFilteredProducts(filtered);
    }
    setHighlightedIndex(0);
  }, [searchTerm, products]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const highlightedElement = listRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredProducts[highlightedIndex]) {
          handleSelect(filteredProducts[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        break;
      default:
        break;
    }
  };

  // Handle product selection
  const handleSelect = (product) => {
    onChange(product._id);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(0);
  };

  // Handle clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    setHighlightedIndex(0);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Get stock status color
  const getStockColor = (product) => {
    if (!product || product.stockQuantity === undefined) return "text-gray-600";
    if (product.stockQuantity === 0) return "text-red-600";
    if (product.isLowStock) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedProduct?.name || ""}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"
          }`}
        />

        {/* Icons */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {selectedProduct && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              title="Clear selection"
            >
              <i className="fas fa-times text-sm"></i>
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-1 hover:bg-gray-100 rounded text-gray-400"
            disabled={disabled}
          >
            <i
              className={`fas fa-chevron-${isOpen ? "up" : "down"} text-sm`}
            ></i>
          </button>
        </div>
      </div>

      {/* Dropdown List */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <i className="fas fa-search text-3xl mb-2"></i>
              <p className="text-sm">No products found</p>
              {searchTerm && (
                <p className="text-xs mt-1">
                  Try searching with different keywords
                </p>
              )}
            </div>
          ) : (
            <ul ref={listRef} className="py-1">
              {filteredProducts.map((product, index) => (
                <li
                  key={product._id}
                  onClick={() => handleSelect(product)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? "bg-blue-50 border-l-4 border-blue-500"
                      : "hover:bg-gray-50"
                  } ${value === product._id ? "bg-blue-100" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Product Name */}
                      <div className="font-medium text-gray-900 truncate">
                        {product.name}
                      </div>

                      {/* Product Details */}
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                        {product.sku && (
                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {product.sku}
                          </span>
                        )}
                        {product.brand && (
                          <span className="flex items-center">
                            <i className="fas fa-tag mr-1"></i>
                            {product.brand}
                          </span>
                        )}
                        {product.category && (
                          <span className="flex items-center">
                            <i className="fas fa-folder mr-1"></i>
                            {typeof product.category === "object"
                              ? product.category.name
                              : product.category}
                          </span>
                        )}
                      </div>

                      {/* Stock Info */}
                      {showStock && product.stockQuantity !== undefined && (
                        <div
                          className={`mt-1 text-xs font-medium ${getStockColor(
                            product,
                          )}`}
                        >
                          <i className="fas fa-box mr-1"></i>
                          Stock: {product.stockQuantity} {product.unit || "pcs"}
                          {product.stockQuantity === 0 && " (Out of Stock)"}
                          {product.isLowStock &&
                            product.stockQuantity > 0 &&
                            " (Low Stock)"}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="ml-4 text-right flex-shrink-0">
                      {product.sellingPrice !== undefined && (
                        <div className="text-sm font-semibold text-gray-900">
                          ৳{product.sellingPrice?.toFixed(2)}
                        </div>
                      )}
                      {product.purchasePrice !== undefined && (
                        <div className="text-xs text-gray-500">
                          Cost: ৳{product.purchasePrice.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Indicator */}
                  {value === product._id && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <i className="fas fa-check text-blue-600"></i>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Footer with count */}
          {filteredProducts.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>
                  {filteredProducts.length} product
                  {filteredProducts.length !== 1 ? "s" : ""} found
                </span>
                <span className="text-gray-400">
                  Use ↑↓ to navigate, Enter to select
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableProductSelect;
