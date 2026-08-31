// ---- Settings panel toggle + library shelf UI: sorting, groups, selection mode, bulk actions ----

var settingsPanel = $("#settingsPanel"),
  settingsToggle = $("#settingsToggle"),
  settingsClose = $("#settingsClose");

function openSettings() {
  closeSidebar(), closeSearch(), settingsPanel.classList.add("is-open"), sidebarBackdrop.classList.add("is-open"), settingsToggle.classList.add("is-active")
}

// Reports how much of the browser's storage quota this site is using
// (IndexedDB books + localStorage settings together, since the browser
// tracks them as one per-origin pool). Refreshed each time the library's
// "more options" menu opens so the number is never far out of date,
// without polling in the background.
function updateStorageUsage() {
  var textEl = $("#storageUsageText"),
    barEl = $("#storageUsageBar");
  if (!textEl) return;
  if (!navigator.storage || !navigator.storage.estimate) return void(textEl.textContent = "Storage usage isn't available in this browser.");
  navigator.storage.estimate().then(function(est) {
    var used = est.usage || 0,
      quota = est.quota || 0,
      usedGb = (used / (1024 * 1024 * 1024)).toFixed(2);
    if (!quota) return void(textEl.textContent = usedGb + " GB used.");
    var pct = Math.min(100, used / quota * 100),
      quotaGb = (quota / (1024 * 1024 * 1024)).toFixed(2);
    barEl && (barEl.style.width = pct.toFixed(1) + "%"), textEl.textContent = usedGb + " GB used of about " + quotaGb + " GB available (" + pct.toFixed(1) + "%)."
  }).catch(function() {
    textEl.textContent = "Couldn't check storage usage."
  })
}

function closeSettings() {
  settingsPanel.classList.remove("is-open"), sidebar.classList.contains("is-open") || sidebarBackdrop.classList.remove("is-open"), settingsToggle.classList.remove("is-active")
}
settingsToggle.addEventListener("click", function(e) {
  e.stopPropagation(), settingsPanel.classList.contains("is-open") ? closeSettings() : openSettings()
}), settingsClose.addEventListener("click", closeSettings), sidebarBackdrop.addEventListener("click", function() {
  closeSidebar(), closeSettings()
});
var libraryToggle = $("#libraryToggle"),
  libraryView = $("#libraryView"),
  libraryMenuBtn = $("#libraryMenuBtn"),
  libraryMenuDropdown = $("#libraryMenuDropdown"),
  librarySortToggle = $("#librarySortToggle"),
  libraryAddToggle = $("#libraryAddToggle"),
  libraryAddDropdown = $("#libraryAddDropdown"),
  libraryMenuExportBtn = $("#libraryMenuExportBtn"),
  libraryMenuImportBtn = $("#libraryMenuImportBtn"),
  libraryFileInput = $("#libraryFileInput"),
  folderImportInput = $("#folderImportInput"),
  libraryBody = $("#libraryBody"),
  librarySearchInput = $("#librarySearchInput"),
  sortDropdown = $("#sortDropdown"),
  libraryBackBtn = $("#libraryBackBtn"),
  libraryLabelText = $("#libraryLabelText"),
  currentGroupFilter = null,
  GROUP_NAMES_KEY = "reader_group_names",
  HIDDEN_GROUPS_KEY = "reader_hidden_groups";

// Collapses whichever of the menu's two accordion sections (Sort / Add) is
// currently expanded, without touching whether the menu itself is open.
function closeLibraryMenuSubmenus() {
  [librarySortToggle, libraryAddToggle].forEach(function(toggle) {
    toggle.parentElement.classList.remove("is-open"), toggle.setAttribute("aria-expanded", "false")
  })
}

function closeLibraryMenu() {
  libraryMenuDropdown.classList.remove("is-open"), libraryMenuBtn.setAttribute("aria-expanded", "false"), closeLibraryMenuSubmenus()
}

function currentSortScopeKey() {
  return currentGroupFilter || "library"
}

function getScopeSort(key) {
  return state.sortByScope && state.sortByScope[key] || "recent"
}

function setScopeSort(key, sortType) {
  state.sortByScope = state.sortByScope || {}, state.sortByScope[key] = sortType, saveState()
}

function updateSortDropdownUI() {
  sortDropdown.querySelectorAll("button[data-sort]").forEach(function(b) {
    b.classList.toggle("is-active", b.getAttribute("data-sort") === currentSort)
  })
}

function loadGroupNames() {
  try {
    return JSON.parse(localStorage.getItem(GROUP_NAMES_KEY)) || {}
  } catch (e) {
    return {}
  }
}

function saveGroupNames(map) {
  try {
    localStorage.setItem(GROUP_NAMES_KEY, JSON.stringify(map))
  } catch (e) {}
}

function groupName(key) {
  var names = loadGroupNames();
  return names[key] || "Group"
}

