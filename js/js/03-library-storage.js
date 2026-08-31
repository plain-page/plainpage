// ---- Library storage: IndexedDB-backed, with a synchronous in-memory cache ----

var LIBRARY_KEY = "reader_library",
  currentSort = "recent";

// ---- Library storage: IndexedDB-backed, with a synchronous in-memory cache ----
// (localStorage caps out around 5-10MB total, which a full epub library blows
// through fast. IndexedDB has a much larger quota. The rest of the app still
// calls loadLibraryList()/saveLibraryList() synchronously, so we keep an
// in-memory mirror that's kept authoritative, and persist it to IndexedDB in
// the background.)
//
// Each book is split across two object stores:
//   - "books"   — lightweight metadata: title, author, status, progress,
//                 cover, description, groups, etc. This is everything the
//                 library grid, group shelves, and book-info modal need, and
//                 it's what initLibraryStorage() loads in full at startup.
//   - "content" — the heavy stuff: chapter HTML, embedded images (up to 60
//                 per book), and the parsed TOC tree. Only fetched when a
//                 specific book is actually opened.
// This is why startup used to take 10-12s with a large library: getAll() on
// a single combined store had to deserialize every byte of every book (full
// text + full-res images) before the grid could render anything, even though
// the grid only ever displays a title, author, status, and cover. Splitting
// the record means the metadata store getAll() at startup is cheap and scales
// with library size, not with total content size.
var LIBRARY_DB_NAME = "readerLibraryDB",
  LIBRARY_STORE = "books",
  CONTENT_STORE = "content",
  LIBRARY_DB_VERSION = 2,
  CONTENT_FIELDS = ["chapters", "images", "toc"],
  libraryCache = [],
  libraryDBPromise = null,
  // Chapter HTML/text compresses very well (it's the same kind of text a
  // zip's DEFLATE already shrinks 3-5x inside the original epub, before the
  // parser expands it back out to plain HTML). Gzipping it again before it
  // hits IndexedDB claws a lot of that back, without touching how the app
  // reads or renders it — decompression happens once, right when a book is
  // opened, using the same CompressionStream/DecompressionStream APIs
  // already standard in current Chrome/Edge/Firefox and Safari 16.4+.
  supportsContentCompression = typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

// Compresses a plain object to gzip bytes for storage. Resolves to null
// (never rejects) if compression isn't supported or anything about it
// fails — callers treat null as "store this uncompressed instead", the
// same never-throws philosophy as downscaleImageDataUrl: a bigger content
// record is a much better outcome than a book that fails to save.
function compressContentPayload(obj) {
  if (!supportsContentCompression) return Promise.resolve(null);
  try {
    var bytes = new TextEncoder().encode(JSON.stringify(obj)),
      cs = new CompressionStream("gzip"),
      writer = cs.writable.getWriter();
    writer.write(bytes), writer.close();
    return new Response(cs.readable).arrayBuffer().then(function(buf) {
      return new Uint8Array(buf)
    }).catch(function() { return null })
  } catch (e) {
    return Promise.resolve(null)
  }
}

// Reverses compressContentPayload. Only ever called on bytes this app
// itself wrote (records are tagged with compressed:true — see
// idbGetBookContent), so a failure here means corrupted/truncated data
// rather than a format mismatch; it rejects so the caller's loadBook flow
// can surface a real error instead of silently handing back an empty book.
function decompressContentPayload(bytes) {
  var ds = new DecompressionStream("gzip"),
    writer = ds.writable.getWriter();
  writer.write(bytes), writer.close();
  return new Response(ds.readable).arrayBuffer().then(function(buf) {
    return JSON.parse(new TextDecoder().decode(buf))
  })
}

// Returns a shallow copy of `book` with the heavy content fields removed —
// this is the shape that's safe to write to the "books" (metadata) store.
function stripContentFields(book) {
  var meta = {};
  for (var key in book) CONTENT_FIELDS.indexOf(key) === -1 && (meta[key] = book[key]);
  return meta;
}

// Returns { id, chapters, images, toc } if `book` actually carries content
// fields (e.g. it just came from parseEpub() or a full backup import), or
// null if it's a metadata-only record (the common case for anything read
// back out of loadLibraryList()). Callers use null to mean "don't touch
// the content store" rather than "write empty content" — that distinction
// is what keeps a routine metadata edit (status, group, progress) from ever
// wiping out a book's already-stored chapters/images.
function extractContentFields(book) {
  if (!book || !book.chapters) return null;
  return {
    id: book.id,
    chapters: book.chapters,
    images: book.images || [],
    toc: book.toc || []
  }
}

