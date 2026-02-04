/**
 * Expense Card Component
 * Displays expense information in a card format
 */

import React from "react";
import { clsx } from "clsx";
import { Calendar, DollarSign, Tag, User, Paperclip } from "lucide-react";
import { formatCurrency, formatDate, capitalize } from "../../utils";
import { Button } from "../ui";

const ExpenseCard = ({
  expense,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  className = "",
}) => {
  const {
    expenseNumber,
    description,
    amount,
    expenseDate,
    categoryName,
    paymentMethod,
    vendor,
    attachments = [],
    isRecurring,
  } = expense;

  return (
    <div
      className={clsx(
        "bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {expenseNumber}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {description || "No description"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900">
            {formatCurrency(amount)}
          </div>
          {isRecurring && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
              Recurring
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-2" />
          {formatDate(expenseDate)}
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <Tag className="h-4 w-4 mr-2" />
          {categoryName}
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <DollarSign className="h-4 w-4 mr-2" />
          {capitalize(paymentMethod)}
        </div>

        {vendor?.name && (
          <div className="flex items-center text-sm text-gray-600">
            <User className="h-4 w-4 mr-2" />
            {vendor.name}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex items-center text-sm text-gray-600">
            <Paperclip className="h-4 w-4 mr-2" />
            {attachments.length} attachment{attachments.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
          {onView && (
            <Button variant="ghost" size="sm" onClick={() => onView(expense)}>
              View
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(expense)}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(expense)}
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseCard;