// Groups marked hidden are excluded from the main library grid (the same
// way "Completed" books used to be, before that became a plain status
// instead of its own shelf) — everything else about the group is unaffected.
function loadHiddenGroups() {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_GROUPS_KEY)) || {}
  } catch (e) {
    return {}
  }
}

function saveHiddenGroups(map) {
  try {
    localStorage.setItem(HIDDEN_GROUPS_KEY, JSON.stringify(map))
  } catch (e) {}
}

function isGroupHidden(key) {
  return !!loadHiddenGroups()[key]
}

function toggleGroupHidden(key) {
  var hidden = loadHiddenGroups();
  hidden[key] ? delete hidden[key] : hidden[key] = !0, saveHiddenGroups(hidden)
}

function getGroupBooks(list, key) {
  return "recent" === key ? list.filter(function(b) {
    return "reading" === b.status || "complete" === b.status
  }).slice().sort(function(a, b) {
    return (b.lastOpened || 0) - (a.lastOpened || 0)
  }).slice(0, 10) : list.filter(function(b) {
    return (b.customGroups || []).indexOf(key) !== -1
  }).slice().sort(function(a, b) {
    return (b.lastOpened || 0) - (a.lastOpened || 0)
  })
}

function isCustomGroupKey(key) {
  return !!key && "recent" !== key
}

function listCustomGroupKeys(list) {
  var keys = [];
  return list.forEach(function(b) {
    (b.customGroups || []).forEach(function(k) {
      -1 === keys.indexOf(k) && keys.push(k)
    })
  }), keys
}

function buildCustomGroups(list) {
  var groups = [];
  return listCustomGroupKeys(list).forEach(function(key) {
    var books = getGroupBooks(list, key);
    books.length && groups.push({
      key: key,
      books: books
    })
  }), groups
}

function renderGroupTile(key, books) {
  var covers = books.slice(0, 4),
    hidden = isGroupHidden(key),
    coverHtml = function(book) {
      return book.cover ? '<img src="' + book.cover + '" alt="">' : '<div class="placeholder">' + escapeHtml((book.title || "?").charAt(0).toUpperCase()) + "</div>"
    },
    pick = function(i) {
      return covers[i] || covers[covers.length - 1]
    },
    layersHtml = '<div class="group-tile-card layer-3">' + coverHtml(pick(3)) + '</div><div class="group-tile-card layer-2">' + coverHtml(pick(2)) + '</div><div class="group-tile-card layer-1">' + coverHtml(pick(1)) + '</div><div class="group-tile-card layer-0">' + coverHtml(pick(0)) + "</div>";
  return '<div class="group-tile' + (hidden ? " is-hidden-group" : "") + '" data-group="' + key + '" role="button" tabindex="0"><div class="group-tile-stack"><span class="group-tile-count">' + books.length + '</span>' + layersHtml + (hidden ? '<span class="group-tile-hidden-badge">Hidden</span>' : "") + '</div><div class="group-tile-label">' + escapeHtml(groupName(key)) + '</div><div class="group-tile-sub">' + books.length + (1 === books.length ? " book" : " books") + "</div></div>"
}

// Small covers used for the "Recently Read" row, where books sit directly
// in the shelf (no group tile) — reuses .library-tile so the shelf-wide
// click/contextmenu wiring in renderLibrary() opens/right-clicks them like
// any other book tile.
function renderShelfBookTile(book) {
  var coverHtml = book.cover ? '<img src="' + book.cover + '" alt="' + escapeHtml(book.title) + '" loading="lazy" decoding="async">' : '<div class="placeholder">' + escapeHtml((book.title || "?").charAt(0).toUpperCase()) + "</div>";
  return '<div class="library-tile library-tile-shelf" data-book-id="' + book.id + '">' + coverHtml + "</div>"
}

// Wraps a row of tiles (recently-read books or group tiles) with a label
// and scroll arrows. `id` distinguishes multiple rows on the page so their
// arrow-wiring in renderLibrary() doesn't cross-wire with each other.
function renderShelfRowWrap(id, label, tilesHtml) {
  return '<div class="library-shelf"><div class="library-shelf-label">' + escapeHtml(label) + '</div><div class="library-shelf-row-wrap"><button aria-label="Scroll left" class="shelf-arrow shelf-arrow-left" data-shelf-arrow="left" type="button"><svg fill="none" viewbox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></button><div class="library-shelf-row" data-shelf-row="' + id + '">' + tilesHtml + '</div><button aria-label="Scroll right" class="shelf-arrow shelf-arrow-right is-visible" data-shelf-arrow="right" type="button"><svg fill="none" viewbox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></button></div></div>'
}

function renderRecentRowHtml(list) {
  var books = getGroupBooks(list, "recent");
  return books.length ? renderShelfRowWrap("recent", "Recently Read", books.map(renderShelfBookTile).join("")) : ""
}

