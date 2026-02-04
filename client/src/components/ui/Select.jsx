/**
 * Select Component
 * Reusable select dropdown component
 */

import React, { forwardRef } from "react";
import { clsx } from "clsx";

const Select = forwardRef(
  (
    {
      label,
      error,
      helperText,
      options = [],
      placeholder = "Select an option",
      size = "md",
      disabled = false,
      required = false,
      className = "",
      containerClassName = "",
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-3 py-2 text-sm",
      lg: "px-4 py-3 text-base",
    };

    const errorClasses = error
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "";

    const selectClasses = clsx(
      baseClasses,
      sizes[size],
      errorClasses,
      className,
    );

    return (
      <div className={clsx("space-y-1", containerClassName)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          className={selectClasses}
          disabled={disabled}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
