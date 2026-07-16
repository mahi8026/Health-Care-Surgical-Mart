import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import bulkProductService from "../services/bulkProductService";
import LoadingSpinner from "../components/LoadingSpinner";

const BulkProductImport = () => {
  const navigate = useNavigate();
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchImports = async () => {
      setLoading(true);
      try {
        const response = await bulkProductService.getImports();
        if (response.success) {
          setImports(response.data || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchImports();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Product Import</h1>
          <p className="text-gray-600 mt-1">Import multiple products at once</p>
        </div>
        <button
          onClick={() => navigate("/products")}
          className="btn-secondary"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Products
        </button>
      </div>
      {imports.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">{imports.length} imports found</p>
        </div>
      )}
    </div>
  );
};

export default BulkProductImport;