function renderGroupsRowHtml(list) {
  var groups = buildCustomGroups(list);
  return groups.length ? renderShelfRowWrap("groups", "Groups", groups.map(function(g) {
    return renderGroupTile(g.key, g.books)
  }).join("")) : ""
}

function updateLibraryHeader() {
  currentGroupFilter ? (libraryBackBtn.hidden = !1, libraryLabelText.textContent = groupName(currentGroupFilter), libraryLabelText.classList.add("is-editable"), libraryAddToggle.parentElement.style.display = "none") : (libraryBackBtn.hidden = !0, libraryLabelText.textContent = "Library", libraryLabelText.classList.remove("is-editable"), libraryAddToggle.parentElement.style.display = "")
}

function libraryDocTitle() {
  return currentGroupFilter ? "plainpage · " + groupName(currentGroupFilter) : "plainpage · library"
}

function enterGroup(key) {
  currentGroupFilter = key, currentSort = getScopeSort(currentSortScopeKey()), updateSortDropdownUI(), renderLibrary(), libraryView.scrollTop = 0, document.title = libraryDocTitle()
}

function exitGroup() {
  currentGroupFilter = null, currentSort = getScopeSort(currentSortScopeKey()), updateSortDropdownUI(), renderLibrary(), libraryView.scrollTop = 0, document.title = libraryDocTitle()
}

function openLibrary() {
  closeSidebar(), closeSettings(), closeSearch(), document.body.classList.add("library-open"), libraryToggle.classList.add("is-active"), renderLibrary(), document.title = libraryDocTitle(), state.libraryOpen = !0, saveState(), syncUrlHash()
}

function updateReaderDocumentTitle() {
  if (!currentBook) return void(document.title = "plainpage");
  var titleCh = currentBook.chapters.find(function(c) {
    return c.id === state.currentChapter;
  });
  var chTitle = titleCh && titleCh.title ? titleCh.title.trim() : "";
  document.title = chTitle ? (currentBook.title || "plainpage") + " - " + chTitle : (currentBook.title || "plainpage")
}

function closeLibrary() {
  document.body.classList.remove("library-open"), libraryToggle.classList.remove("is-active"), currentGroupFilter = null, currentSort = getScopeSort(currentSortScopeKey()), updateSortDropdownUI(), exitSelectionMode(), updateReaderDocumentTitle(), state.libraryOpen = !1, saveState(), syncUrlHash()
}

function findBook(id) {
  return loadLibraryList().find(function(b) {
    return b.id === id
  })
}

// `book` coming in here is usually the metadata-only record (from
// loadLibraryList()/findBook()) — it has no chapters/images/toc yet. Those
// live in the separate content store and are fetched and merged onto the
// book object before it becomes currentBook and gets rendered. Callers
// (library tile click, popstate routing, startup init) all treat this as
// fire-and-forget, so returning a promise here doesn't require call-site
// changes — but see 09-app-init.js for the one place that awaits it.
function loadBook(book) {
  return idbGetBookContent(book.id).then(function(content) {
    if (!content && !book.chapters) {
      showToast("Couldn't load this book — its content may be missing.");
      openLibrary();
      return
    }
    content && (book.chapters = content.chapters, book.images = content.images, book.toc = content.toc);
    currentBook = book, state.lastOpenBookId = book.id, saveState(), document.title = book.title || "plainpage", "complete" !== book.status && updateReadingStatus(book.id, "reading"), $("#bookTitle").textContent = book.title, $("#bookAuthor").textContent = book.author || "";
    var coverEl = $("#bookCover");

    function tryRestore() {
      var page = document.getElementById("page-" + state.currentChapter);
      page ? page.hidden ? requestAnimationFrame(tryRestore) : restoreChapterScroll(state.currentChapter) : requestAnimationFrame(tryRestore)
    }
    book.cover ? (coverEl.style.backgroundImage = 'url("' + book.cover + '")', coverEl.style.backgroundSize = "cover", coverEl.style.backgroundPosition = "center", coverEl.innerHTML = "") : (coverEl.style.backgroundImage = "", coverEl.innerHTML = "<span>" + escapeHtml((book.title || "?").charAt(0).toUpperCase()) + "</span>"), renderMedia(book.images || []), rerenderChapters(book, !1), window.dispatchEvent(new CustomEvent("reader:chapters-rendered", { detail: { bookId: book.id } })), setTimeout(function() {
      requestAnimationFrame(tryRestore)
    }, 50)
  }).catch(function(err) {
    console.error("Failed to load book content", err), showToast("Couldn't load this book's content.")
  })
}

function updateReadingStatus(bookId, status) {
  var list = loadLibraryList(),
    book = list.find(function(b) {
      return b.id === bookId
    });
  book && (book.status = status, book.lastOpened = Date.now(), "complete" === status && (book.completedAt = Date.now()), saveLibraryList(list), document.body.classList.contains("library-open") && renderLibrary())
}

