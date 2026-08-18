import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../config/api";
import ExpenseForm from "../components/ExpenseForm";
import LoadingSpinner from "../components/LoadingSpinner";

const EditExpensePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/expenses/${id}`);
        if (!cancelled && response.success) {
          setExpense(response.data);
        } else if (!cancelled) {
          setError(response.message || "Expense not found");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.serverMessage || "Failed to load expense");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleUpdate = async (expenseData) => {
    try {
      setSaving(true);
      setError("");
      const response = await api.put(`/expenses/${id}`, expenseData);
      if (response.success) {
        navigate("/expenses");
      } else {
        setError(response.message || "Failed to update expense");
      }
    } catch (err) {
      setError(err.serverMessage || "Failed to update expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Expense</h1>
          <p className="text-gray-600 mt-1">Update expense details</p>
        </div>
        <button
          onClick={() => navigate("/expenses")}
          className="btn-secondary"
          disabled={saving}
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Expenses
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <span>{error}</span>
        </div>
      )}

      {expense ? (
        <div className="card max-w-2xl">
          <ExpenseForm
            expense={expense}
            onSubmit={handleUpdate}
            onCancel={() => navigate("/expenses")}
            loading={saving}
          />
        </div>
      ) : (
        !error && (
          <p className="text-gray-500">Expense not found or could not be loaded.</p>
        )
      )}
    </div>
  );
};

export default EditExpensePage;