import { useCallback, useRef, useState } from "react";
import { validatePdfFile, validatePdfPageCount } from "./upload-files.js";

const INITIAL_IMPORT = {
  open: false,
  status: "idle",
  pages: [],
  frontIndex: 0,
  indexIndex: -1,
  progress: 0
};

const destructionPromises = new WeakMap();

export function destroyPdfLoadingTask(task) {
  if (!task) return Promise.resolve();
  if (destructionPromises.has(task)) return destructionPromises.get(task);
  const promise = typeof task.destroy === "function"
    ? Promise.resolve().then(() => task.destroy())
    : Promise.reject(new Error("The PDF reader could not release this file safely."));
  destructionPromises.set(task, promise);
  return promise;
}

export function orderPdfPages(pages, frontIndex, indexIndex = -1) {
  const cover = pages[frontIndex];
  if (!cover) return [];
  const index = indexIndex >= 0 ? pages[indexIndex] : null;
  const selected = new Set([frontIndex, indexIndex]);
  const musicPages = pages.filter((_, position) => !selected.has(position));
  return [
    { ...cover, kind: "cover", name: `${cover.name} · cover` },
    ...(index ? [{ ...index, kind: "index", name: `${index.name} · index` }] : []),
    ...musicPages.map((page) => ({ ...page, kind: "page" }))
  ];
}

export function usePdfImport(onImport) {
  const [pdfImport, setPdfImport] = useState(INITIAL_IMPORT);
  const runRef = useRef(0);
  const loadingTaskRef = useRef(null);
  const renderTaskRef = useRef(null);

  const beginPdfImport = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    const run = runRef.current + 1;
    runRef.current = run;
    setPdfImport({
      open: true,
      status: "loading",
      fileName: file.name,
      pages: [],
      frontIndex: 0,
      indexIndex: -1,
      progress: 1
    });
    let loadingTask = null;
    try {
      validatePdfFile(file);
      const [pdfjs, workerModule] = await Promise.all([
        import("pdfjs-dist/build/pdf.mjs"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ]);
      if (runRef.current !== run) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      loadingTaskRef.current = loadingTask;
      const pdfDocument = await loadingTask.promise;
      validatePdfPageCount(pdfDocument.numPages);
      const rendered = [];
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        if (runRef.current !== run) break;
        setPdfImport((current) => ({ ...current, progress: pageNumber }));
        const pdfPage = await pdfDocument.getPage(pageNumber);
        try {
          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const scale = Math.min(2, 1400 / baseViewport.width);
          const viewport = pdfPage.getViewport({ scale });
          const canvas = globalThis.document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          const renderTask = pdfPage.render({ canvasContext: context, viewport });
          renderTaskRef.current = renderTask;
          await renderTask.promise;
          rendered.push({
            id: `pdf-${Date.now()}-${pageNumber}`,
            name: `${file.name} · page ${pageNumber}`,
            originalPage: pageNumber,
            src: canvas.toDataURL("image/jpeg", 0.9)
          });
        } finally {
          pdfPage.cleanup();
        }
      }
      if (runRef.current !== run) return;
      setPdfImport({
        open: true,
        status: "ready",
        fileName: file.name,
        pages: rendered,
        frontIndex: 0,
        indexIndex: rendered.length > 1 ? 1 : -1,
        progress: rendered.length
      });
    } catch (error) {
      if (runRef.current !== run || error?.name === "RenderingCancelledException") return;
      setPdfImport((current) => ({
        ...current,
        status: "error",
        error: error?.message || "Please try a different PDF file."
      }));
    } finally {
      try {
        await destroyPdfLoadingTask(loadingTask);
      } catch (error) {
        if (runRef.current === run) {
          setPdfImport((current) => ({
            ...current,
            status: "error",
            error: error?.message || "The PDF reader could not close this file."
          }));
        }
      }
      if (runRef.current === run) {
        loadingTaskRef.current = null;
        renderTaskRef.current = null;
      }
    }
  }, []);

  const chooseCover = useCallback((index) => {
    setPdfImport((current) => ({
      ...current,
      frontIndex: index,
      indexIndex: current.indexIndex === index ? -1 : current.indexIndex
    }));
  }, []);

  const chooseIndex = useCallback((index) => {
    setPdfImport((current) => ({ ...current, indexIndex: index }));
  }, []);

  const closePdfImport = useCallback(() => {
    runRef.current += 1;
    renderTaskRef.current?.cancel();
    void destroyPdfLoadingTask(loadingTaskRef.current).catch(() => {});
    renderTaskRef.current = null;
    loadingTaskRef.current = null;
    setPdfImport((current) => ({ ...current, open: false }));
  }, []);

  const confirmPdfImport = useCallback(() => {
    const pages = orderPdfPages(pdfImport.pages, pdfImport.frontIndex, pdfImport.indexIndex);
    if (!pages.length) return;
    onImport({ pages, fileName: pdfImport.fileName });
    setPdfImport((current) => ({ ...current, open: false }));
  }, [onImport, pdfImport]);

  return {
    pdfImport,
    beginPdfImport,
    chooseCover,
    chooseIndex,
    closePdfImport,
    confirmPdfImport
  };
}