function renderLibraryTile(book) {
  var coverHtml = book.cover ? '<img src="' + book.cover + '" alt="' + escapeHtml(book.title) + '" loading="lazy" decoding="async">' : '<div class="placeholder">' + escapeHtml((book.title || "?").charAt(0).toUpperCase()) + "</div>",
    statusBadge = "";
  "reading" === book.status ? statusBadge = '<span class="status-badge">Reading</span>' : "complete" === book.status && (statusBadge = '<span class="status-badge status-badge-complete">Complete</span>');
  var pct = Math.round(100 * (book.progress || 0)),
    progressHtml = pct > 0 ? '<div class="cover-progress"><div class="cover-progress-fill" style="width:' + pct + '%"></div></div>' : "",
    isSelected = selectedBookIds.has(book.id),
    selectClass = selectionMode ? " is-selecting" + (isSelected ? " is-selected" : "") : "",
    checkHtml = selectionMode ? '<span class="library-tile-check' + (isSelected ? " is-checked" : "") + '"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' : "";
  return '<div class="library-tile' + selectClass + '" data-book-id="' + book.id + '">' + coverHtml + statusBadge + progressHtml + checkHtml + "</div>"
}

// Parses "book:completed" / "book:unread" / "book:reading" out of a search
// query — the rest of the string is still used as a normal title/author
// search. Unrecognized "book:xxx" tokens are left in place as plain text.
function parseLibraryQuery(raw) {
  var statusMap = { completed: "complete", unread: "unread", reading: "reading" },
    m = /\bbook:(\w+)\b/i.exec(raw || ""),
    status = m && statusMap[m[1].toLowerCase()] || null;
  return {
    status: status,
    text: status ? (raw || "").replace(m[0], "").trim().toLowerCase() : (raw || "").trim().toLowerCase()
  }
}

function renderLibrary() {
  var allBooks = loadLibraryList(),
    parsedQuery = parseLibraryQuery(librarySearchInput.value),
    hasQuery = !!(parsedQuery.text || parsedQuery.status),
    hiddenGroups = loadHiddenGroups();
  var sortFn = function(sortType) {
      switch (sortType) {
        case "title":
          return function(a, b) {
            return (a.title || "").localeCompare(b.title || "")
          };
        case "author":
          return function(a, b) {
            return (a.author || "").localeCompare(b.author || "")
          };
        default:
          return function(a, b) {
            return (b.lastOpened || 0) - (a.lastOpened || 0)
          }
      }
    }(currentSort),
    baseList = currentGroupFilter ? getGroupBooks(allBooks, currentGroupFilter) : allBooks.filter(function(b) {
      return !(b.customGroups || []).some(function(k) {
        return hiddenGroups[k]
      })
    }),
    sortedBooks = baseList.slice().sort(sortFn),
    filtered = hasQuery ? sortedBooks.filter(function(b) {
      return (!parsedQuery.status || (b.status || "unread") === parsedQuery.status) && (!parsedQuery.text || -1 !== (b.title + " " + (b.author || "")).toLowerCase().indexOf(parsedQuery.text))
    }) : sortedBooks,
    gridHtml = "";
  librarySearchInput.placeholder = "Search " + baseList.length + (1 === baseList.length ? " book" : " books") + "...";
  visibleBookIds = filtered.map(function(b) {
    return b.id
  });
  // "Select all" is meant to mean *all your books* — but a search/status
  // query is something you explicitly typed, so it's fine (expected, even)
  // for select-all to stay scoped to that. Hidden-group exclusion is
  // different: it's a silent, display-only convenience baseList applies so
  // hidden groups don't clutter the main grid, and if select-all quietly
  // inherited that same exclusion, "select all → delete" would leave
  // hidden-group books undeleted with no on-screen sign anything was
  // skipped (the placeholder count and grid both already agree on the
  // smaller number). So: at the top level with no active query, select-all
  // reaches every book in the library regardless of hidden groups; inside
  // a specific group, or under an active search, it stays scoped to what's
  // actually being shown, same as before.
  selectAllBookIds = !currentGroupFilter && !hasQuery ? allBooks.map(function(b) {
    return b.id
  }) : visibleBookIds;
  gridHtml = 0 === allBooks.length ? '<div class="library-empty">Your library is empty. Add a book to get started.</div>' : 0 === filtered.length && hasQuery ? '<div class="library-grid-empty">No books match your search.</div>' : 0 === baseList.length ? '<div class="library-empty">' + (currentGroupFilter ? "No books in this group yet." : "All your books are hidden — check your groups.") + "</div>" : '<div class="library-grid">' + filtered.map(function(b) {
    return renderLibraryTile(b)
  }).join("") + "</div>";
  var shelfHtml = currentGroupFilter ? "" : renderRecentRowHtml(allBooks) + renderGroupsRowHtml(allBooks);
  libraryBody.innerHTML = shelfHtml + gridHtml, libraryBody.querySelectorAll(".library-tile").forEach(function(tile) {
    var bookId = tile.getAttribute("data-book-id");
    tile.addEventListener("click", function(e) {
      if (selectionMode) return e.preventDefault(), void toggleBookSelection(bookId);
      var book = findBook(bookId);
      book && (closeLibrary(), requestAnimationFrame(function() {
        loadBook(book)
      }))
    }), tile.addEventListener("contextmenu", function(e) {
      if (selectionMode) return;
      e.preventDefault(), openContextMenu("book", bookId, e.clientX, e.clientY)
    })
  });
  libraryBody.querySelectorAll(".group-tile").forEach(function(tile) {
    var groupKey = tile.getAttribute("data-group");
    tile.addEventListener("click", function() {
      selectionMode || enterGroup(groupKey)
    }), tile.addEventListener("keydown", function(e) {
      "Enter" !== e.key && " " !== e.key || selectionMode || (e.preventDefault(), enterGroup(groupKey))
    }), tile.addEventListener("contextmenu", function(e) {
      if (selectionMode) return;
      e.preventDefault(), openContextMenu("group", groupKey, e.clientX, e.clientY)
    })
  });
  libraryBody.querySelectorAll("[data-shelf-row]").forEach(function(shelfRow) {
    var wrap = shelfRow.closest(".library-shelf-row-wrap"),
      arrowLeft = wrap.querySelector('[data-shelf-arrow="left"]'),
      arrowRight = wrap.querySelector('[data-shelf-arrow="right"]'),
      updateArrows = function() {
        var maxScroll = shelfRow.scrollWidth - shelfRow.clientWidth;
        arrowLeft.classList.toggle("is-visible", shelfRow.scrollLeft > 8), arrowRight.classList.toggle("is-visible", shelfRow.scrollLeft < maxScroll - 8)
      };
    updateArrows(), shelfRow.addEventListener("scroll", updateArrows), window.addEventListener("resize", updateArrows), arrowLeft.addEventListener("click", function() {
      shelfRow.scrollBy({
        left: -280,
        behavior: "smooth"
      })
    }), arrowRight.addEventListener("click", function() {
      shelfRow.scrollBy({
        left: 280,
        behavior: "smooth"
      })
    })
  });
  updateLibraryHeader(), updateSelectionBar();
  libraryScrollbar && libraryScrollbar.update()
}

