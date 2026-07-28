import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteBook,
  exportBookPackage,
  importBookPackage,
  listBookSummaries,
  revokeObjectUrls
} from "./book-repository.js";

export function useBookLibrary() {
  const [books, setBooks] = useState([]);
  const [importing, setImporting] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [transferNotice, setTransferNotice] = useState("");
  const summaryUrlsRef = useRef([]);

  const clearLibraryMessages = useCallback(() => {
    setLibraryError("");
    setTransferNotice("");
  }, []);

  const refreshBooks = useCallback(async () => {
    const result = await listBookSummaries();
    revokeObjectUrls(summaryUrlsRef.current);
    summaryUrlsRef.current = result.objectUrls;
    setBooks(result.books);
  }, []);

  useEffect(() => {
    refreshBooks().catch((error) => setLibraryError(error.message));
    return () => revokeObjectUrls(summaryUrlsRef.current);
  }, [refreshBooks]);

  const removeBook = useCallback(async (id) => {
    clearLibraryMessages();
    try {
      await deleteBook(id);
      await refreshBooks();
    } catch (error) {
      setLibraryError(error?.message || "The book could not be deleted.");
    }
  }, [clearLibraryMessages, refreshBooks]);

  const exportBook = useCallback(async (summary) => {
    clearLibraryMessages();
    try {
      const { blob, fileName } = await exportBookPackage(summary.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setTransferNotice(`“${summary.title}” was exported. Move the file to your other device and choose Import book.`);
    } catch (error) {
      setLibraryError(error?.message || "The book could not be exported.");
    }
  }, [clearLibraryMessages]);

  const importBook = useCallback(async (file) => {
    setImporting(true);
    clearLibraryMessages();
    try {
      const imported = await importBookPackage(file);
      await refreshBooks();
      setTransferNotice(`“${imported.title}” was imported as a new book on this device.`);
    } catch (error) {
      setLibraryError(error?.message || "The book could not be imported.");
    } finally {
      setImporting(false);
    }
  }, [clearLibraryMessages, refreshBooks]);

  return {
    books,
    importing,
    libraryError,
    transferNotice,
    clearLibraryMessages,
    refreshBooks,
    removeBook,
    exportBook,
    importBook
  };
}
