import {
  CURRENT_BOOK_SCHEMA_VERSION,
  hydrateBookmarkLocation,
  migrateLegacyMetadata,
  spreadToPageId
} from "./book-migrations.js";

const DB_NAME = "maestro-folio";
const DB_VERSION = 2;
const BOOKS_STORE = "books";
const ASSETS_STORE = "assets";
const ASSET_BOOK_INDEX = "byBookId";
const PACKAGE_FORMAT = "maestro-folio-book";
const PACKAGE_VERSION = 1;

let databasePromise;
let migrationPromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Storage transaction was aborted."));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BOOKS_STORE)) {
        database.createObjectStore(BOOKS_STORE, { keyPath: "id" });
      }
      let assets;
      if (!database.objectStoreNames.contains(ASSETS_STORE)) {
        assets = database.createObjectStore(ASSETS_STORE, { keyPath: "assetId" });
      } else {
        assets = request.transaction.objectStore(ASSETS_STORE);
      }
      if (!assets.indexNames.contains(ASSET_BOOK_INDEX)) {
        assets.createIndex(ASSET_BOOK_INDEX, "bookId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Storage upgrade is blocked by another open Maestro Folio tab."));
  });
  return databasePromise;
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(",", 2);
  const mime = header.match(/^data:([^;,]+)/)?.[1] || "application/octet-stream";
  if (header.includes(";base64")) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(encoded)], { type: mime });
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(encoded, mime) {
  if (typeof encoded !== "string") throw new Error("A package asset is missing its data.");
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime || "application/octet-stream" });
  } catch {
    throw new Error("A package asset contains invalid data.");
  }
}