var selectionMode = !1,
  selectedBookIds = new Set,
  visibleBookIds = [],
  selectAllBookIds = [],
  librarySelectionBar = $("#librarySelectionBar"),
  selectionCount = $("#selectionCount"),
  selectionCancelBtn = $("#selectionCancelBtn"),
  selectionSelectAllBtn = $("#selectionSelectAllBtn"),
  selectionStatusBtns = $$(".selection-status-btn"),
  selectionGroupBtn = $("#selectionGroupBtn"),
  selectionRemoveGroupBtn = $("#selectionRemoveGroupBtn"),
  selectionDeleteBtn = $("#selectionDeleteBtn"),
  groupPickerPanel = $("#groupPickerPanel"),
  groupPickerList = $("#groupPickerList"),
  groupPickerNewInput = $("#groupPickerNewInput"),
  groupPickerCreateBtn = $("#groupPickerCreateBtn"),
  groupDeleteOverlay = $("#groupDeleteOverlay"),
  groupDeleteModal = $("#groupDeleteModal"),
  groupDeleteCancel = $("#groupDeleteCancel"),
  groupDeleteConfirm = $("#groupDeleteConfirm"),
  groupDeleteTarget = null;

function openGroupDeleteConfirm(key) {
  groupDeleteTarget = key, groupDeleteOverlay.classList.add("is-open"), groupDeleteModal.classList.add("is-open")
}

function closeGroupDeleteConfirm() {
  groupDeleteTarget = null, groupDeleteOverlay.classList.remove("is-open"), groupDeleteModal.classList.remove("is-open")
}

function deleteGroup(key) {
  var list = loadLibraryList();
  list.forEach(function(b) {
    if (b.customGroups) {
      var idx = b.customGroups.indexOf(key); -1 !== idx && (b.customGroups.splice(idx, 1), currentBook && currentBook.id === b.id && (currentBook.customGroups = b.customGroups))
    }
  }), saveLibraryList(list);
  var names = loadGroupNames();
  delete names[key], saveGroupNames(names);
  var hidden = loadHiddenGroups();
  delete hidden[key], saveHiddenGroups(hidden);
  state.sortByScope && delete state.sortByScope[key], saveState(), currentGroupFilter === key && (currentGroupFilter = null, currentSort = getScopeSort(currentSortScopeKey()), updateSortDropdownUI(), document.title = libraryDocTitle()), showToast("Group deleted."), renderLibrary()
}
groupDeleteCancel.addEventListener("click", closeGroupDeleteConfirm), groupDeleteOverlay.addEventListener("click", closeGroupDeleteConfirm), groupDeleteConfirm.addEventListener("click", function() {
  groupDeleteTarget && (deleteGroup(groupDeleteTarget), closeGroupDeleteConfirm())
});

