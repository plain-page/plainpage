// ---- Library backup: export the whole local library + reading progress to
// a single .json file, and import one back in. This is the manual,
// no-server alternative to cloud sync: a way to carry your library to a new
// device, or recover it, entirely under your own control. The file is your
// actual books (chapters, covers, images, descriptions, statuses, group
// membership — everything parseEpub()/book-info produced), your chapter-level
// reading progress, your custom group names, and your saved themes, fonts,
// and reading settings — so it's a real, complete backup of your setup.

function backupFilename() {
  var d = new Date(),
    pad = function(n) {
      return String(n).padStart(2, "0")
    };
  return "plainpage-backup-" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".json"
}

// The subset of `state` that counts as "settings" for backup purposes —
// everything the reading/appearance settings panel controls, plus saved
// themes and fonts. Deliberately excludes session/runtime fields like
// currentChapter, lastOpenBookId, libraryOpen, and progress (progress is
// handled separately, keyed by book id).
var BACKUP_SETTINGS_KEYS = ["bodySize", "bodySpacing", "bodyIndent", "bodyFont", "titleFont", "authorFont", "themeMode", "customPaper", "customInk", "customFontName", "customFontUrl", "savedFonts", "activeFontIndex", "customBgUrl", "bgSize", "savedThemes", "activeThemeIndex", "margin", "wpm", "librarySort", "sortByScope"];

function collectBackupSettings() {
  var out = {};
  BACKUP_SETTINGS_KEYS.forEach(function(key) {
    key in state && (out[key] = state[key])
  });
  return out
}

// Metadata (loadLibraryList()) no longer carries chapters/images/toc, but a
// backup is supposed to be a complete, standalone copy — so each book's
// content is fetched from the content store and merged back in before the
// file is written. This is the one place that needs every book's full
// content at once, same as the old pre-split getAll() did; it's just scoped
// to "the user explicitly asked to export", not "every app startup".
function exportLibrary() {
  var metaBooks = loadLibraryList();
  if (!metaBooks.length) return void showToast("Your library is empty — nothing to export.");
  showToast("Preparing backup…");
  Promise.all(metaBooks.map(function(b) {
    return idbGetBookContent(b.id).then(function(content) {
      return content ? Object.assign({}, b, { chapters: content.chapters, images: content.images, toc: content.toc }) : Object.assign({}, b)
    }).catch(function() { return b })
  })).then(function(books) {
    var payload = {
      type: "plainpage-backup",
      version: 2,
      exportedAt: Date.now(),
      books: books,
      progress: state.progress || {},
      groupNames: loadGroupNames(),
      settings: collectBackupSettings()
    };
    var json;
    try {
      json = JSON.stringify(payload)
    } catch (e) {
      return void showToast("Couldn't prepare the backup — try again.")
    }
    downloadBackup(json, books.length)
  })
}

// Compresses the backup with gzip when the browser supports the
// CompressionStream API (all current major browsers; Safari since 16.4)
// and falls back to a plain, uncompressed .json file otherwise — so this
// never blocks the export, it just doesn't shrink it as much on an old
// browser. Base64 image/font data doesn't compress much further (it's
// already-compressed binary), but the chapter HTML, JSON structure, and
// repeated keys across dozens/hundreds of books typically shrink a lot.
function downloadBackup(json, bookCount) {
  function finish(blob, filename) {
    var url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url, a.download = filename, document.body.appendChild(a), a.click(), a.remove();
    setTimeout(function() {
      URL.revokeObjectURL(url)
    }, 1000);
    showToast("Exported " + bookCount + (1 === bookCount ? " book" : " books") + " to a backup file.")
  }
  if (window.CompressionStream) {
    new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).blob().then(function(compressed) {
      finish(compressed, backupFilename() + ".gz")
    }).catch(function() {
      finish(new Blob([json], { type: "application/json" }), backupFilename())
    })
  } else {
    finish(new Blob([json], { type: "application/json" }), backupFilename())
  }
}

// Adds any saved theme/font from a backup that isn't already present locally
// (matched by name), and returns a map from the backup array's index to
// wherever that item now lives in the local list — either an existing local
// index (name already existed) or a freshly appended one. This is needed
// because state.bodyFont/titleFont/authorFont and activeThemeIndex/
// activeFontIndex reference saved themes/fonts by index ("saved-3"), and
// after merging into a non-empty local list those indices can shift.
function mergeNamedList(localList, importedList) {
  var indexMap = {},
    nameToIndex = {};
  localList.forEach(function(item, i) {
    nameToIndex[item.name] = i
  });
  (importedList || []).forEach(function(item, i) {
    if (!item || !item.name) return;
    if (nameToIndex.hasOwnProperty(item.name)) indexMap[i] = nameToIndex[item.name];
    else {
      localList.push(item);
      indexMap[i] = localList.length - 1;
      nameToIndex[item.name] = indexMap[i]
    }
  });
  return indexMap
}

function remapSavedRef(ref, indexMap) {
  if ("string" == typeof ref && 0 === ref.indexOf("saved-")) {
    var idx = parseInt(ref.slice(6), 10);
    return indexMap.hasOwnProperty(idx) ? "saved-" + indexMap[idx] : "default"
  }
  return ref
}

