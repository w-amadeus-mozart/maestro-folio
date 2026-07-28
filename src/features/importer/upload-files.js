export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_BATCH = 200;
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_PAGES = 200;

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"]);

const extensionOf = (file) => file?.name?.split(".").pop()?.toLowerCase();

export function validateImageFiles(files) {
  const selected = [...(files || [])];
  if (!selected.length) throw new Error("Choose at least one image.");
  if (selected.length > MAX_IMAGE_BATCH) {
    throw new Error(`Choose no more than ${MAX_IMAGE_BATCH} images at a time.`);
  }
  for (const file of selected) {
    if (!file.type?.startsWith("image/") && !IMAGE_EXTENSIONS.has(extensionOf(file))) {
      throw new Error(`“${file.name || "This file"}” is not a supported image.`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`“${file.name}” exceeds the 20 MB image limit.`);
    }
  }
  return selected;
}

export function validatePdfFile(file) {
  if (!file) throw new Error("Choose a PDF file to continue.");
  if (file.type !== "application/pdf" && extensionOf(file) !== "pdf") {
    throw new Error("Choose a valid PDF file.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF files must be 50 MB or smaller.");
  }
  return file;
}

export function validatePdfPageCount(pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("This PDF does not contain any readable pages.");
  }
  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`This PDF has ${pageCount} pages. Import up to ${MAX_PDF_PAGES} pages at a time.`);
  }
  return pageCount;
}

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error(`“${file.name}” could not be read. Try another image.`));
  reader.onabort = () => reject(new Error("Image loading was cancelled."));
  reader.readAsDataURL(file);
});

const verifyImageDecode = (src, name) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(src);
  image.onerror = () => reject(new Error(`“${name}” is damaged or uses an unsupported image format.`));
  image.src = src;
});

export async function readImageFiles(files) {
  const selected = validateImageFiles(files);
  return Promise.all(selected.map(async (file) => ({
    file,
    src: await verifyImageDecode(await readAsDataUrl(file), file.name)
  })));
}