function updateSelectionBar() {
  var n = selectedBookIds.size;
  if (!selectionMode || 0 === n) return librarySelectionBar.classList.remove("is-open"), void closeGroupPicker();
  selectionCount.textContent = n + (1 === n ? " selected" : " selected"), librarySelectionBar.classList.add("is-open"), selectionRemoveGroupBtn.hidden = !isCustomGroupKey(currentGroupFilter);
  if (selectionSelectAllBtn) {
    var allSelected = selectAllBookIds.length > 0 && selectAllBookIds.every(function(id) {
      return selectedBookIds.has(id)
    });
    selectionSelectAllBtn.textContent = allSelected ? "Deselect all" : "Select all", selectionSelectAllBtn.hidden = 0 === selectAllBookIds.length
  }
}

function updateTileSelectionUI(bookId) {
  var tile = libraryBody.querySelector('.library-tile[data-book-id="' + bookId + '"]');
  if (!tile) return;
  var isSelected = selectedBookIds.has(bookId);
  tile.classList.toggle("is-selected", isSelected);
  var check = tile.querySelector(".library-tile-check");
  check && check.classList.toggle("is-checked", isSelected)
}

function toggleSelectAll() {
  if (!selectAllBookIds.length) return;
  var allSelected = selectAllBookIds.every(function(id) {
    return selectedBookIds.has(id)
  });
  allSelected ? (selectedBookIds.clear(), exitSelectionMode()) : (selectAllBookIds.forEach(function(id) {
    selectedBookIds.add(id), updateTileSelectionUI(id)
  }), selectionMode = !0, updateSelectionBar())
}

function enterSelectionMode(bookId) {
  selectionMode = !0, selectedBookIds.clear(), bookId && selectedBookIds.add(bookId), renderLibrary()
}

function toggleBookSelection(bookId) {
  selectedBookIds.has(bookId) ? selectedBookIds.delete(bookId) : selectedBookIds.add(bookId), 0 === selectedBookIds.size ? exitSelectionMode() : (updateTileSelectionUI(bookId), updateSelectionBar())
}

function exitSelectionMode() {
  (selectionMode || selectedBookIds.size) && (selectionMode = !1, selectedBookIds.clear(), closeGroupPicker(), renderLibrary())
}

function closeGroupPicker() {
  groupPickerPanel && (groupPickerPanel.hidden = !0, groupPickerNewInput && (groupPickerNewInput.value = ""))
}

function openGroupPicker() {
  var allBooks = loadLibraryList(),
    keys = listCustomGroupKeys(allBooks);
  groupPickerList.innerHTML = keys.length ? keys.map(function(k) {
    return '<button class="group-picker-item" data-group-key="' + escapeHtml(k) + '" type="button">' + escapeHtml(groupName(k)) + "</button>"
  }).join("") : '<div class="group-picker-empty">No groups yet — create one below.</div>', groupPickerPanel.hidden = !1, groupPickerNewInput.focus()
}

function bulkSetStatus(status) {
  var list = loadLibraryList(),
    n = 0;
  list.forEach(function(b) {
    selectedBookIds.has(b.id) && (b.status = status, b.lastOpened = Date.now(), "complete" === status && (b.completedAt = Date.now()), currentBook && currentBook.id === b.id && (currentBook.status = status, "complete" === status && (currentBook.completedAt = b.completedAt)), n++)
  }), saveLibraryList(list), showToast("Marked " + n + (1 === n ? " book" : " books") + " as " + status + "."), exitSelectionMode()
}

function bulkAddToGroup(key) {
  var list = loadLibraryList(),
    n = 0;
  list.forEach(function(b) {
    if (selectedBookIds.has(b.id)) {
      b.customGroups = b.customGroups || [];
      var idx = b.customGroups.indexOf(key); -1 === idx && (b.customGroups.push(key), n++), currentBook && currentBook.id === b.id && (currentBook.customGroups = b.customGroups)
    }
  }), saveLibraryList(list), showToast("Added " + n + (1 === n ? " book" : " books") + ' to "' + groupName(key) + '".'), exitSelectionMode()
}

function bulkCreateGroup(name) {
  name = (name || "").trim();
  if (!name) return;
  var key = "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    names = loadGroupNames();
  names[key] = name, saveGroupNames(names), bulkAddToGroup(key)
}

function bulkRemoveFromGroup() {
  if (!isCustomGroupKey(currentGroupFilter)) return;
  var key = currentGroupFilter,
    list = loadLibraryList(),
    n = 0;
  list.forEach(function(b) {
    if (selectedBookIds.has(b.id) && b.customGroups) {
      var idx = b.customGroups.indexOf(key); -1 !== idx && (b.customGroups.splice(idx, 1), n++, currentBook && currentBook.id === b.id && (currentBook.customGroups = b.customGroups))
    }
  }), saveLibraryList(list), showToast("Removed " + n + (1 === n ? " book" : " books") + " from this group."), exitSelectionMode()
}

