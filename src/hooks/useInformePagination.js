import { useCallback, useEffect, useMemo, useState } from "react";

// Hook reutilizable para paginar cualquier lista de registros del informe.
// Centraliza el calculo de indices y evita repetir la misma cuenta en cada componente.
export const useInformePagination = (records = [], initialItemsPerPage = 50) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  const totalItems = Array.isArray(records) ? records.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Si cambian los datos o el tamaño de pagina, nunca dejamos la pagina fuera de rango.
  useEffect(() => {
    setCurrentPage((prevPage) => Math.min(prevPage, totalPages));
  }, [totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const currentPageData = useMemo(() => {
    return Array.isArray(records) ? records.slice(startIndex, endIndex) : [];
  }, [records, startIndex, endIndex]);

  const goToPage = useCallback(
    (page) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToLastPage = useCallback(() => goToPage(totalPages), [goToPage, totalPages]);
  const goToPreviousPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);
  const goToNextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);

  // Al cambiar el tamano de pagina volvemos al inicio para no dejar la vista en una pagina vacia.
  const handleItemsPerPageChange = useCallback((newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  }, []);

  // Helper simple para que los componentes puedan resetear el paginado al cambiar filtros.
  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    itemsPerPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    currentPageData,
    goToPage,
    goToFirstPage,
    goToLastPage,
    goToPreviousPage,
    goToNextPage,
    handleItemsPerPageChange,
    resetPage,
  };
};