function openLibraryDB() {
  if (libraryDBPromise) return libraryDBPromise;
  libraryDBPromise = new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error("IndexedDB not supported")); return }
    var req = indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);
    // Fires if another tab (or another copy of this page) still holds an
    // open connection to the old database version — the browser won't run
    // onupgradeneeded until that connection closes, so without this the
    // open() call just hangs forever with no error and no timeout. We can't
    // force the other tab closed, but we can stop it from looking like a
    // silent freeze.
    req.onblocked = function() {
      console.warn("IndexedDB upgrade blocked by another open tab/connection.");
      var textEl = document.getElementById("loadingOverlayText");
      textEl && (textEl.textContent = "Still loading — try closing other tabs of this app, then reload")
    };
    req.onupgradeneeded = function(e) {
      var db = e.target.result,
        tx = e.target.transaction,
        fromVersion = e.oldVersion || 0;
      db.objectStoreNames.contains(LIBRARY_STORE) || db.createObjectStore(LIBRARY_STORE, { keyPath: "id" });
      var contentStoreIsNew = !db.objectStoreNames.contains(CONTENT_STORE);
      contentStoreIsNew && db.createObjectStore(CONTENT_STORE, { keyPath: "id" });
      // Migrating an existing (v1) database: the "books" store currently
      // holds full combined records (content fields inline). Split every
      // existing record so old libraries get the same fast-startup shape
      // as freshly-created ones, without losing any chapters/images.
      if (fromVersion > 0 && fromVersion < 2 && contentStoreIsNew) {
        var booksStore = tx.objectStore(LIBRARY_STORE),
          contentStore = tx.objectStore(CONTENT_STORE);
        booksStore.openCursor().onsuccess = function(ev) {
          var cursor = ev.target.result;
          if (!cursor) return;
          var full = cursor.value,
            content = extractContentFields(full);
          content && contentStore.put(content);
          cursor.update(stripContentFields(full));
          cursor.continue()
        }
      }
    };
    req.onsuccess = function(e) {
      var db = e.target.result;
      // If some *other* tab later opens a newer version of this database,
      // that open() call would otherwise hang the same way this one just
      // risked hanging. Closing our connection when that happens lets the
      // other tab's upgrade proceed instead of blocking on us; the reload
      // picks the new version back up. (This only protects future opens —
      // it can't rescue an *already-open* stale tab that's currently
      // blocking someone else, since that tab is running the old code
      // that doesn't know to do this.)
      db.onversionchange = function() { db.close(), location.reload() };
      resolve(db)
    };
    req.onerror = function(e) { reject(e.target.error) }
  });
  return libraryDBPromise
}

function idbGetAllBooks() {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction(LIBRARY_STORE, "readonly").objectStore(LIBRARY_STORE).getAll();
      req.onsuccess = function() { resolve(req.result || []) };
      req.onerror = function() { reject(req.error) }
    })
  })
}

// Records written before this change (or written when compression isn't
// supported) store chapters/images/toc directly on the record, with no
// `compressed` key at all — this reads those back exactly as before.
// Records written since carry `compressed: true` and their payload gzipped
// under `data`; those get transparently inflated here so every other
// caller (loadBook, the v1->v2 migration, etc.) keeps seeing the same
// { id, chapters, images, toc } shape regardless of how it's stored on disk.
function idbGetBookContent(id) {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction(CONTENT_STORE, "readonly").objectStore(CONTENT_STORE).get(id);
      req.onsuccess = function() { resolve(req.result || null) };
      req.onerror = function() { reject(req.error) }
    })
  }).then(function(record) {
    if (!record) return null;
    if (record.compressed) return decompressContentPayload(record.data).then(function(payload) {
      return { id: id, chapters: payload.chapters, images: payload.images || [], toc: payload.toc || [] }
    });
    return record
  })
}

// Called wherever a book is removed from the library, so its content
// record doesn't linger in IndexedDB forever after the metadata is gone.
function idbDeleteBookContent(id) {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(CONTENT_STORE, "readwrite");
      tx.objectStore(CONTENT_STORE).delete(id);
      tx.oncomplete = function() { resolve(!0) };
      tx.onerror = function() { reject(tx.error) }
    })
  }).catch(function(err) {
    console.error("Failed to delete book content from IndexedDB", err);
    return !1
  })
}