// Applies a backup's settings bundle to the live app: saved themes/fonts are
// merged in alongside whatever's already saved locally (skipping name
// collisions); everything else in the bundle overwrites the current value,
// since there's no sensible way to "merge" a single font size or margin.
function applyBackupSettings(settings) {
  var fontIndexMap = mergeNamedList(state.savedFonts, settings.savedFonts),
    themeIndexMap = mergeNamedList(state.savedThemes, settings.savedThemes);
  Object.keys(settings).forEach(function(key) {
    "savedFonts" !== key && "savedThemes" !== key && (state[key] = settings[key])
  });
  state.bodyFont = remapSavedRef(state.bodyFont, fontIndexMap);
  state.titleFont = remapSavedRef(state.titleFont, fontIndexMap);
  state.authorFont = remapSavedRef(state.authorFont, fontIndexMap);
  "number" == typeof state.activeFontIndex && (state.activeFontIndex = fontIndexMap.hasOwnProperty(state.activeFontIndex) ? fontIndexMap[state.activeFontIndex] : -1);
  "number" == typeof state.activeThemeIndex && (state.activeThemeIndex = themeIndexMap.hasOwnProperty(state.activeThemeIndex) ? themeIndexMap[state.activeThemeIndex] : -1);

  bodySizeInput.value = state.bodySize, bodySpacingInput.value = state.bodySpacing, bodyIndentInput.value = state.bodyIndent, marginInput.value = state.margin, document.documentElement.style.setProperty("--margin", (state.margin || 12) + "%"), wpmInput.value = state.wpm, customPaperInput.value = state.customPaper, customInkInput.value = state.customInk;

  applyBodyTypography(), applyTitleFont(), applyAuthorFont(), updateCustomFontRowVisibility(), renderFontToggles();

  if (state.activeThemeIndex >= 0 && state.activeThemeIndex < state.savedThemes.length) state.themeMode = "saved", applyThemeByIndex(state.activeThemeIndex);
  else if ("custom" === state.themeMode) document.body.setAttribute("data-theme", "custom"), applyCustomTheme(state.customPaper, state.customInk, "custom");
  else document.body.removeAttribute("data-theme"), document.documentElement.style.setProperty("--paper", ""), document.documentElement.style.setProperty("--ink", ""), document.documentElement.style.setProperty("--ink-rgb", "");
  renderThemeToggles(), renderSavedThemesList();

  state.customBgUrl ? (document.body.classList.add("has-custom-bg"), document.documentElement.style.setProperty("--custom-bg-url", 'url("' + state.customBgUrl + '")'), bgFilename.textContent = "Custom background", bgPreview.style.backgroundImage = 'url("' + state.customBgUrl + '")', bgPreview.style.display = "block") : (document.body.classList.remove("has-custom-bg"), document.documentElement.style.setProperty("--custom-bg-url", "none"), bgFilename.textContent = "No background", bgPreview.style.display = "none");
  document.documentElement.style.setProperty("--bg-size", state.bgSize || "auto"), bgSizeGroup.querySelectorAll(".toggle-btn").forEach(function(b) {
    b.classList.toggle("is-selected", b.getAttribute("data-bg-size") === (state.bgSize || "auto"))
  })
}

// Merge-only for books and progress: existing books (matched by
// content-hash id, same as epub import dedup) are left untouched rather than
// overwritten, so re-importing an old backup can never clobber more recent
// progress on this device, and missing progress keys are filled in but never
// overwritten either. Custom group names fill in the same way. Saved themes
// and fonts are additive (see applyBackupSettings above). Everything else in
// "settings" (font sizes, margins, theme mode, etc.) is a single current
// value rather than a per-item list, so there's nothing to merge — importing
// those means overwriting what's on this device, which only happens if you
// confirm it.

// Reads a backup file as text, transparently decompressing it first if it's
// gzipped (by filename, since that's how downloadBackup() names them).
// Falls back to reading it as plain text — for older backups from before
// compression existed, or if DecompressionStream isn't available — so a
// .gz file downloaded on one device can still be imported on a browser
// that doesn't support decompression, as long as the user renames it back
// to .json (import will just fail cleanly with a parse-error toast if it's
// actually still gzipped bytes).
function readBackupFile(file) {
  var isGzip = /\.gz$/i.test(file.name);
  if (isGzip && window.DecompressionStream) {
    return new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text()
  }
  return new Promise(function(resolve, reject) {
    var reader = new FileReader;
    reader.onload = function(ev) { resolve(ev.target.result) };
    reader.onerror = function() { reject(reader.error) };
    reader.readAsText(file)
  })
}

