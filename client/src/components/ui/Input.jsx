/**
 * Input Component
 * Reusable input component with validation and different types
 */

import React, { forwardRef } from "react";
import { clsx } from "clsx";

const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      type = "text",
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

    const inputClasses = clsx(
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

        <input
          ref={ref}
          type={type}
          className={inputClasses}
          disabled={disabled}
          {...props}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
