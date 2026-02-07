import React, { useState } from "react";
import { apiService } from "../services/api";

const BulkProductImport = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    console.log("File selected:", {
      name: selectedFile?.name,
      type: selectedFile?.type,
      size: selectedFile?.size,
    });

    if (selectedFile) {
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      // Also check file extension as backup
      const fileName = selectedFile.name.toLowerCase();
      const hasValidExtension =
        fileName.endsWith(".csv") ||
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls");

      if (validTypes.includes(selectedFile.type) || hasValidExtension) {
        setFile(selectedFile);
        setErrors([]);
        console.log("File accepted:", selectedFile.name);
      } else {
        console.log("Invalid file type:", selectedFile.type);
        setErrors([
          `Please upload a valid CSV or Excel file. Current type: ${selectedFile.type}`,
        ]);
        setFile(null);
      }
    }
  };

  const downloadTemplate = () => {
    const template = `name,sku,category,purchasePrice,sellingPrice,unit,minStockLevel,description
Surgical Gloves,SG-001,Medical Supplies,50,75,Box,10,Sterile surgical gloves
Bandage Roll,BR-002,Medical Supplies,15,25,Roll,20,Cotton bandage roll
Syringe 5ml,SY-003,Instruments,5,10,Piece,50,Disposable syringe`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) {
      setErrors(["Please select a file to import"]);
      return;
    }

    setImporting(true);
    setProgress(0);
    setErrors([]);
    setResults(null);

    const formData = new FormData();
    formData.append("file", file);

    // Debug FormData
    console.log("FormData created:", {
      hasFile: formData.has("file"),
      fileFromFormData: formData.get("file"),
    });

    try {
      console.log("Starting bulk import:", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      const response = await apiService.post(
        "/bulk-products/bulk-import",
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setProgress(percentCompleted);
            console.log("Upload progress:", percentCompleted + "%");
          },
        },
      );

      console.log("Import response:", response);

      if (response.success) {
        setResults(response.data);
        if (response.data.errors?.length > 0) {
          setErrors(response.data.errors);
        }
        if (response.data.successCount > 0) {
          setTimeout(() => {
            onSuccess?.();
          }, 2000);
        }
      } else {
        setErrors([response.message || "Import failed"]);
      }
    } catch (error) {
      console.error("Import error:", error);

      // Extract detailed error message
      let errorMessage = "Failed to import products";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Add stack trace in development
      if (
        error.response?.data?.error &&
        process.env.NODE_ENV === "development"
      ) {
        console.error("Detailed error:", error.response.data.error);
      }

      setErrors([errorMessage]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            Bulk Product Import
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <i className="fas fa-info-circle"></i>
              Import Instructions
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Download the template CSV file below</li>
              <li>Fill in your product data following the template format</li>
              <li>Upload the completed CSV or Excel file</li>
              <li>Review the import results and fix any errors</li>
            </ul>
          </div>

          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <h4 className="font-medium text-gray-900">
                Download Template File
              </h4>
              <p className="text-sm text-gray-600">
                CSV template with sample data
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-download"></i>
              Download Template
            </button>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Product File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={importing}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                <span className="text-sm text-gray-600">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  CSV or Excel files only
                </span>
              </label>
              {file && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-green-600">
                  <i className="fas fa-file-excel"></i>
                  <span>{file.name}</span>
                  <span className="text-gray-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    onClick={() => {
                      setFile(null);
                      setErrors([]);
                      setResults(null);
                      // Reset the input
                      document.getElementById("file-upload").value = "";
                    }}
                    className="text-red-600 hover:text-red-700 ml-2"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Importing products...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {results.successCount}
                  </div>
                  <div className="text-sm text-green-700">Imported</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {results.errorCount}
                  </div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {results.totalRows}
                  </div>
                  <div className="text-sm text-blue-700">Total</div>
                </div>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i>
                Import Errors ({errors.length})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-700">
                    • {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={importing}
            >
              {results ? "Close" : "Cancel"}
            </button>
            {!results && (
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Importing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-upload"></i>
                    Import Products
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkProductImport;