function idbPutBookContent(content) {
  var id = content.id,
    payload = { chapters: content.chapters, images: content.images || [], toc: content.toc || [] };
  return compressContentPayload(payload).then(function(compressed) {
    var record = compressed ?
      { id: id, compressed: !0, data: compressed } :
      { id: id, compressed: !1, chapters: payload.chapters, images: payload.images, toc: payload.toc };
    return openLibraryDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(CONTENT_STORE, "readwrite");
        tx.objectStore(CONTENT_STORE).put(record);
        tx.oncomplete = function() { resolve(!0) };
        tx.onerror = function() { reject(tx.error) }
      })
    })
  })
}

// Replaces the *metadata* store wholesale with `list`. Deliberately never
// touches the content store — bulk operations (sorting, status changes,
// group edits, deletes) all flow through here with metadata-only records,
// and content only ever gets written explicitly via idbPutBook/
// idbPutBookContent. If this cleared/rewrote content on every metadata save,
// any routine "mark as read" would wipe every book's chapters.
function idbReplaceAllBooks(list) {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(LIBRARY_STORE, "readwrite"),
        store = tx.objectStore(LIBRARY_STORE);
      store.clear();
      list.forEach(function(book) { store.put(stripContentFields(book)) });
      tx.oncomplete = function() { resolve(!0) };
      tx.onerror = function() { reject(tx.error) }
    })
  })
}

// Called once at startup before init(). Loads existing metadata into the
// in-memory cache, or migrates old localStorage data in on first run.
function initLibraryStorage() {
  return openLibraryDB().then(function() {
    return idbGetAllBooks()
  }).then(function(existing) {
    if (existing && existing.length) { libraryCache = existing; return }
    var raw = null;
    try { raw = localStorage.getItem(LIBRARY_KEY) } catch (e) {}
    var oldList = [];
    if (raw) { try { oldList = JSON.parse(raw) || [] } catch (e) { oldList = [] } }
    if (!oldList.length) { libraryCache = []; return }
    libraryCache = oldList.map(stripContentFields);
    var contentWrites = oldList.map(extractContentFields).filter(Boolean);
    return idbReplaceAllBooks(oldList).then(function() {
      return Promise.all(contentWrites.map(idbPutBookContent))
    }).then(function() {
      try { localStorage.removeItem(LIBRARY_KEY) } catch (e) {}
    })
  }).catch(function(err) {
    console.error("Library storage failed to initialize, starting with an empty library.", err);
    libraryCache = []
  })
}

function loadLibraryList() {
  return libraryCache
}

// Anything imported or uploaded before cover thumbnailing existed (or
// before this cleanup existed) is still sitting in storage at full
// resolution. This finds those and shrinks them one at a time in the
// background, with a short pause between each so it never competes with
// the UI thread. It can't speed up the load that's already happening —
// only future getAll() calls benefit from a book's metadata actually
// being smaller — so it's meant to be kicked off once startup has
// settled, not awaited by anything.
//
// This pass also drops `originalCover` wherever it still exists. That
// field backed a "restore original cover" feature that's been removed
// (see renderBookInfoCover in 07-book-info.js); every book imported
// before this change is still carrying it as a byte-for-byte duplicate
// of `cover` (import set both to the same string — see 06-epub-parser.js),
// so on a large library it was quietly doubling the metadata store's
// cover bytes for no benefit. New imports never set it, so this is a
// one-time cleanup, not an ongoing cost.
var OVERSIZED_COVER_CHARS = 230000; // ~170KB decoded; a 720px-max-dim JPEG thumbnail at .90 quality runs well under this
function needsCoverCleanup(book) {
  return (book.cover && book.cover.length > OVERSIZED_COVER_CHARS) || "originalCover" in book
}

function cleanupOversizedCoversInBackground() {
  var targets = libraryCache.filter(needsCoverCleanup);
  if (!targets.length) return;
  console.log("Cleaning up covers for " + targets.length + " book(s) in the background\u2026");
  var i = 0;

  function next() {
    if (i >= targets.length) return void console.log("Cover cleanup done.");
    var book = targets[i++],
      coverNeedsShrink = book.cover && book.cover.length > OVERSIZED_COVER_CHARS;
    (coverNeedsShrink ? downscaleImageDataUrl(book.cover, 720, .9) : Promise.resolve(book.cover)).then(function(shrunkCover) {
      book.cover = shrunkCover, delete book.originalCover;
      return idbPutBook(book)
    }).catch(function(err) {
      console.error("Cover cleanup failed for a book, leaving it as-is", err)
    }).then(function() {
      setTimeout(next, 30)
    })
  }
  next()
}

