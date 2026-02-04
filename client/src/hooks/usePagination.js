/**
 * Pagination Hook
 * Provides pagination state and controls
 */

import { useState, useMemo } from "react";
import { PAGINATION } from "../config/constants";

export const usePagination = (
  initialPageSize = PAGINATION.DEFAULT_PAGE_SIZE,
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const pagination = useMemo(
    () => ({
      page: currentPage,
      limit: pageSize,
      skip: (currentPage - 1) * pageSize,
    }),
    [currentPage, pageSize],
  );

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => prev + 1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const changePageSize = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const reset = () => {
    setCurrentPage(1);
    setPageSize(initialPageSize);
  };

  return {
    currentPage,
    pageSize,
    pagination,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    changePageSize,
    reset,
  };
};

export default usePagination;