function bulkDelete() {
  var n = selectedBookIds.size;
  if (window.confirm("Delete " + n + (1 === n ? " book" : " books") + "? This can\u2019t be undone.")) {
    var deletedIds = Array.from(selectedBookIds),
      list = loadLibraryList().filter(function(b) {
      return !selectedBookIds.has(b.id)
    }),
      deletedCurrent = currentBook && selectedBookIds.has(currentBook.id);
    saveLibraryList(list), deletedIds.forEach(idbDeleteBookContent), showToast("Deleted " + n + (1 === n ? " book" : " books") + "."), exitSelectionMode(), deletedCurrent && (currentBook = null, state.lastOpenBookId = null, saveState())
  }
}
selectionCancelBtn.addEventListener("click", function() {
  exitSelectionMode()
}), selectionSelectAllBtn && selectionSelectAllBtn.addEventListener("click", toggleSelectAll), selectionStatusBtns.forEach(function(btn) {
  btn.addEventListener("click", function() {
    bulkSetStatus(btn.getAttribute("data-status"))
  })
}), selectionDeleteBtn.addEventListener("click", bulkDelete), selectionRemoveGroupBtn.addEventListener("click", bulkRemoveFromGroup), selectionGroupBtn.addEventListener("click", function() {
  groupPickerPanel.hidden ? openGroupPicker() : closeGroupPicker()
}), groupPickerList.addEventListener("click", function(e) {
  var btn = e.target.closest(".group-picker-item");
  btn && bulkAddToGroup(btn.getAttribute("data-group-key"))
}), groupPickerCreateBtn.addEventListener("click", function() {
  bulkCreateGroup(groupPickerNewInput.value)
}), groupPickerNewInput.addEventListener("keydown", function(e) {
  "Enter" === e.key && (e.preventDefault(), bulkCreateGroup(groupPickerNewInput.value))
});

// ---- Right-click context menus for library tiles (replaces the old
// long-press gestures). Book tiles get: about, select, add to group, status
// (with a check mark on the active one), open in new tab, delete. Group
// tiles get: select, hide/show in library, ungroup, bulk status for every
// book in the group, and open-all. One menu element is reused for both,
// with its contents rebuilt on open.
var contextMenuEl = $("#contextMenu"),
  contextMenuType = null,
  contextMenuTarget = null;

function contextMenuCheckSvg() {
  return '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
}

function contextMenuItemHtml(action, label, active, danger) {
  return '<button data-context-action="' + action + '"' + (danger ? ' class="is-danger"' : "") + ' type="button"><span class="context-menu-label">' + escapeHtml(label) + "</span>" + (active ? '<span class="context-menu-check">' + contextMenuCheckSvg() + "</span>" : "") + "</button>"
}

function renderBookContextMenu(book) {
  var status = book.status || "unread";
  return contextMenuItemHtml("info", "About book") + contextMenuItemHtml("select", "Select") + contextMenuItemHtml("add-group", "Add to group") + contextMenuItemHtml("status-unread", "Unread", "unread" === status) + contextMenuItemHtml("status-reading", "Reading", "reading" === status) + contextMenuItemHtml("status-complete", "Completed", "complete" === status) + contextMenuItemHtml("open-tab", "Open in new tab") + contextMenuItemHtml("delete", "Delete", !1, !0)
}

function renderGroupContextMenu(key) {
  var hidden = isGroupHidden(key);
  return contextMenuItemHtml("select", "Select") + contextMenuItemHtml("toggle-hide", hidden ? "Show in library" : "Hide from library") + contextMenuItemHtml("ungroup", "Ungroup") + contextMenuItemHtml("mark-unread", "Mark all unread") + contextMenuItemHtml("mark-reading", "Mark all reading") + contextMenuItemHtml("mark-complete", "Mark all completed") + contextMenuItemHtml("open-tab", "Open all in new tab")
}

function openContextMenu(type, target, x, y) {
  contextMenuType = type, contextMenuTarget = target;
  var book = "book" === type ? findBook(target) : null;
  if ("book" === type && !book) return;
  contextMenuEl.innerHTML = "book" === type ? renderBookContextMenu(book) : renderGroupContextMenu(target), contextMenuEl.classList.add("is-open");
  var menuW = contextMenuEl.offsetWidth || 160,
    menuH = contextMenuEl.offsetHeight || 160,
    left = Math.min(x, window.innerWidth - menuW - 8),
    top = Math.min(y, window.innerHeight - menuH - 8);
  contextMenuEl.style.left = Math.max(8, left) + "px", contextMenuEl.style.top = Math.max(8, top) + "px"
}

function closeContextMenu() {
  contextMenuType = null, contextMenuTarget = null, contextMenuEl.classList.remove("is-open")
}