// Reads every record straight out of the content store, uninterpreted —
// unlike idbGetBookContent, this deliberately does NOT decompress anything,
// since compressContentInBackground needs to tell compressed records apart
// from legacy ones, not just read their content.
function idbGetAllContentRecords() {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction(CONTENT_STORE, "readonly").objectStore(CONTENT_STORE).getAll();
      req.onsuccess = function() { resolve(req.result || []) };
      req.onerror = function() { reject(req.error) }
    })
  })
}

// Any book imported before compression existed (or imported while
// compression wasn't supported, e.g. an older browser) has its content
// record sitting on disk with no `compressed` key at all — see
// idbGetBookContent. This finds those and rewrites them through
// idbPutBookContent, one at a time with a short pause between each so it
// never competes with the UI thread, the same approach
// cleanupOversizedCoversInBackground uses for oversized covers. No-op if
// this browser doesn't support compression, since there'd be nothing to
// convert legacy records to.
function compressContentInBackground() {
  if (!supportsContentCompression) return;
  idbGetAllContentRecords().then(function(records) {
    var targets = records.filter(function(r) { return r && !("compressed" in r) });
    if (!targets.length) return;
    console.log("Compressing stored content for " + targets.length + " book(s) in the background\u2026");
    var i = 0;

    function next() {
      if (i >= targets.length) return void console.log("Content compression done.");
      var record = targets[i++];
      idbPutBookContent({ id: record.id, chapters: record.chapters, images: record.images || [], toc: record.toc || [] }).catch(function(err) {
        console.error("Content compression failed for a book, leaving it as-is", err)
      }).then(function() {
        setTimeout(next, 30)
      })
    }
    next()
  }).catch(function(err) {
    console.error("Failed to read content store for compression migration", err)
  })
}

// Writes both halves of `book` where applicable: metadata always goes to
// the "books" store; content (chapters/images/toc) only goes to the
// "content" store when `book` actually carries those fields — e.g. the
// currently-open book (which loadBook() merges content onto), a freshly
// parsed epub, or a book restored from a full backup. A metadata-only book
// object (the common shape coming out of loadLibraryList()) leaves the
// content store untouched.
function idbPutBook(book) {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(LIBRARY_STORE, "readwrite");
      tx.objectStore(LIBRARY_STORE).put(stripContentFields(book));
      tx.oncomplete = function() { resolve(!0) };
      tx.onerror = function() { reject(tx.error) }
    })
  }).then(function(ok) {
    var content = extractContentFields(book);
    return content ? idbPutBookContent(content).then(function() { return ok }) : ok
  })
}

// Reading progress fires on every scroll tick. Update the in-memory cache
// instantly (cheap), but only write the single changed book to IndexedDB
// after scrolling settles, instead of rewriting the whole library every tick.
var persistBookDebounceTimers = {};
function persistBookDebounced(book) {
  var idx = libraryCache.findIndex(function(b) { return b.id === book.id });
  idx !== -1 ? libraryCache[idx] = book : libraryCache.push(book);
  var id = book.id;
  persistBookDebounceTimers[id] && clearTimeout(persistBookDebounceTimers[id]);
  persistBookDebounceTimers[id] = setTimeout(function() {
    delete persistBookDebounceTimers[id];
    idbPutBook(book).catch(function(err) {
      console.error("Failed to persist reading progress to IndexedDB", err)
    })
  }, 500)
}

// Returns a promise resolving to true/false (never rejects — failures are
// already reported to the user here). The book-list argument is applied to
// the in-memory cache immediately either way, since that's what the rest of
// the app reads synchronously; only the persisted (IndexedDB) copy can fail.
// Metadata-only: see idbReplaceAllBooks for why content is never touched here.
function saveLibraryList(list) {
  libraryCache = list;
  return idbReplaceAllBooks(list).then(function() {
    return !0
  }).catch(function(err) {
    console.error("Failed to persist library to IndexedDB", err);
    showToast("Could not save your library changes.");
    return !1
  })
}
