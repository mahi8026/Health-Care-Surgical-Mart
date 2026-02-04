import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../services/api";
import ExpenseForm from "../components/ExpenseForm";
import LoadingSpinner from "../components/LoadingSpinner";

const AddExpensePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Handle expense creation
  const handleCreateExpense = async (expenseData) => {
    try {
      setLoading(true);
      setError("");

      // Add uploaded files to expense data
      const finalExpenseData = {
        ...expenseData,
        attachments: uploadedFiles,
      };

      const response = await apiService.post("/expenses", finalExpenseData);

      if (response.success) {
        setSuccess("Expense created successfully!");

        // Redirect to expenses list after a short delay
        setTimeout(() => {
          navigate("/expenses");
        }, 1500);
      } else {
        setError(response.message || "Failed to create expense");
      }
    } catch (error) {
      console.error("Create expense error:", error);
      setError("Failed to create expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload for receipts
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    try {
      setUploadingReceipt(true);
      setError("");

      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "application/pdf",
        ];

        if (file.size > maxSize) {
          throw new Error(
            `File ${file.name} is too large. Maximum size is 10MB.`,
          );
        }

        if (!allowedTypes.includes(file.type)) {
          throw new Error(
            `File ${file.name} has unsupported format. Please use JPG, PNG, or PDF.`,
          );
        }

        // Create form data for upload
        const formData = new FormData();
        formData.append("receipt", file);

        const response = await apiService.request("/expenses/upload-receipt", {
          method: "POST",
          body: formData,
          headers: {
            // Remove Content-Type header to let browser set it with boundary
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!response.success) {
          throw new Error(response.message || `Failed to upload ${file.name}`);
        }

        return {
          filename: file.name,
          url: response.data.url,
          uploadDate: new Date(),
        };
      });

      const uploadedAttachments = await Promise.all(uploadPromises);
      setUploadedFiles((prev) => [...prev, ...uploadedAttachments]);
    } catch (error) {
      console.error("File upload error:", error);
      setError(error.message || "Failed to upload receipt files");
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Handle file removal
  const handleRemoveFile = (indexToRemove) => {
    setUploadedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  // Handle cancel
  const handleCancel = () => {
    navigate("/expenses");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Expense</h1>
          <p className="text-gray-600 mt-1">
            Record a new business expense with receipt attachments
          </p>
        </div>
        <button
          onClick={handleCancel}
          className="btn-secondary"
          disabled={loading}
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Expenses
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-check-circle mr-2"></i>
            <span>{success}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <ExpenseForm
              onSubmit={handleCreateExpense}
              onCancel={handleCancel}
              loading={loading}
            />
          </div>
        </div>

        {/* Receipt Upload Sidebar */}
        <div className="space-y-6">
          {/* File Upload */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">
                Receipt Attachments
              </h3>
              <p className="text-sm text-gray-600">
                Upload receipts, invoices, or other supporting documents
              </p>
            </div>

            {/* Upload Area */}
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="receipt-upload"
                  disabled={uploadingReceipt}
                />
                <label
                  htmlFor="receipt-upload"
                  className="cursor-pointer block"
                >
                  {uploadingReceipt ? (
                    <div className="flex flex-col items-center">
                      <LoadingSpinner size="lg" className="mb-2" />
                      <p className="text-sm text-gray-600">
                        Uploading files...
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                      <p className="text-sm font-medium text-gray-900">
                        Click to upload receipts
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG, PDF up to 10MB each
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* File List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    Uploaded Files ({uploadedFiles.length})
                  </h4>
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <i
                          className={`fas ${
                            file.filename.toLowerCase().endsWith(".pdf")
                              ? "fa-file-pdf text-red-500"
                              : "fa-file-image text-blue-500"
                          } mr-2`}
                        ></i>
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-32">
                            {file.filename}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(file.uploadDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove file"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Guidelines */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start">
                  <i className="fas fa-info-circle text-blue-500 mt-0.5 mr-2"></i>
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">Upload Guidelines</p>
                    <ul className="text-xs space-y-1">
                      <li>• Supported formats: JPG, PNG, PDF</li>
                      <li>• Maximum file size: 10MB per file</li>
                      <li>• Multiple files can be uploaded</li>
                      <li>• Files are stored securely in cloud storage</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">
                <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                Quick Tips
              </h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <i className="fas fa-check text-green-500 mt-0.5 mr-2"></i>
                <p>Use descriptive names for easy identification later</p>
              </div>
              <div className="flex items-start">
                <i className="fas fa-check text-green-500 mt-0.5 mr-2"></i>
                <p>Add vendor information for better expense tracking</p>
              </div>
              <div className="flex items-start">
                <i className="fas fa-check text-green-500 mt-0.5 mr-2"></i>
                <p>Use tags to organize expenses by project or department</p>
              </div>
              <div className="flex items-start">
                <i className="fas fa-check text-green-500 mt-0.5 mr-2"></i>
                <p>Set up recurring expenses for regular payments</p>
              </div>
              <div className="flex items-start">
                <i className="fas fa-check text-green-500 mt-0.5 mr-2"></i>
                <p>Upload clear, readable receipt images</p>
              </div>
            </div>
          </div>

          {/* Recent Categories */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">
                <i className="fas fa-history text-gray-500 mr-2"></i>
                Recent Categories
              </h3>
            </div>
            <div className="text-sm text-gray-600">
              <p>
                Your most used expense categories will appear here to help speed
                up expense entry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddExpensePage;