async function sourceToBlob(source) {
  if (source instanceof Blob) return source;
  if (!source) return new Blob([], { type: "application/octet-stream" });
  if (source.startsWith("data:")) return dataUrlToBlob(source);
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Unable to read media asset (${response.status}).`);
  return response.blob();
}

function safeFileName(value) {
  const normalized = (value || "untitled-score")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "untitled-score";
}

function validatePackage(parsed) {
  if (!parsed || typeof parsed !== "object" || parsed.format !== PACKAGE_FORMAT) {
    throw new Error("This is not a Maestro Folio book package.");
  }
  if (parsed.packageVersion !== PACKAGE_VERSION) {
    throw new Error(`This package version is not supported. Expected version ${PACKAGE_VERSION}.`);
  }
  if (!parsed.book || typeof parsed.book !== "object" || !Array.isArray(parsed.book.pageRefs)) {
    throw new Error("The package is missing its book information.");
  }
  if (!Array.isArray(parsed.assets)) throw new Error("The package is missing its media assets.");
}

function assetRecord({ assetId = crypto.randomUUID(), bookId, kind, blob, width, height }) {
  return {
    assetId,
    bookId,
    kind,
    mime: blob.type || "application/octet-stream",
    bytes: blob,
    size: blob.size,
    width: width || null,
    height: height || null,
    createdAt: new Date().toISOString()
  };
}

async function migrateLegacyBook(database, legacyBook) {
  const assets = [];
  const pageAssets = [];
  for (const page of legacyBook.pages || []) {
    const blob = await sourceToBlob(page.src);
    const asset = assetRecord({ bookId: legacyBook.id, kind: "page", blob });
    assets.push(asset);
    pageAssets.push(asset);
  }

  let audioAssetId = null;
  if (legacyBook.audioSrc) {
    const blob = await sourceToBlob(legacyBook.audioSrc);
    const asset = assetRecord({ bookId: legacyBook.id, kind: "audio", blob });
    assets.push(asset);
    audioAssetId = asset.assetId;
  }

  const bookmarkAudioAssets = new Map();
  for (const bookmark of legacyBook.bookmarks || []) {
    if (!bookmark.audioSrc) continue;
    const blob = await sourceToBlob(bookmark.audioSrc);
    const asset = assetRecord({ bookId: legacyBook.id, kind: "audio", blob });
    assets.push(asset);
    bookmarkAudioAssets.set(bookmark.id, asset.assetId);
  }

  const migrated = migrateLegacyMetadata(legacyBook, { pageAssets, audioAssetId, bookmarkAudioAssets });
  const transaction = database.transaction([BOOKS_STORE, ASSETS_STORE], "readwrite");
  const books = transaction.objectStore(BOOKS_STORE);
  const assetStore = transaction.objectStore(ASSETS_STORE);
  assets.forEach((asset) => assetStore.put(asset));
  books.put(migrated);
  await transactionDone(transaction);
}

async function ensureMigrations(database) {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const transaction = database.transaction(BOOKS_STORE, "readonly");
    const records = await requestResult(transaction.objectStore(BOOKS_STORE).getAll());
    await transactionDone(transaction);
    for (const record of records) {
      if (record.schemaVersion === CURRENT_BOOK_SCHEMA_VERSION) continue;
      await migrateLegacyBook(database, record);
    }
  })();
  try {
    await migrationPromise;
  } catch (error) {
    migrationPromise = null;
    throw error;
  }
}

async function getDatabase() {
  const database = await openDatabase();
  await ensureMigrations(database);
  return database;
}

async function getAsset(database, assetId) {
  if (!assetId) return null;
  const transaction = database.transaction(ASSETS_STORE, "readonly");
  const asset = await requestResult(transaction.objectStore(ASSETS_STORE).get(assetId));
  await transactionDone(transaction);
  return asset || null;
}

function objectUrl(asset, urls) {
  if (!asset?.bytes) return "";
  const url = URL.createObjectURL(asset.bytes);
  urls.push(url);
  return url;
}

export function revokeObjectUrls(urls = []) {
  urls.forEach((url) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  });
}

export async function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0, ratio: 0, persisted: false };
  }
  const estimate = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  return { usage, quota, ratio: quota ? usage / quota : 0, persisted };
}

export async function listBookSummaries() {
  const database = await getDatabase();
  const transaction = database.transaction(BOOKS_STORE, "readonly");
  const records = await requestResult(transaction.objectStore(BOOKS_STORE).getAll());
  await transactionDone(transaction);
  const summaries = [];
  const objectUrls = [];
  for (const record of records) {
    const cover = record.pageRefs?.[0];
    const coverAsset = cover ? await getAsset(database, cover.assetId) : null;
    summaries.push({
      id: record.id,
      title: record.title,
      composer: record.composer,
      pageCount: record.pageCount || record.pageRefs?.length || 0,
      pages: cover ? [{ ...cover, id: cover.pageId, src: objectUrl(coverAsset, objectUrls) }] : [],
      audioSrc: record.audioAssetId ? "__stored_asset__" : "",
      updatedAt: record.updatedAt
    });
  }
  return { books: summaries, objectUrls };
}

export async function loadBook(bookId) {
  const database = await getDatabase();
  const transaction = database.transaction(BOOKS_STORE, "readonly");
  const record = await requestResult(transaction.objectStore(BOOKS_STORE).get(bookId));
  await transactionDone(transaction);
  if (!record) throw new Error("This book could not be found.");

  const objectUrls = [];
  const pages = [];
  for (const pageRef of record.pageRefs || []) {
    const asset = await getAsset(database, pageRef.assetId);
    pages.push({
      id: pageRef.pageId,
      assetId: pageRef.assetId,
      name: pageRef.name,
      kind: pageRef.kind,
      originalPage: pageRef.originalPage,
      src: objectUrl(asset, objectUrls)
    });
  }

  const audioAsset = await getAsset(database, record.audioAssetId);
  const bookmarks = [];
  for (const storedBookmark of record.bookmarks || []) {
    const bookmark = hydrateBookmarkLocation(storedBookmark, record.pageRefs || []);
    const audio = await getAsset(database, bookmark.audioAssetId);
    bookmarks.push({ ...bookmark, audioSrc: objectUrl(audio, objectUrls) });
  }

  return {
    id: record.id,
    title: record.title,
    composer: record.composer,
    pages,
    audioAssetId: record.audioAssetId,
    audioSrc: objectUrl(audioAsset, objectUrls),
    audioName: record.audioName || "",
    showPageNumbers: Boolean(record.showPageNumbers),
    bookmarks,
    updatedAt: record.updatedAt,
    _objectUrls: objectUrls
  };
}

function referencedAssetIds(record) {
  return new Set([
    ...(record?.pageRefs || []).flatMap((page) => [page.assetId, page.thumbAssetId].filter(Boolean)),
    ...(record?.bookmarks || []).map((bookmark) => bookmark.audioAssetId).filter(Boolean),
    record?.audioAssetId
  ].filter(Boolean));
}

export async function saveBook(book) {
  const database = await getDatabase();
  await requestPersistentStorage();

  const oldTransaction = database.transaction(BOOKS_STORE, "readonly");
  const previous = await requestResult(oldTransaction.objectStore(BOOKS_STORE).get(book.id));
  await transactionDone(oldTransaction);

  const newAssets = [];
  const pageRefs = [];
  for (const [index, page] of (book.pages || []).entries()) {
    let assetId = page.assetId;
    if (!assetId) {
      const blob = await sourceToBlob(page.src);
      const asset = assetRecord({ bookId: book.id, kind: "page", blob });
      newAssets.push(asset);
      assetId = asset.assetId;
    }
    pageRefs.push({
      pageId: page.id || crypto.randomUUID(),
      kind: page.kind || (index === 0 ? "cover" : "page"),
      name: page.name || `Page ${index + 1}`,
      assetId,
      thumbAssetId: page.thumbAssetId || null,
      originalPage: page.originalPage ?? null
    });
  }

  let audioAssetId = book.audioAssetId || null;
  if (book.audioSrc && !audioAssetId) {
    const blob = await sourceToBlob(book.audioSrc);
    const asset = assetRecord({ bookId: book.id, kind: "audio", blob });
    newAssets.push(asset);
    audioAssetId = asset.assetId;
  }

  const bookmarks = [];
  for (const bookmark of book.bookmarks || []) {
    let bookmarkAudioAssetId = bookmark.audioAssetId || null;
    if (bookmark.audioSrc && !bookmarkAudioAssetId) {
      const blob = await sourceToBlob(bookmark.audioSrc);
      const asset = assetRecord({ bookId: book.id, kind: "audio", blob });
      newAssets.push(asset);
      bookmarkAudioAssetId = asset.assetId;
    }
    const pageId = bookmark.pageId || spreadToPageId(bookmark.spread ?? 0, book.pages || []);
    const pageExists = pageRefs.some((page) => page.pageId === pageId);
    bookmarks.push({
      id: bookmark.id || crypto.randomUUID(),
      name: bookmark.name || "Untitled bookmark",
      pageId,
      orphaned: !pageExists,
      audioAssetId: bookmarkAudioAssetId,
      audioName: bookmark.audioName || ""
    });
  }

  const estimatedBytes = newAssets.reduce((total, asset) => total + asset.size, 0);
  const storage = await getStorageStatus();
  if (storage.quota && storage.usage + estimatedBytes > storage.quota * 0.95) {
    const error = new Error("There is not enough browser storage to save this book. Export or remove another book, then retry.");
    error.name = "QuotaExceededError";
    throw error;
  }

  const record = {
    id: book.id,
    schemaVersion: CURRENT_BOOK_SCHEMA_VERSION,
    title: book.title || "Untitled score",
    composer: book.composer || "",
    pageRefs,
    pageCount: pageRefs.length,
    bookmarks,
    audioAssetId,
    audioName: book.audioName || "",
    showPageNumbers: Boolean(book.showPageNumbers),
    updatedAt: new Date().toISOString()
  };

  const keep = referencedAssetIds(record);
  const remove = [...referencedAssetIds(previous)].filter((assetId) => !keep.has(assetId));
  const transaction = database.transaction([BOOKS_STORE, ASSETS_STORE], "readwrite");
  const books = transaction.objectStore(BOOKS_STORE);
  const assets = transaction.objectStore(ASSETS_STORE);
  newAssets.forEach((asset) => assets.put(asset));
  remove.forEach((assetId) => assets.delete(assetId));
  books.put(record);
  try {
    await transactionDone(transaction);
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      throw new Error("Browser storage is full. The book was not partially saved; free space and retry.");
    }
    throw new Error(`The book could not be saved: ${error?.message || "Unknown storage error"}`);
  }
  return record;
}

export async function exportBookPackage(bookId) {
  const database = await getDatabase();
  const transaction = database.transaction([BOOKS_STORE, ASSETS_STORE], "readonly");
  const bookRequest = requestResult(transaction.objectStore(BOOKS_STORE).get(bookId));
  const assetsRequest = requestResult(transaction.objectStore(ASSETS_STORE).index(ASSET_BOOK_INDEX).getAll(bookId));
  const [book, assets] = await Promise.all([bookRequest, assetsRequest]);
  await transactionDone(transaction);
  if (!book) throw new Error("This book could not be found.");

  const serializedAssets = [];
  for (const asset of assets) {
    const bytes = new Uint8Array(await asset.bytes.arrayBuffer());
    serializedAssets.push({
      assetId: asset.assetId,
      kind: asset.kind,
      mime: asset.mime || asset.bytes.type || "application/octet-stream",
      size: asset.size ?? asset.bytes.size,
      width: asset.width || null,
      height: asset.height || null,
      data: bytesToBase64(bytes)
    });
  }

  const payload = {
    format: PACKAGE_FORMAT,
    packageVersion: PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    book,
    assets: serializedAssets
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/vnd.maestro-folio.book+json" });
  return {
    blob,
    fileName: `${safeFileName(book.title)}.maestro-folio`
  };
}

export async function importBookPackage(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("The selected file is not a valid Maestro Folio package.");
  }
  validatePackage(parsed);

  const newBookId = crypto.randomUUID();
  const assetIdMap = new Map();
  const importedAssets = parsed.assets.map((asset) => {
    if (!asset || typeof asset.assetId !== "string") {
      throw new Error("The package contains an invalid media asset.");
    }
    if (assetIdMap.has(asset.assetId)) throw new Error("The package contains duplicate media assets.");
    const assetId = crypto.randomUUID();
    assetIdMap.set(asset.assetId, assetId);
    const blob = base64ToBlob(asset.data, asset.mime);
    if (Number.isFinite(asset.size) && asset.size !== blob.size) {
      throw new Error("A package asset is incomplete or corrupted.");
    }
    return assetRecord({
      assetId,
      bookId: newBookId,
      kind: asset.kind || "page",
      blob,
      width: asset.width,
      height: asset.height
    });
  });

  const remapAssetId = (assetId) => {
    if (!assetId) return null;
    const remapped = assetIdMap.get(assetId);
    if (!remapped) throw new Error("The package is missing a referenced media asset.");
    return remapped;
  };
  const pageRefs = parsed.book.pageRefs.map((page, index) => {
    if (!page?.assetId) throw new Error("A package page is missing its media asset.");
    return {
      pageId: page.pageId || crypto.randomUUID(),
      kind: page.kind || (index === 0 ? "cover" : "page"),
      name: page.name || `Page ${index + 1}`,
      assetId: remapAssetId(page.assetId),
      thumbAssetId: remapAssetId(page.thumbAssetId),
      originalPage: page.originalPage ?? null
    };
  });
  if (!pageRefs.length) throw new Error("The package does not contain any pages.");

  const bookmarks = (Array.isArray(parsed.book.bookmarks) ? parsed.book.bookmarks : []).map((bookmark) => ({
    id: bookmark?.id || crypto.randomUUID(),
    name: bookmark?.name || "Untitled bookmark",
    pageId: bookmark?.pageId || null,
    orphaned: !pageRefs.some((page) => page.pageId === bookmark?.pageId),
    audioAssetId: remapAssetId(bookmark?.audioAssetId),
    audioName: bookmark?.audioName || ""
  }));
  const record = {
    id: newBookId,
    schemaVersion: CURRENT_BOOK_SCHEMA_VERSION,
    title: parsed.book.title || "Untitled score",
    composer: parsed.book.composer || "",
    pageRefs,
    pageCount: pageRefs.length,
    bookmarks,
    audioAssetId: remapAssetId(parsed.book.audioAssetId),
    audioName: parsed.book.audioName || "",
    showPageNumbers: Boolean(parsed.book.showPageNumbers),
    updatedAt: new Date().toISOString()
  };

  const estimatedBytes = importedAssets.reduce((total, asset) => total + asset.size, 0);
  const storage = await getStorageStatus();
  if (storage.quota && storage.usage + estimatedBytes > storage.quota * 0.95) {
    throw new Error("There is not enough browser storage to import this book.");
  }

  const database = await getDatabase();
  const transaction = database.transaction([BOOKS_STORE, ASSETS_STORE], "readwrite");
  const assets = transaction.objectStore(ASSETS_STORE);
  importedAssets.forEach((asset) => assets.put(asset));
  transaction.objectStore(BOOKS_STORE).put(record);
  try {
    await transactionDone(transaction);
  } catch (error) {
    throw new Error(`The book could not be imported: ${error?.message || "Unknown storage error"}`);
  }
  return { id: record.id, title: record.title };
}

export async function deleteBook(bookId) {
  const database = await getDatabase();
  const readTransaction = database.transaction(ASSETS_STORE, "readonly");
  const assetKeys = await requestResult(readTransaction.objectStore(ASSETS_STORE).index(ASSET_BOOK_INDEX).getAllKeys(bookId));
  await transactionDone(readTransaction);

  const transaction = database.transaction([BOOKS_STORE, ASSETS_STORE], "readwrite");
  transaction.objectStore(BOOKS_STORE).delete(bookId);
  const assets = transaction.objectStore(ASSETS_STORE);
  assetKeys.forEach((assetId) => assets.delete(assetId));
  await transactionDone(transaction);
}

export async function __resetRepositoryForTests() {
  if (databasePromise) {
    try { (await databasePromise).close(); } catch { /* test cleanup */ }
  }
  databasePromise = null;
  migrationPromise = null;
}
