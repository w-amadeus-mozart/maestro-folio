import { useCallback, useState } from "react";

const INITIAL_IMPORT = {
  open: false,
  status: "idle",
  pages: [],
  frontIndex: 0,
  indexIndex: -1,
  progress: 0
};

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

  const beginPdfImport = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    setPdfImport({
      open: true,
      status: "loading",
      fileName: file.name,
      pages: [],
      frontIndex: 0,
      indexIndex: -1,
      progress: 1
    });
    try {
      const [pdfjs, workerModule] = await Promise.all([
        import("pdfjs-dist/build/pdf.mjs"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const rendered = [];
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        setPdfImport((current) => ({ ...current, progress: pageNumber }));
        const pdfPage = await pdfDocument.getPage(pageNumber);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(2, 1400 / baseViewport.width);
        const viewport = pdfPage.getViewport({ scale });
        const canvas = globalThis.document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        rendered.push({
          id: `pdf-${Date.now()}-${pageNumber}`,
          name: `${file.name} · page ${pageNumber}`,
          originalPage: pageNumber,
          src: canvas.toDataURL("image/jpeg", 0.9)
        });
        pdfPage.cleanup();
      }
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
      setPdfImport((current) => ({
        ...current,
        status: "error",
        error: error?.message || "Please try a different PDF file."
      }));
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