function importLibraryBackup(file) {
  readBackupFile(file).then(function(text) {
    var data;
    try {
      data = JSON.parse(text)
    } catch (e) {
      return void showToast("That doesn't look like a valid backup file.")
    }
    if (!data || !Array.isArray(data.books)) return void showToast("That doesn't look like a plainpage backup file.");
    var list = loadLibraryList(),
      existingIds = {};
    list.forEach(function(b) {
      existingIds[b.id] = !0
    });
    var added = 0,
      restored = 0,
      skipped = 0,
      // saveLibraryList() below only ever touches the metadata store (see
      // idbReplaceAllBooks), so a new book's content has to be written to
      // the content store explicitly here, or it'd be silently dropped.
      newContent = [];
    data.books.forEach(function(book) {
      if (!book || !book.id) return;
      if (!existingIds[book.id]) {
        book.chapters && newContent.push({ id: book.id, chapters: book.chapters, images: book.images || [], toc: book.toc || [] });
        list.push(stripContentFields(book)), existingIds[book.id] = !0, added++;
        return
      }
      // Same id already in the library — most commonly because the book
      // was deleted and re-imported from the epub itself since this backup
      // was made, which recreates it as a blank "unread" record with the
      // same content-hash id. A full skip here (the old behavior) meant a
      // backup could never restore status/description/cover for a book
      // that technically already "exists" — which made this import
      // effectively a no-op for exactly the delete-and-reimport recovery
      // case it's meant to help with. Instead, backfill only fields that
      // are still at their untouched local default: anything the user
      // actually set locally (a real status change, a written description)
      // is left alone, so this still can't clobber a genuinely newer local
      // edit — it only recovers what would otherwise just be lost. Cover
      // is deliberately not part of this recovery: without a separate
      // original-cover backup (removed — see renderBookInfoCover in
      // 07-book-info.js) there's no reliable way to tell a user-uploaded
      // cover in the backup apart from the epub's own default one, so a
      // re-import's fresh cover just stands as-is.
      var idx = list.findIndex(function(b) { return b.id === book.id });
      if (-1 === idx) return void skipped++;
      var local = list[idx],
        changed = !1;
      "unread" === (local.status || "unread") && !local.completedAt && book.status && "unread" !== book.status && (local.status = book.status, book.completedAt && (local.completedAt = book.completedAt), changed = !0);
      !local.description && book.description && (local.description = book.description, changed = !0);
      !local.published && book.published && (local.published = book.published, changed = !0);
      book.customGroups && book.customGroups.length && (local.customGroups = local.customGroups || [], book.customGroups.forEach(function(k) {
        -1 === local.customGroups.indexOf(k) && (local.customGroups.push(k), changed = !0)
      }));
      changed ? restored++ : skipped++
    });
    if (currentBook) {
      var cbIdx = list.findIndex(function(b) { return b.id === currentBook.id });
      -1 !== cbIdx && (currentBook.status = list[cbIdx].status, currentBook.completedAt = list[cbIdx].completedAt, currentBook.description = list[cbIdx].description, currentBook.published = list[cbIdx].published, currentBook.cover = list[cbIdx].cover, currentBook.customGroups = list[cbIdx].customGroups)
    }
    if (data.progress && "object" == typeof data.progress) {
      state.progress = state.progress || {};
      Object.keys(data.progress).forEach(function(key) {
        key in state.progress || (state.progress[key] = data.progress[key])
      })
    }
    if (data.groupNames && "object" == typeof data.groupNames) {
      var localNames = loadGroupNames();
      Object.keys(data.groupNames).forEach(function(key) {
        key in localNames || (localNames[key] = data.groupNames[key])
      }), saveGroupNames(localNames)
    }
    var settingsRestored = !1;
    data.settings && "object" == typeof data.settings && Object.keys(data.settings).length && window.confirm("This backup also includes your reading settings, saved themes, and fonts. Import those too?\n\nSaved themes and fonts are added alongside your current ones. Other reading settings (size, spacing, margins, theme, etc.) will overwrite what's currently set on this device.") && (applyBackupSettings(data.settings), settingsRestored = !0);
    saveState();

    function finish(ok) {
      document.body.classList.contains("library-open") && renderLibrary();
      var parts = [];
      added && parts.push(added + (1 === added ? " book" : " books") + " imported");
      restored && parts.push(restored + (1 === restored ? " book" : " books") + " restored");
      skipped && parts.push(skipped + " already in your library");
      settingsRestored && parts.push("settings restored");
      if (!parts.length) return void showToast("Nothing new to import from that backup.");
      showToast(parts.join(", ") + (ok ? "." : " — though the save may not have fully completed."))
    }
    added || restored ? Promise.all(newContent.map(idbPutBookContent)).then(function() {
      return saveLibraryList(list)
    }).then(finish) : finish(!0)
  }).catch(function() {
    showToast("Couldn't read that backup file.")
  })
}

var libraryExportBtn = $("#libraryExportBtn"),
  libraryImportBtn = $("#libraryImportBtn"),
  libraryImportInput = $("#libraryImportInput");
libraryExportBtn && libraryExportBtn.addEventListener("click", exportLibrary);
libraryImportBtn && libraryImportBtn.addEventListener("click", function() {
  libraryImportInput.click()
});
libraryImportInput && libraryImportInput.addEventListener("change", function() {
  var file = this.files[0];
  this.value = "", file && importLibraryBackup(file)
});