// `book` here is typically metadata-only (no `chapters` loaded), so this
// can no longer validate lastChapter against the real chapter list the way
// it used to. It trusts the stored lastChapter (or omits the chapter param
// entirely) and lets loadBook()/rerenderChapters() fall back to the first
// chapter on the other end if that id turns out to be stale.
function bookRouteUrl(book) {
  var params = new URLSearchParams(location.search);
  return params.set("book", book.id), book.lastChapter ? params.set("chapter", book.lastChapter) : params.delete("chapter"), location.pathname + "?" + params.toString()
}

function setBookStatusFromMenu(book, status) {
  book.status = status, "complete" === status && (book.completedAt = Date.now()), persistBookMetadata(book), document.body.classList.contains("library-open") && renderLibrary(), showToast("Status updated to " + status + ".")
}

function deleteBookFromMenu(book) {
  var title = book.title || "this book";
  if (!window.confirm('Delete "' + title + '"? This can\u2019t be undone.')) return;
  var list = loadLibraryList().filter(function(b) {
      return b.id !== book.id
    }),
    wasCurrent = currentBook && currentBook.id === book.id;
  saveLibraryList(list), idbDeleteBookContent(book.id), document.body.classList.contains("library-open") && renderLibrary(), wasCurrent && (currentBook = null, state.lastOpenBookId = null, saveState(), openLibrary()), showToast('Deleted \u201c' + title + '\u201d.')
}

function enterSelectionModeForGroup(key) {
  var ids = getGroupBooks(loadLibraryList(), key).map(function(b) {
    return b.id
  });
  selectionMode = !0, selectedBookIds.clear(), ids.forEach(function(id) {
    selectedBookIds.add(id)
  }), renderLibrary()
}

function setGroupBooksStatus(key, status) {
  var list = loadLibraryList(),
    ids = getGroupBooks(list, key).map(function(b) {
      return b.id
    }),
    n = 0;
  list.forEach(function(b) {
    -1 !== ids.indexOf(b.id) && (b.status = status, b.lastOpened = Date.now(), "complete" === status && (b.completedAt = Date.now()), currentBook && currentBook.id === b.id && (currentBook.status = status, "complete" === status && (currentBook.completedAt = b.completedAt)), n++)
  }), saveLibraryList(list), showToast("Marked " + n + (1 === n ? " book" : " books") + " as " + status + "."), document.body.classList.contains("library-open") && renderLibrary()
}

function openGroupBooksInNewTabs(key) {
  getGroupBooks(loadLibraryList(), key).forEach(function(b) {
    window.open(bookRouteUrl(b), "_blank")
  })
}

function toggleGroupHiddenFromMenu(key) {
  toggleGroupHidden(key), document.body.classList.contains("library-open") && renderLibrary(), showToast(isGroupHidden(key) ? "Hidden from library." : "Shown in library.")
}
contextMenuEl.addEventListener("click", function(e) {
  var btn = e.target.closest("button[data-context-action]");
  if (!btn || !contextMenuTarget) return;
  var action = btn.getAttribute("data-context-action"),
    type = contextMenuType,
    target = contextMenuTarget;
  closeContextMenu();
  if ("book" === type) {
    var book = findBook(target);
    book && ("info" === action ? openBookInfo(book) : "select" === action ? enterSelectionMode(book.id) : "add-group" === action ? (enterSelectionMode(book.id), openGroupPicker()) : "status-unread" === action ? setBookStatusFromMenu(book, "unread") : "status-reading" === action ? setBookStatusFromMenu(book, "reading") : "status-complete" === action ? setBookStatusFromMenu(book, "complete") : "open-tab" === action ? window.open(bookRouteUrl(book), "_blank") : "delete" === action && deleteBookFromMenu(book))
  } else "group" === type && ("select" === action ? enterSelectionModeForGroup(target) : "toggle-hide" === action ? toggleGroupHiddenFromMenu(target) : "ungroup" === action ? openGroupDeleteConfirm(target) : "mark-unread" === action ? setGroupBooksStatus(target, "unread") : "mark-reading" === action ? setGroupBooksStatus(target, "reading") : "mark-complete" === action ? setGroupBooksStatus(target, "complete") : "open-tab" === action && openGroupBooksInNewTabs(target))
}), document.addEventListener("click", function(e) {
  contextMenuEl.classList.contains("is-open") && !contextMenuEl.contains(e.target) && closeContextMenu()
}), document.addEventListener("contextmenu", function(e) {
  contextMenuEl.contains(e.target) || e.target.closest(".library-tile") || e.target.closest(".group-tile") || closeContextMenu()
}), document.addEventListener("keydown", function(e) {
  "Escape" === e.key && contextMenuEl.classList.contains("is-open") && closeContextMenu()
}), window.addEventListener("scroll", closeContextMenu, { passive: !0, capture: !0 }), window.addEventListener("resize", closeContextMenu);
