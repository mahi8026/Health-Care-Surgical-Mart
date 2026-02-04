import React, { useState } from "react";
import CategorySelector from "../components/CategorySelector";

/**
 * Example usage of the CategorySelector component
 * This demonstrates how to use the CategorySelector in forms
 */
const ExpenseCategoryExample = () => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    categoryId: "",
  });

  const handleCategoryChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSelectedCategory(value);
  };

  const handleCategoryCreated = (newCategory) => {
    console.log("New category created:", newCategory);
    // You can add additional logic here, like showing a success message
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Expense Form Example</h2>

      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expense Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            className="input-field"
            placeholder="Enter expense description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, amount: e.target.value }))
            }
            className="input-field"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <CategorySelector
            value={selectedCategory}
            onChange={handleCategoryChange}
            name="categoryId"
            required={true}
            placeholder="Select expense category"
            allowInlineCreate={true}
            onCategoryCreated={handleCategoryCreated}
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={
              !formData.description || !formData.amount || !formData.categoryId
            }
          >
            Save Expense
          </button>
        </div>
      </form>

      {/* Display current form data for demonstration */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Form Data:</h3>
        <pre className="text-xs text-gray-600">
          {JSON.stringify(formData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default ExpenseCategoryExample;
