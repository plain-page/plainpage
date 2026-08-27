var state = {
    currentChapter: "chapter-1",
    bodySize: 16,
    bodySpacing: 1.8,
    bodyIndent: 24,
    bodyFont: "default",
    titleFont: "default",
    authorFont: "default",
    themeMode: "ink",
    progress: {},
    customPaper: "#E9E1CB",
    customInk: "#2A2419",
    customFontName: "",
    customFontUrl: "",
    savedFonts: [],
    activeFontIndex: -1,
    customBgUrl: "",
    bgSize: "auto",
    savedThemes: [],
    activeThemeIndex: -1,
    margin: 12,
    wpm: 220,
    lastOpenBookId: null,
    libraryOpen: false,
    librarySort: "recent"
  },
  $ = function(s) {
    return document.querySelector(s)
  },
  $$ = function(s) {
    return document.querySelectorAll(s)
  };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(ch) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    } [ch]
  })
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(function(c) {
    return Math.round(c).toString(16).padStart(2, "0")
  }).join("")
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixColors(c1, c2, t) {
  return rgbToHex(lerp(c1.r, c2.r, t), lerp(c1.g, c2.g, t), lerp(c1.b, c2.b, t))
}

function darken(hex, amount) {
  var rgb = hexToRgb(hex);
  return rgb ? rgbToHex(Math.max(0, rgb.r - amount), Math.max(0, rgb.g - amount), Math.max(0, rgb.b - amount)) : hex
}

function rgba(hex, alpha) {
  var rgb = hexToRgb(hex);
  return rgb ? "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha + ")" : "rgba(0,0,0,0)"
}

function saveState() {
  try {
    return localStorage.setItem("reader_state", JSON.stringify(state)), !0
  } catch (e) {
    return console.error("Failed to save app state — storage limit likely exceeded.", e), showToast("Couldn't save your changes — storage is full. Try removing a custom font or background image."), !1
  }
}

function loadState() {
  try {
    var raw = localStorage.getItem("reader_state");
    if (!raw) return !1;
    var saved = JSON.parse(raw);
    return Object.assign(state, saved), !0
  } catch (e) {
    return !1
  }
}
var toastEl = $("#saveToast"),
  toastTimeout = null;

function showToast(message) {
  toastEl && (toastEl.textContent = message, toastEl.classList.add("show"), toastTimeout && clearTimeout(toastTimeout), toastTimeout = setTimeout(function() {
    toastEl.classList.remove("show")
  }, 3200))
}

function applyCustomTheme(paper, ink, themeIndex) {
  paper = paper || state.customPaper || "#E9E1CB";
  var inkRgb = hexToRgb(ink = ink || state.customInk || "#2A2419"),
    paperRgb = hexToRgb(paper);
  if (inkRgb && paperRgb) {
    var inkSoft = mixColors(inkRgb, paperRgb, .35),
      inkQuiet = mixColors(inkRgb, paperRgb, .65),
      inkHover = darken(ink, 10),
      hairline = mixColors(inkRgb, paperRgb, .75),
      panelShadow = rgba(ink, .14),
      scrim = rgba(ink, .22),
      inkRgbStr = inkRgb.r + ", " + inkRgb.g + ", " + inkRgb.b,
      prefix = void 0 !== themeIndex && themeIndex >= 0 ? "theme-" + themeIndex + "-" : "custom-";
    document.documentElement.style.setProperty("--" + prefix + "ink-soft", inkSoft), document.documentElement.style.setProperty("--" + prefix + "ink-quiet", inkQuiet), document.documentElement.style.setProperty("--" + prefix + "ink-hover", inkHover), document.documentElement.style.setProperty("--" + prefix + "hairline", hairline), document.documentElement.style.setProperty("--" + prefix + "panel-shadow", panelShadow), document.documentElement.style.setProperty("--" + prefix + "scrim", scrim), document.documentElement.style.setProperty("--" + prefix + "paper", paper), document.documentElement.style.setProperty("--" + prefix + "ink", ink), document.documentElement.style.setProperty("--" + prefix + "ink-rgb", inkRgbStr)
  }
}

function applyThemeByIndex(index) {
  if (index < 0 || index >= state.savedThemes.length) return document.body.removeAttribute("data-theme"), document.documentElement.style.setProperty("--paper", ""), document.documentElement.style.setProperty("--ink", ""), document.documentElement.style.setProperty("--ink-rgb", ""), void(state.activeThemeIndex = -1);
  var theme = state.savedThemes[index];
  applyCustomTheme(theme.paper, theme.ink, index), document.body.setAttribute("data-theme", "saved-" + index), state.activeThemeIndex = index
}

function renderThemeToggles() {
  var container = $("#themeToggleContainer");
  if (container) {
    var html = '<div class="toggle-group" id="themeToggle" style="max-width:100%;flex-wrap:wrap;display:flex;">';
    if (html += '<button class="toggle-btn is-selected" data-theme="ink" style="padding:5px 16px;">ink</button>', state.savedThemes.forEach(function(theme, i) {
        var isActive = state.activeThemeIndex === i;
        html += '<button class="toggle-btn' + (isActive ? " is-selected" : "") + '" data-theme="saved-' + i + '" style="padding:5px 16px;">' + theme.name + "</button>"
      }), html += '<button class="toggle-btn" data-theme="custom" style="padding:5px 16px;">custom</button>', html += "</div>", container.innerHTML = html, container.querySelector("#themeToggle").addEventListener("click", function(e) {
        var btn = e.target.closest(".toggle-btn");
        if (btn) {
          var themeVal = btn.getAttribute("data-theme");
          if (this.querySelectorAll(".toggle-btn").forEach(function(b) {
              b.classList.remove("is-selected")
            }), btn.classList.add("is-selected"), "ink" === themeVal) state.themeMode = "ink", document.body.removeAttribute("data-theme"), document.documentElement.style.setProperty("--paper", ""), document.documentElement.style.setProperty("--ink", ""), document.documentElement.style.setProperty("--ink-rgb", ""), state.activeThemeIndex = -1, document.getElementById("themeEditor").classList.remove("is-open"), saveState();
          else if ("custom" === themeVal) state.themeMode = "custom", document.getElementById("themeEditor").classList.add("is-open"), applyCustomTheme(state.customPaper, state.customInk, "custom"), document.body.setAttribute("data-theme", "custom"), saveState();
          else if (themeVal.startsWith("saved-")) {
            var idx = parseInt(themeVal.split("-")[1]);
            state.themeMode = "saved", applyThemeByIndex(idx), document.getElementById("themeEditor").classList.remove("is-open"), saveState()
          }
        }
      }), state.activeThemeIndex >= 0 && state.activeThemeIndex < state.savedThemes.length)(btns = container.querySelectorAll(".toggle-btn")).forEach(function(b) {
      b.getAttribute("data-theme") === "saved-" + state.activeThemeIndex && (btns.forEach(function(b2) {
        b2.classList.remove("is-selected")
      }), b.classList.add("is-selected"))
    });
    else if ("custom" === state.themeMode) {
      var btns;
      (btns = container.querySelectorAll(".toggle-btn")).forEach(function(b) {
        "custom" === b.getAttribute("data-theme") && (btns.forEach(function(b2) {
          b2.classList.remove("is-selected")
        }), b.classList.add("is-selected"), document.getElementById("themeEditor").classList.add("is-open"))
      })
    }
  }
}

function renderSavedThemesList() {
  var container = document.getElementById("savedThemesList");
  container && (0 !== state.savedThemes.length ? (container.innerHTML = state.savedThemes.map(function(theme, i) {
    return '<div class="saved-theme-item" data-index="' + i + '"><span class="theme-name-text" data-index="' + i + '"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid var(--hairline);background:' + theme.paper + ";border-color:" + theme.ink + ';margin-right:8px;vertical-align:middle;"></span><span class="theme-name" style="vertical-align:middle;">' + theme.name + '</span></span><button class="theme-delete" data-index="' + i + '">✕</button></div>'
  }).join(""), container.querySelectorAll(".theme-name-text").forEach(function(el) {
    el.addEventListener("dblclick", function(e) {
      e.stopPropagation();
      var idx = parseInt(this.getAttribute("data-index")),
        currentName = state.savedThemes[idx].name,
        nameSpan = this.querySelector(".theme-name");
      if (nameSpan) {
        var input = document.createElement("input");
        input.type = "text", input.className = "theme-name-input", input.value = currentName;
        var swatch = this.querySelector("span:first-child"),
          fragment = document.createDocumentFragment(),
          swatchClone = swatch.cloneNode(!0);
        fragment.appendChild(swatchClone), fragment.appendChild(input), this.replaceChild(fragment, nameSpan), input.focus(), input.select(), input.addEventListener("blur", function() {
          var newName = input.value.trim() || "Untitled";
          state.savedThemes[idx].name = newName, renderSavedThemesList(), renderThemeToggles(), saveState()
        }), input.addEventListener("keydown", function(ev) {
          "Enter" === ev.key && (ev.preventDefault(), input.blur()), "Escape" === ev.key && (ev.preventDefault(), input.value = currentName, input.blur())
        })
      }
    })
  }), container.querySelectorAll(".saved-theme-item").forEach(function(item) {
    item.addEventListener("click", function(e) {
      if (!e.target.classList.contains("theme-delete") && "INPUT" !== e.target.tagName) {
        var idx = parseInt(this.getAttribute("data-index")),
          theme = state.savedThemes[idx];
        theme && (state.customPaper = theme.paper, state.customInk = theme.ink, customPaperInput.value = theme.paper, customInkInput.value = theme.ink, "custom" === state.themeMode && (applyCustomTheme(state.customPaper, state.customInk, "custom"), saveState()))
      }
    })
  }), container.querySelectorAll(".theme-delete").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var idx = parseInt(this.getAttribute("data-index"));
      state.savedThemes.splice(idx, 1), state.activeThemeIndex === idx ? state.activeThemeIndex = -1 : state.activeThemeIndex > idx && state.activeThemeIndex--, renderThemeToggles(), renderSavedThemesList(), -1 === state.activeThemeIndex ? (document.body.removeAttribute("data-theme"), document.documentElement.style.setProperty("--paper", ""), document.documentElement.style.setProperty("--ink", ""), document.documentElement.style.setProperty("--ink-rgb", "")) : applyThemeByIndex(state.activeThemeIndex), saveState()
    })
  })) : container.innerHTML = '<div style="font-family:system-ui;font-size:.7rem;color:var(--ink-quiet);padding:4px 0;">No saved themes</div>')
}

function renderFontToggles() {
  function buildFontGroup(containerId, currentValue, onChange) {
    var container = document.getElementById(containerId);
    if (container) {
      var html = '<div class="toggle-group" style="max-width:100%;flex-wrap:wrap;display:flex;">';
      if (html += '<button class="toggle-btn' + ("default" === currentValue ? " is-selected" : "") + '" data-font="default" style="padding:5px 12px;">default</button>', currentValue && currentValue.startsWith("saved-")) {
        var idx = parseInt(currentValue.split("-")[1]);
        if (idx >= 0 && idx < state.savedFonts.length) html += '<button class="toggle-btn is-selected" data-font="' + currentValue + '" style="padding:5px 12px;">' + state.savedFonts[idx].name + "</button>"
      }
      html += '<button class="toggle-btn' + ("custom" === currentValue ? " is-selected" : "") + '" data-font="custom" style="padding:5px 12px;">custom</button>', html += "</div>", container.innerHTML = html, container.querySelector(".toggle-group").addEventListener("click", function(e) {
        var btn = e.target.closest(".toggle-btn");
        if (btn) {
          var val = btn.getAttribute("data-font");
          this.querySelectorAll(".toggle-btn").forEach(function(b) {
            b.classList.remove("is-selected")
          }), btn.classList.add("is-selected"), onChange(val)
        }
      })
    }
  }
  buildFontGroup("bodyFontContainer", state.bodyFont, function(val) {
    state.bodyFont = val, applyBodyTypography(), updateCustomFontRowVisibility(), renderSavedFontsList(), renderFontToggles(), saveState()
  }), buildFontGroup("titleFontContainer", state.titleFont, function(val) {
    state.titleFont = val, applyTitleFont(), updateCustomFontRowVisibility(), renderSavedFontsList(), renderFontToggles(), saveState()
  }), buildFontGroup("authorFontContainer", state.authorFont, function(val) {
    state.authorFont = val, applyAuthorFont(), updateCustomFontRowVisibility(), renderSavedFontsList(), renderFontToggles(), saveState()
  }), renderSavedFontsList()
}

function renderSavedFontsList() {
  var container = $("#savedFontsContainer");
  container && (0 !== state.savedFonts.length ? (container.innerHTML = state.savedFonts.map(function(font, i) {
    return '<div class="saved-font-item' + (state.bodyFont === "saved-" + i || state.titleFont === "saved-" + i || state.authorFont === "saved-" + i ? " is-active" : "") + '" data-index="' + i + '"><span class="font-name" data-index="' + i + '">' + font.name + ' <span class="font-apply">●</span></span><button class="font-delete" data-index="' + i + '">✕</button></div>'
  }).join(""), container.querySelectorAll(".font-name").forEach(function(el) {
    el.addEventListener("dblclick", function(e) {
      e.stopPropagation();
      var idx = parseInt(this.getAttribute("data-index")),
        currentName = state.savedFonts[idx].name,
        input = document.createElement("input");
      input.type = "text", input.className = "font-name-input", input.value = currentName, input.setAttribute("data-index", idx), this.parentNode.replaceChild(input, this), input.focus(), input.select(), input.addEventListener("blur", function() {
        var newName = input.value.trim() || "Untitled";
        state.savedFonts[idx].name = newName, renderFontToggles(), renderSavedFontsList(), renderFontToggles(), saveState()
      }), input.addEventListener("keydown", function(ev) {
        "Enter" === ev.key && (ev.preventDefault(), input.blur()), "Escape" === ev.key && (ev.preventDefault(), input.value = currentName, input.blur())
      })
    })
  }), container.querySelectorAll(".saved-font-item").forEach(function(item) {
    item.addEventListener("click", function(e) {
      if (!e.target.classList.contains("font-delete") && !e.target.classList.contains("font-name-input")) {
        var fontKey = "saved-" + parseInt(this.getAttribute("data-index")),
          target = "body";
        "custom" === state.bodyFont ? target = "body" : "custom" === state.titleFont ? target = "title" : "custom" === state.authorFont && (target = "author"), "body" === target ? (state.bodyFont = fontKey, applyBodyTypography()) : "title" === target ? (state.titleFont = fontKey, applyTitleFont()) : "author" === target && (state.authorFont = fontKey, applyAuthorFont()), renderFontToggles(), updateCustomFontRowVisibility(), saveState()
      }
    })
  }), container.querySelectorAll(".font-delete").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var idx = parseInt(this.getAttribute("data-index"));
      state.savedFonts.splice(idx, 1), ["bodyFont", "titleFont", "authorFont"].forEach(function(key) {
        if (state[key] === "saved-" + idx) state[key] = "default";
        else if (state[key].startsWith("saved-")) {
          var savedIdx = parseInt(state[key].split("-")[1]);
          savedIdx > idx && (state[key] = "saved-" + (savedIdx - 1))
        }
      }), renderFontToggles(), applyBodyTypography(), applyTitleFont(), applyAuthorFont(), updateCustomFontRowVisibility(), saveState()
    })
  })) : container.innerHTML = '<div style="font-family:system-ui;font-size:.7rem;color:var(--ink-quiet);padding:4px 0;">No saved fonts</div>')
}

function updateCustomFontRowVisibility() {
  var show = "custom" === state.bodyFont || "custom" === state.titleFont || "custom" === state.authorFont,
    row = $("#customFontRow");
  show ? row.classList.add("is-open") : row.classList.remove("is-open")
}

function getFontFamily(fontKey) {
  if ("default" === fontKey) return null;
  if ("custom" === fontKey) return state.customFontName || null;
  if (fontKey && fontKey.startsWith("saved-")) {
    var idx = parseInt(fontKey.split("-")[1]);
    if (idx >= 0 && idx < state.savedFonts.length) {
      var font = state.savedFonts[idx],
        styleId = "saved-font-style-" + idx;
      if (!document.getElementById(styleId)) {
        var style = document.createElement("style");
        style.id = styleId, style.textContent = '@font-face { font-family: "' + font.fontName + '"; src: url("' + font.fontUrl + '"); }', document.head.appendChild(style)
      }
      return font.fontName
    }
  }
  return null
}

function applyBodyTypography() {
  var scale = state.bodySize / 16;
  document.documentElement.style.setProperty("--text-scale", scale), document.documentElement.style.setProperty("--line-height", state.bodySpacing), document.documentElement.style.setProperty("--text-indent", state.bodyIndent + "px");
  var fontFamily = getFontFamily(state.bodyFont);
  fontFamily ? (document.body.setAttribute("data-body-font", "custom"), document.documentElement.style.setProperty("--custom-font-name", fontFamily), document.documentElement.style.setProperty("--body-font", fontFamily)) : (document.body.removeAttribute("data-body-font"), document.documentElement.style.setProperty("--custom-font-name", ""), document.documentElement.style.removeProperty("--body-font"))
}

function applyTitleFont() {
  var fontFamily = getFontFamily(state.titleFont),
    titleEl = document.querySelector(".book-title");
  titleEl && (titleEl.style.fontFamily = fontFamily || ""), $$(".chapter-byline .cb-title").forEach(function(el) {
    el.style.fontFamily = fontFamily || ""
  })
}

function applyAuthorFont() {
  var fontFamily = getFontFamily(state.authorFont),
    authorEl = document.querySelector(".book-author");
  authorEl && (authorEl.style.fontFamily = fontFamily || ""), $$(".chapter-byline .cb-by").forEach(function(el) {
    el.style.fontFamily = fontFamily || ""
  })
}
var LIBRARY_KEY = "reader_library",
  currentSort = "recent",
  isLibraryScrolled = !1;

// ---- Library storage: IndexedDB-backed, with a synchronous in-memory cache ----
// (localStorage caps out around 5-10MB total, which a full epub library blows
// through fast. IndexedDB has a much larger quota. The rest of the app still
// calls loadLibraryList()/saveLibraryList() synchronously, so we keep an
// in-memory mirror that's kept authoritative, and persist it to IndexedDB in
// the background.)
var LIBRARY_DB_NAME = "readerLibraryDB",
  LIBRARY_STORE = "books",
  libraryCache = [],
  libraryDBPromise = null;

function openLibraryDB() {
  if (libraryDBPromise) return libraryDBPromise;
  libraryDBPromise = new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error("IndexedDB not supported")); return }
    var req = indexedDB.open(LIBRARY_DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      db.objectStoreNames.contains(LIBRARY_STORE) || db.createObjectStore(LIBRARY_STORE, { keyPath: "id" })
    };
    req.onsuccess = function(e) { resolve(e.target.result) };
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

function idbReplaceAllBooks(list) {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(LIBRARY_STORE, "readwrite"),
        store = tx.objectStore(LIBRARY_STORE);
      store.clear();
      list.forEach(function(book) { store.put(book) });
      tx.oncomplete = function() { resolve(!0) };
      tx.onerror = function() { reject(tx.error) }
    })
  })
}

// Called once at startup before init(). Loads existing IndexedDB data into
// the in-memory cache, or migrates old localStorage data in on first run.
function initLibraryStorage() {
  return idbGetAllBooks().then(function(existing) {
    if (existing && existing.length) { libraryCache = existing; return }
    var raw = null;
    try { raw = localStorage.getItem(LIBRARY_KEY) } catch (e) {}
    var oldList = [];
    if (raw) { try { oldList = JSON.parse(raw) || [] } catch (e) { oldList = [] } }
    libraryCache = oldList;
    if (oldList.length) {
      return idbReplaceAllBooks(oldList).then(function() {
        try { localStorage.removeItem(LIBRARY_KEY) } catch (e) {}
      })
    }
  }).catch(function(err) {
    console.error("Library storage failed to initialize, starting with an empty library.", err);
    libraryCache = []
  })
}

function loadLibraryList() {
  return libraryCache
}

function idbPutBook(book) {
  return openLibraryDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(LIBRARY_STORE, "readwrite");
      tx.objectStore(LIBRARY_STORE).put(book);
      tx.oncomplete = function() { resolve(!0) };
      tx.onerror = function() { reject(tx.error) }
    })
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

function saveLibraryList(list) {
  libraryCache = list;
  idbReplaceAllBooks(list).catch(function(err) {
    console.error("Failed to persist library to IndexedDB", err);
    showToast("Could not save your library changes.")
  });
  return !0
}
var currentBook = null;

function progressKey(chapterId) {
  return (currentBook ? currentBook.id : "") + "::" + chapterId
}
var chapterPages = $$(".chapter-page"),
  sidebarItems = $$(".sidebar-item[data-target]");

function showChapter(id, restoreScroll) {
  var pages = $$(".chapter-page");
  if (!Array.prototype.some.call(pages, function(page) {
      return page.getAttribute("data-chapter-id") === id;
    }) && pages.length) {
    id = pages[0].getAttribute("data-chapter-id");
  }
  state.currentChapter = id;

  if (!document.body.classList.contains("library-open")) {
    updateReaderDocumentTitle();
  }

  chapterPages.forEach(function(page) {
    page.hidden = page.getAttribute("data-chapter-id") !== id;
  });
  sidebarItems.forEach(function(item) {
    item.classList.toggle("is-current", item.getAttribute("data-target") === id);
  });

  if (restoreScroll) {
    // restoreScroll: wait for layout to settle before restoring position
    setTimeout(function() {
      restoreChapterScroll(id);
    }, 100);
  } else {
    window.scrollTo(0, 0);
    updateChapterMeta();
    updateReadingProgress();
    updateSidebarMeta();
  }

  saveState();
  if (currentBook) {
    currentBook.lastChapter = id;
    persistCurrentBook();
  }
  syncUrlHash();
}

// ---- URL routing (so extensions like highlighters can key storage per book/chapter) ----
// Uses the query string, not the hash: highlighter/bookmarking extensions
// typically key their storage off origin+pathname+search and deliberately
// ignore the hash, so a hash-only scheme is invisible to them.
function syncUrlHash() {
  var params = new URLSearchParams(location.search);
  if (document.body.classList.contains("library-open") || !currentBook) {
    params.delete("book"), params.delete("chapter");
  } else {
    params.set("book", currentBook.id), params.set("chapter", state.currentChapter);
  }
  var qs = params.toString(),
    url = location.pathname + (qs ? "?" + qs : "") + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(null, "", url);
}

function parseHashRoute() {
  var params = new URLSearchParams(location.search),
    bookId = params.get("book"),
    chapterId = params.get("chapter");
  if (!bookId || !chapterId) return null;
  var book = findBook(bookId);
  return book ? { book: book, chapter: chapterId } : null;
}

// popstate (not hashchange): fires on back/forward navigation and when an
// extension opens/updates a tab with a different ?book=&chapter= query.
window.addEventListener("popstate", function() {
  var route = parseHashRoute();
  if (route) {
    if (document.body.classList.contains("library-open")) closeLibrary();
    if (!currentBook || currentBook.id !== route.book.id) {
      state.currentChapter = route.chapter, loadBook(route.book);
    } else {
      showChapter(route.chapter, !0);
    }
  } else {
    document.body.classList.contains("library-open") || openLibrary();
  }
});

function goToChapterAnchor(chapterId, anchorId) {
  showChapter(chapterId), closeSidebar();
  anchorId && requestAnimationFrame(function() {
    var page = document.getElementById("page-" + chapterId);
    if (!page) return;
    var targetEl = null;
    try {
      targetEl = page.querySelector("#" + CSS.escape(anchorId)) || page.querySelector('[name="' + CSS.escape(anchorId) + '"]')
    } catch (e) {}
    targetEl && targetEl.scrollIntoView({
      block: "start"
    })
  })
}

function restoreChapterScroll(id) {
  var page = document.getElementById("page-" + id),
    body = page ? page.querySelector(".chapter-body") : null,
    key = progressKey(id),
    fraction = state.progress[key] || 0;
  if (!body || fraction <= 0) return updateChapterMeta(), updateReadingProgress(), void updateSidebarMeta();
  requestAnimationFrame(function() {
    var viewportHeight = window.innerHeight,
      scrollable = body.scrollHeight - viewportHeight;
    if (scrollable > 0) {
      var bodyTop = body.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, bodyTop + fraction * scrollable)
    }
    requestAnimationFrame(function() {
      updateChapterMeta(), updateReadingProgress(), updateSidebarMeta()
    })
  })
}

function updateReadingProgress() {
  var page = document.getElementById("page-" + state.currentChapter);
  if (page && page.offsetParent) {
    var body = page.querySelector(".chapter-body");
    if (body) {
      var bodyRect = body.getBoundingClientRect(),
        viewportHeight = window.innerHeight,
        scrollable = body.scrollHeight - viewportHeight,
        fraction = scrollable > 0 ? Math.min(1, Math.max(0, -bodyRect.top / scrollable)) : 1,
        key = progressKey(state.currentChapter);
      state.progress[key] = fraction, currentBook && saveState();
      var totalProgress = 0,
        chapters = $$(".chapter-page"),
        count = 0;
      chapters.forEach(function(ch) {
        var k = progressKey(ch.getAttribute("data-chapter-id"));
        void 0 !== state.progress[k] ? (totalProgress += state.progress[k], count++) : (totalProgress += 0, count++)
      }), totalProgress = count > 0 ? totalProgress / count : 0;
      var progressEl = $("#bookProgress");
      progressEl && (progressEl.textContent = Math.round(100 * totalProgress) + "% complete"), currentBook && (currentBook.progress = totalProgress, persistCurrentBook()), updateSidebarMeta()
    }
  }
}

function updateChapterMeta() {
  var page = document.getElementById("page-" + state.currentChapter);
  if (page) {
    var body = page.querySelector(".chapter-body"),
      metaEl = page.querySelector(".chapter-meta");
    if (body && metaEl) {
      var words = body.innerText.trim().split(/\s+/).filter(Boolean).length,
        key = progressKey(state.currentChapter),
        fraction = state.progress[key] || 0,
        remaining = Math.max(0, Math.round(words * (1 - fraction))),
        minsLeft = Math.max(1, Math.round(remaining / state.wpm));
      metaEl.textContent = words.toLocaleString() + " words · " + minsLeft + " min left"
    }
  }
}

function updateSidebarMeta() {
  $$(".chapter-page").forEach(function(ch) {
    var id = ch.getAttribute("data-chapter-id"),
      meta = document.getElementById("meta-" + id + "-sidebar");
    if (meta) {
      var bodyEl = ch.querySelector(".chapter-body");
      if (bodyEl) {
        var wordCount = bodyEl.innerText.trim().split(/\s+/).filter(Boolean).length,
          key = progressKey(id),
          progress = state.progress[key] || 0;
        if (id === state.currentChapter) meta.textContent = Math.round(100 * progress) + "%";
        else {
          var timeLeft = Math.max(1, Math.round(wordCount / state.wpm));
          meta.textContent = timeLeft + " min"
        }
      }
    }
  })
}

function persistCurrentBook() {
  if (currentBook) {
    persistBookDebounced(currentBook)
  }
}

function renderChapterPageHtml(book, chapter, index, total) {
  var isFirst = 0 === index,
    isLast = index === total - 1,
    prevBtn = isFirst ? '<span class="chapter-nav-spacer"></span>' : '<button class="chapter-nav-btn chapter-nav-prev" data-go="' + book.chapters[index - 1].id + '">← Previous Chapter</button>',
    nextBtn = isLast ? '<span class="chapter-nav-spacer"></span>' : '<button class="chapter-nav-btn chapter-nav-next" data-go="' + book.chapters[index + 1].id + '">Next Chapter →</button>',
    endHtml = isLast ? '<div class="book-end"><div class="book-end-mark"></div><p class="book-end-text">End of book</p></div>' : "",
    hasTitle = !!chapter.title,
    dividerHtml = hasTitle ? '<h2 class="chapter-divider">' + escapeHtml(chapter.title) + "</h2>" : "";
  return '<section class="chapter-page" id="page-' + chapter.id + '" data-chapter-id="' + chapter.id + '"' + (isFirst ? "" : " hidden") + '><header class="chapter-head' + (hasTitle ? "" : " chapter-head--no-divider") + '"><div class="chapter-byline"><span class="cb-title">' + escapeHtml(book.title) + '</span><span class="cb-by">' + escapeHtml(book.author) + "</span></div>" + dividerHtml + '<p class="chapter-meta" id="meta-' + chapter.id + '">&nbsp;</p></header><div class="chapter-body">' + chapter.html + "</div>" + endHtml + '<nav class="chapter-nav">' + prevBtn + nextBtn + "</nav></section>"
}

// Renders a single sidebar row (leaf label + optional expand/collapse toggle).
// `seenChapterIds` tracks which chapterId has already claimed the
// "meta-<id>-sidebar" element id, since a shared file can legitimately be
// pointed at by more than one TOC entry (e.g. several in-file anchors) and
// DOM ids must stay unique — only the first such row gets live progress text.
function renderTocNodeHtml(node, book, depth, seenChapterIds) {
  var hasChildren = node.subitems && node.subitems.length > 0,
    chapter = node.chapterId ? book.chapters.filter(function(c) {
      return c.id === node.chapterId
    })[0] : null,
    label = (chapter && chapter.title) || node.label || "Untitled",
    metaId = "",
    itemHtml;
  if (node.chapterId && !seenChapterIds[node.chapterId]) {
    seenChapterIds[node.chapterId] = !0;
    metaId = ' id="meta-' + node.chapterId + '-sidebar"'
  }
  itemHtml = node.chapterId ?
    '<button class="sidebar-item toc-item" data-target="' + node.chapterId + '"' + (node.anchor ? ' data-anchor="' + escapeHtml(node.anchor) + '"' : "") + '><span class="sidebar-item-title">' + escapeHtml(label) + '</span><span class="sidebar-item-meta"' + metaId + "></span></button>" :
    '<span class="sidebar-item toc-item toc-item--unlinked"><span class="sidebar-item-title">' + escapeHtml(label) + "</span></span>";
  return '<li class="toc-node" style="--toc-depth:' + depth + '">' +
    '<div class="toc-row">' +
    (hasChildren ? '<button class="toc-toggle" aria-expanded="true" aria-label="Toggle section"></button>' : '<span class="toc-toggle-spacer"></span>') +
    itemHtml +
    "</div>" +
    (hasChildren ? '<ul class="toc-children">' + node.subitems.map(function(child) {
      return renderTocNodeHtml(child, book, depth + 1, seenChapterIds)
    }).join("") + "</ul>" : "") +
    "</li>"
}

function renderSidebarHtml(book) {
  if (book.toc && book.toc.length) {
    var seenChapterIds = {};
    return book.toc.map(function(node) {
      return renderTocNodeHtml(node, book, 0, seenChapterIds)
    }).join("")
  }
  // Fallback for books saved before nested TOC support existed, or EPUBs
  // with no nav/NCX at all — same flat list as before.
  return book.chapters.map(function(ch, i) {
    return '<li><button class="sidebar-item" data-target="' + ch.id + '"><span class="sidebar-item-title">' + escapeHtml(ch.title || "Section " + (i + 1)) + '</span><span class="sidebar-item-meta" id="meta-' + ch.id + '-sidebar"></span></button></li>'
  }).join("")
}

function rerenderChapters(book, keepPosition) {
  document.querySelector(".page main").innerHTML = book.chapters.map(function(ch, i) {
    return renderChapterPageHtml(book, ch, i, book.chapters.length)
  }).join("");
  chapterList.innerHTML = renderSidebarHtml(book);
  chapterPages = $$(".chapter-page");
  sidebarItems = $$(".sidebar-item[data-target]");
  sidebarItems.forEach(function(item) {
    var chapterId = item.getAttribute("data-target"),
      anchorId = item.getAttribute("data-anchor"),
      titleEl = item.querySelector(".sidebar-item-title");
    item.addEventListener("click", function(e) {
      if (!item.classList.contains("is-renaming")) {
        if (e.target.closest(".sidebar-item-title")) {
          if (chapterRenameClickTimer) return void(clearTimeout(chapterRenameClickTimer), chapterRenameClickTimer = null);
          chapterRenameClickTimer = setTimeout(function() {
            chapterRenameClickTimer = null, anchorId ? goToChapterAnchor(chapterId, anchorId) : (showChapter(chapterId), closeSidebar())
          }, 280);
          return
        }
        anchorId ? goToChapterAnchor(chapterId, anchorId) : (showChapter(chapterId), closeSidebar())
      }
    });
    titleEl && bindChapterTitleDblClick(item, titleEl, chapterId)
  });
  $$(".toc-toggle").forEach(function(toggle) {
    toggle.addEventListener("click", function(e) {
      e.stopPropagation();
      var node = toggle.closest(".toc-node"),
        expanded = "true" === toggle.getAttribute("aria-expanded");
      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      node.classList.toggle("is-collapsed", expanded)
    })
  });
  $$(".chapter-nav-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      showChapter(btn.getAttribute("data-go"))
    })
  });
  $$("[data-toc-link]").forEach(function(a) {
    a.addEventListener("click", function(e) {
      e.preventDefault();
      var targetId = a.getAttribute("data-goto-chapter");
      targetId && goToChapterAnchor(targetId, a.getAttribute("data-goto-anchor"))
    })
  });
  if (keepPosition) {
    book.chapters.some(function(c) {
      return c.id === state.currentChapter
    }) || (state.currentChapter = book.chapters[0].id)
  } else {
    var lastValid = book.lastChapter && book.chapters.some(function(c) {
      return c.id === book.lastChapter
    });
    state.currentChapter = lastValid ? book.lastChapter : book.chapters[0].id
  }
  showChapter(state.currentChapter, !0), buildChapterData(), saveState(), applyTitleFont(), applyAuthorFont()
}
var chapterData = [],
  currentFlash = null,
  flashTimeout = null;

function buildChapterData() {
  chapterData = [], $$(".chapter-page").forEach(function(page) {
    var id = page.getAttribute("data-chapter-id"),
      titleEl = page.querySelector(".chapter-divider"),
      title = titleEl ? titleEl.textContent.trim() : id,
      body = page.querySelector(".chapter-body");
    body && chapterData.push({
      id: id,
      title: title,
      text: body.textContent,
      element: body
    })
  })
}

function performSearch(query) {
  if (!query || query.length < 2) return searchCount.textContent = "0 results", void(searchResults.innerHTML = '<div class="search-empty">Type at least 2 characters to search</div>');
  var regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
    results = [];
  if (chapterData.forEach(function(chapter) {
      for (var match, text = chapter.text, found = !1, matches = [], tempRegex = new RegExp(regex.source, "gi"); null !== (match = tempRegex.exec(text));) {
        var start = Math.max(0, match.index - 60),
          end = Math.min(text.length, match.index + match[0].length + 60),
          highlightedSnippet = text.substring(start, end).replace(regex, function(m) {
            return "<em>" + m + "</em>"
          });
        start > 0 && (highlightedSnippet = "…" + highlightedSnippet), end < text.length && (highlightedSnippet += "…"), matches.push({
          snippet: highlightedSnippet,
          matchText: match[0]
        }), found = !0
      }
      found && results.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        matches: matches
      })
    }), 0 === results.length) return searchCount.textContent = "0 results", void(searchResults.innerHTML = '<div class="search-empty">No results found for "' + escapeHtml(query) + '"</div>');
  var totalMatches = 0;
  results.forEach(function(r) {
    totalMatches += r.matches.length
  }), searchCount.textContent = totalMatches + " result" + (totalMatches > 1 ? "s" : "");
  var html = "";
  results.forEach(function(result) {
    result.matches.forEach(function(match) {
      html += '<div class="search-result-item" data-chapter="' + result.chapterId + '" data-query="' + escapeHtml(query) + '">', html += '<div class="search-result-chapter">' + (result.chapterTitle || "Untitled section") + "</div>", html += '<div class="search-result-snippet">' + match.snippet + "</div>", html += "</div>"
    })
  }), searchResults.innerHTML = html, searchResults.querySelectorAll(".search-result-item").forEach(function(item) {
    item.addEventListener("click", function() {
      var chapterId = this.getAttribute("data-chapter"),
        query = this.getAttribute("data-query") || searchInput.value;
      closeSearch(), showChapter(chapterId), setTimeout(function() {
        var bodyEl = document.querySelector("#page-" + chapterId + " .chapter-body");
        bodyEl && highlightAndScrollToMatch(query, bodyEl)
      }, 350)
    })
  })
}

function highlightAndScrollToMatch(query, container) {
  if (currentFlash) {
    try {
      var parent = currentFlash.parentNode;
      if (parent) {
        var textNode = document.createTextNode(currentFlash.textContent);
        parent.replaceChild(textNode, currentFlash), parent.normalize()
      }
    } catch (e) {}
    currentFlash = null
  }
  if (flashTimeout && (clearTimeout(flashTimeout), flashTimeout = null), query && !(query.length < 2))
    for (var node, regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, !1); node = walker.nextNode();) {
      var text = node.textContent,
        match = regex.exec(text);
      if (match) {
        var span = document.createElement("span");
        span.className = "flash-highlight", span.textContent = match[0];
        var before = text.substring(0, match.index),
          after = text.substring(match.index + match[0].length),
          fragment = document.createDocumentFragment();
        before && fragment.appendChild(document.createTextNode(before)), fragment.appendChild(span), after && fragment.appendChild(document.createTextNode(after)), node.parentNode.replaceChild(fragment, node), currentFlash = span, span.scrollIntoView({
          block: "center",
          behavior: "smooth"
        }), flashTimeout = setTimeout(function() {
          if (span && span.parentNode) {
            var parent = span.parentNode,
              textNode = document.createTextNode(span.textContent);
            parent.replaceChild(textNode, span), parent.normalize(), currentFlash = null
          }
          flashTimeout = null
        }, 2200);
        break
      }
    }
}
var searchPanel = $("#searchPanel"),
  searchOverlay = $("#searchOverlay"),
  searchInput = $("#searchInput"),
  searchCount = $("#searchCount"),
  searchResults = $("#searchResults"),
  searchClose = $("#searchClose"),
  searchToggle = $("#searchToggle");

function openSearch() {
  closeSettings(), closeSidebar(), searchPanel.classList.add("is-open"), searchOverlay.classList.add("is-open"), searchToggle.classList.add("is-active"), buildChapterData(), setTimeout(function() {
    searchInput.focus()
  }, 100)
}

function closeSearch() {
  if (searchPanel.classList.remove("is-open"), searchOverlay.classList.remove("is-open"), searchToggle.classList.remove("is-active"), searchInput.value = "", searchCount.textContent = "0 results", searchResults.innerHTML = '<div class="search-empty">Type at least 2 characters to search</div>', currentFlash) {
    try {
      var parent = currentFlash.parentNode;
      if (parent) {
        var textNode = document.createTextNode(currentFlash.textContent);
        parent.replaceChild(textNode, currentFlash), parent.normalize()
      }
    } catch (e) {}
    currentFlash = null
  }
  flashTimeout && (clearTimeout(flashTimeout), flashTimeout = null)
}
searchToggle.addEventListener("click", function(e) {
  e.stopPropagation(), searchPanel.classList.contains("is-open") ? closeSearch() : openSearch()
}), searchClose.addEventListener("click", closeSearch), searchOverlay.addEventListener("click", closeSearch), searchInput.addEventListener("input", function() {
  performSearch(this.value)
}), searchInput.addEventListener("keydown", function(e) {
  "Escape" === e.key && closeSearch()
}), document.addEventListener("keydown", function(e) {
  (e.ctrlKey || e.metaKey) && "f" === e.key && (e.preventDefault(), searchPanel.classList.contains("is-open") ? (searchInput.focus(), searchInput.select()) : openSearch()), "Escape" === e.key && searchPanel.classList.contains("is-open") && closeSearch()
});
var sidebar = $("#sidebar"),
  sidebarBackdrop = $("#sidebarBackdrop"),
  sidebarToggle = $("#sidebarToggle"),
  chapterList = $("#chapterList");

function openSidebar() {
  closeSettings(), closeSearch(), sidebar.classList.add("is-open"), sidebarBackdrop.classList.add("is-open")
}

function closeSidebar() {
  sidebar.classList.remove("is-open"), settingsPanel.classList.contains("is-open") || sidebarBackdrop.classList.remove("is-open")
}
sidebarToggle.addEventListener("click", function(e) {
  e.stopPropagation(), sidebar.classList.contains("is-open") ? closeSidebar() : openSidebar()
}), sidebarItems.forEach(function(item) {
  item.addEventListener("click", function() {
    showChapter(item.getAttribute("data-target")), closeSidebar()
  })
});
var sidebarLabelToggle = $("#sidebarLabelToggle"),
  sidebarLabelMenu = $("#sidebarLabelMenu"),
  sidebarLabelText = $("#sidebarLabelText"),
  sidebarSwitchItem = $("#sidebarSwitchItem"),
  mediaView = $("#mediaView"),
  mediaGrid = $("#mediaGrid"),
  mediaEmpty = $("#mediaEmpty"),
  mediaCount = $("#mediaCount"),
  sidebarView = "contents";

function renderMedia(images) {
  if (mediaCount.textContent = images.length, 0 === images.length) return mediaGrid.innerHTML = "", mediaEmpty.hidden = !1, void(mediaGrid.hidden = !0);
  mediaGrid.innerHTML = images.map(function(img) {
    return '<button class="sidebar-media-tile" type="button"><span class="sidebar-media-thumb" style="background-image:url(&quot;' + img.dataUrl + '&quot;);"></span><span class="sidebar-media-caption">' + escapeHtml(img.caption) + "</span></button>"
  }).join(""), mediaGrid.querySelectorAll(".sidebar-media-tile").forEach(function(tile, i) {
    tile.addEventListener("click", function() {
      openMediaLightbox(images[i].dataUrl)
    })
  }), mediaEmpty.hidden = !0, mediaGrid.hidden = !1, renderSidebarView()
}
var mediaLightboxOverlay = $("#mediaLightboxOverlay"),
  mediaLightbox = $("#mediaLightbox"),
  mediaLightboxImg = $("#mediaLightboxImg");

function openMediaLightbox(src) {
  mediaLightboxImg.src = src, mediaLightboxOverlay.classList.add("is-open"), mediaLightbox.classList.add("is-open")
}

function closeMediaLightbox() {
  mediaLightboxOverlay.classList.remove("is-open"), mediaLightbox.classList.remove("is-open")
}

function renderSidebarView() {
  var showingMedia = "media" === sidebarView;
  if (sidebarLabelText.textContent = showingMedia ? "Media" : "Contents", sidebarSwitchItem.textContent = showingMedia ? "Contents" : "Media", chapterList.hidden = showingMedia, mediaView.hidden = !showingMedia, showingMedia) {
    var hasImages = mediaGrid.children.length > 0;
    mediaEmpty.hidden = hasImages, mediaGrid.hidden = !hasImages
  }
}
mediaLightboxOverlay.addEventListener("click", closeMediaLightbox), mediaLightbox.addEventListener("click", closeMediaLightbox), document.addEventListener("keydown", function(e) {
  "Escape" === e.key && mediaLightbox.classList.contains("is-open") && closeMediaLightbox()
}), sidebarLabelToggle.addEventListener("click", function() {
  var isOpen = "true" === this.getAttribute("aria-expanded");
  this.setAttribute("aria-expanded", isOpen ? "false" : "true"), sidebarLabelMenu.style.display = isOpen ? "none" : "block"
}), sidebarSwitchItem.addEventListener("click", function() {
  sidebarView = "contents" === sidebarView ? "media" : "contents", renderSidebarView(), sidebarLabelMenu.style.display = "none", sidebarLabelToggle.setAttribute("aria-expanded", "false")
});

function renameChapter(ch, newTitle) {
  ch.title = newTitle;
  var headEl = document.querySelector("#page-" + ch.id + " .chapter-head"),
    dividerEl = document.querySelector("#page-" + ch.id + " .chapter-divider");
  if (newTitle) {
    if (dividerEl) dividerEl.textContent = newTitle;
    else if (headEl) {
      var newDivider = document.createElement("h2");
      newDivider.className = "chapter-divider", newDivider.textContent = newTitle;
      var metaEl = headEl.querySelector(".chapter-meta");
      metaEl ? headEl.insertBefore(newDivider, metaEl) : headEl.appendChild(newDivider), headEl.classList.remove("chapter-head--no-divider")
    }
  } else {
    dividerEl && dividerEl.remove(), headEl && headEl.classList.add("chapter-head--no-divider")
  }
  currentBook && state.currentChapter === ch.id && !document.body.classList.contains("library-open") && updateReaderDocumentTitle(), persistCurrentBook()
}
var chapterRenameClickTimer = null;

function bindChapterTitleDblClick(item, titleEl, chapterId) {
  titleEl.addEventListener("dblclick", function(e) {
    e.preventDefault(), e.stopPropagation(), chapterRenameClickTimer && (clearTimeout(chapterRenameClickTimer), chapterRenameClickTimer = null), startChapterRename(item, titleEl, chapterId)
  })
}

function startChapterRename(item, titleEl, chapterId) {
  if (!currentBook || item.classList.contains("is-renaming")) return;
  var chIndex = currentBook.chapters.findIndex(function(c) {
    return c.id === chapterId
  });
  if (-1 === chIndex) return;
  var ch = currentBook.chapters[chIndex];
  void 0 === ch.originalTitle && (ch.originalTitle = ch.title);
  item.classList.add("is-renaming");
  var input = document.createElement("input");
  input.type = "text", input.className = "sidebar-item-title-input", input.value = ch.title, titleEl.replaceWith(input), input.focus(), input.select();

  function finish(commit) {
    input.removeEventListener("keydown", onKeydown), input.removeEventListener("blur", onBlur);
    var finalValue = commit ? input.value.trim() || ch.originalTitle || "" : ch.title;
    finalValue !== ch.title && renameChapter(ch, finalValue);
    var displayTitle = ch.title || "Section " + (chIndex + 1),
      newTitleEl = document.createElement("span");
    newTitleEl.className = "sidebar-item-title", newTitleEl.textContent = displayTitle, input.replaceWith(newTitleEl), item.classList.remove("is-renaming"), bindChapterTitleDblClick(item, newTitleEl, chapterId)
  }

  function onKeydown(e) {
    "Enter" === e.key ? (e.preventDefault(), finish(!0)) : "Escape" === e.key && (e.preventDefault(), finish(!1))
  }

  function onBlur() {
    finish(!0)
  }
  input.addEventListener("keydown", onKeydown), input.addEventListener("blur", onBlur)
}
var settingsPanel = $("#settingsPanel"),
  settingsToggle = $("#settingsToggle"),
  settingsClose = $("#settingsClose");

function openSettings() {
  closeSidebar(), closeSearch(), settingsPanel.classList.add("is-open"), sidebarBackdrop.classList.add("is-open"), settingsToggle.classList.add("is-active")
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
  libraryAddBtn = $("#libraryAddBtn"),
  libraryFileInput = $("#libraryFileInput"),
  libraryBody = $("#libraryBody"),
  librarySearchInput = $("#librarySearchInput"),
  libraryHeader = $("#libraryHeader"),
  librarySortBtn = $("#librarySortBtn"),
  sortDropdown = $("#sortDropdown"),
  libraryBackBtn = $("#libraryBackBtn"),
  libraryLabelText = $("#libraryLabelText"),
  currentGroupFilter = null,
  GROUP_NAMES_KEY = "reader_group_names",
  DEFAULT_GROUP_NAMES = {
    recent: "Recently Read",
    complete: "Completed"
  };

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
  return names[key] || DEFAULT_GROUP_NAMES[key] || "Group"
}

function getGroupBooks(list, key) {
  return "recent" === key ? list.filter(function(b) {
    return "reading" === b.status || "complete" === b.status
  }).slice().sort(function(a, b) {
    return (b.lastOpened || 0) - (a.lastOpened || 0)
  }).slice(0, 10) : "complete" === key ? list.filter(function(b) {
    return "complete" === b.status
  }).slice().sort(function(a, b) {
    return (b.completedAt || b.lastOpened || 0) - (a.completedAt || a.lastOpened || 0)
  }) : list.filter(function(b) {
    return (b.customGroups || []).indexOf(key) !== -1
  }).slice().sort(function(a, b) {
    return (b.lastOpened || 0) - (a.lastOpened || 0)
  })
}

function isCustomGroupKey(key) {
  return !!key && "recent" !== key && "complete" !== key
}

function listCustomGroupKeys(list) {
  var keys = [];
  return list.forEach(function(b) {
    (b.customGroups || []).forEach(function(k) {
      -1 === keys.indexOf(k) && keys.push(k)
    })
  }), keys
}

function buildGroups(list) {
  var groups = [],
    recentBooks = getGroupBooks(list, "recent"),
    completeBooks = getGroupBooks(list, "complete");
  recentBooks.length && groups.push({
    key: "recent",
    books: recentBooks
  }), completeBooks.length && groups.push({
    key: "complete",
    books: completeBooks
  });
  return listCustomGroupKeys(list).forEach(function(key) {
    var books = getGroupBooks(list, key);
    books.length && groups.push({
      key: key,
      books: books
    })
  }), groups
}

function renderGroupTile(key, books) {
  var covers = books.slice(0, 2),
    layersHtml = "";
  covers.length >= 2 && (layersHtml += '<div class="group-tile-card layer-1"></div>');
  var front = covers[0],
    frontInner = front.cover ? '<img src="' + front.cover + '" alt="">' : '<div class="placeholder">' + escapeHtml((front.title || "?").charAt(0).toUpperCase()) + "</div>";
  return layersHtml += '<div class="group-tile-card layer-0">' + frontInner + "</div>", '<div class="group-tile" data-group="' + key + '" role="button" tabindex="0"><div class="group-tile-stack"><span class="group-tile-count">' + books.length + '</span>' + layersHtml + '</div><div class="group-tile-label">' + escapeHtml(groupName(key)) + '</div><div class="group-tile-sub">' + books.length + (1 === books.length ? " book" : " books") + "</div></div>"
}

function renderShelfHtml(list) {
  var groups = buildGroups(list);
  if (!groups.length) return "";
  var tiles = groups.map(function(g) {
    return renderGroupTile(g.key, g.books)
  }).join("");
  return '<div class="library-shelf"><div class="library-shelf-row-wrap"><button aria-label="Scroll left" class="shelf-arrow shelf-arrow-left" id="shelfArrowLeft" type="button"><svg fill="none" viewbox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></button><div class="library-shelf-row" id="libraryShelfRow">' + tiles + '</div><button aria-label="Scroll right" class="shelf-arrow shelf-arrow-right is-visible" id="shelfArrowRight" type="button"><svg fill="none" viewbox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></button></div></div>'
}

function updateLibraryHeader() {
  currentGroupFilter ? (libraryBackBtn.hidden = !1, libraryLabelText.textContent = groupName(currentGroupFilter), libraryLabelText.classList.add("is-editable"), libraryAddBtn.style.display = "none") : (libraryBackBtn.hidden = !0, libraryLabelText.textContent = "Library", libraryLabelText.classList.remove("is-editable"), libraryAddBtn.style.display = "")
}

function enterGroup(key) {
  currentGroupFilter = key, renderLibrary(), libraryBody.scrollTop = 0, document.title = groupName(key)
}

function exitGroup() {
  currentGroupFilter = null, renderLibrary(), libraryBody.scrollTop = 0, document.title = "Library"
}

function openLibrary() {
  closeSidebar(), closeSettings(), closeSearch(), document.body.classList.add("library-open"), libraryToggle.classList.add("is-active"), renderLibrary(), document.title = currentGroupFilter ? groupName(currentGroupFilter) : "Library", state.libraryOpen = !0, saveState(), syncUrlHash()
}

function updateReaderDocumentTitle() {
  if (!currentBook) return void(document.title = "Reader");
  var titleCh = currentBook.chapters.find(function(c) {
    return c.id === state.currentChapter;
  });
  var chTitle = titleCh && titleCh.title ? titleCh.title.trim() : "";
  document.title = chTitle ? (currentBook.title || "Reader") + " - " + chTitle : (currentBook.title || "Reader")
}

function closeLibrary() {
  document.body.classList.remove("library-open"), libraryToggle.classList.remove("is-active"), currentGroupFilter = null, exitSelectionMode(), updateReaderDocumentTitle(), state.libraryOpen = !1, saveState(), syncUrlHash()
}

function findBook(id) {
  return loadLibraryList().find(function(b) {
    return b.id === id
  })
}

function loadBook(book) {
  currentBook = book, state.lastOpenBookId = book.id, saveState(), document.title = book.title || "Reader", "complete" !== book.status && updateReadingStatus(book.id, "reading"), $("#bookTitle").textContent = book.title, $("#bookAuthor").textContent = book.author || "";
  var coverEl = $("#bookCover");

  function tryRestore() {
    var page = document.getElementById("page-" + state.currentChapter);
    page ? page.hidden ? requestAnimationFrame(tryRestore) : restoreChapterScroll(state.currentChapter) : requestAnimationFrame(tryRestore)
  }
  book.cover ? (coverEl.style.backgroundImage = 'url("' + book.cover + '")', coverEl.style.backgroundSize = "cover", coverEl.style.backgroundPosition = "center", coverEl.innerHTML = "") : (coverEl.style.backgroundImage = "", coverEl.innerHTML = "<span>" + escapeHtml((book.title || "?").charAt(0).toUpperCase()) + "</span>"), renderMedia(book.images || []), rerenderChapters(book, !1), setTimeout(function() {
    requestAnimationFrame(tryRestore)
  }, 50)
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
  return '<div class="library-tile' + selectClass + '" data-book-id="' + book.id + '">' + coverHtml + statusBadge + progressHtml + checkHtml + '<button class="library-tile-info-btn" data-book-id="' + book.id + '" aria-label="Book info"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" stroke-width="1.6"/><line x1="12" y1="11" x2="12" y2="16.5" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg></button></div>'
}

function renderLibrary() {
  var allBooks = loadLibraryList(),
    query = (librarySearchInput.value || "").trim().toLowerCase();
    librarySearchInput.placeholder = "Search " + allBooks.length + (1 === allBooks.length ? " book" : " books") + "...";
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
      return "complete" !== b.status
    }),
    sortedBooks = baseList.slice().sort(sortFn),
    filtered = query ? sortedBooks.filter(function(b) {
      return -1 !== (b.title + " " + (b.author || "")).toLowerCase().indexOf(query)
    }) : sortedBooks,
    gridHtml = "";
  visibleBookIds = filtered.map(function(b) {
    return b.id
  });
  gridHtml = 0 === allBooks.length ? '<div class="library-empty">Your library is empty. Add a book to get started.</div>' : 0 === filtered.length && query ? '<div class="library-grid-empty">No books match your search.</div>' : 0 === baseList.length ? '<div class="library-empty">' + (currentGroupFilter ? "No books in this group yet." : "All caught up — every book is marked complete.") + "</div>" : '<div class="library-grid">' + filtered.map(function(b) {
    return renderLibraryTile(b)
  }).join("") + "</div>";
  var shelfHtml = currentGroupFilter ? "" : renderShelfHtml(allBooks);
  libraryBody.innerHTML = shelfHtml + gridHtml, libraryBody.querySelectorAll(".library-tile").forEach(function(tile) {
    var bookId = tile.getAttribute("data-book-id"),
      longPressTimer = null,
      longPressFired = !1,
      pressStartX = 0,
      pressStartY = 0;

    function clearLongPress() {
      longPressTimer && (clearTimeout(longPressTimer), longPressTimer = null)
    }
    tile.addEventListener("pointerdown", function(e) {
      0 === e.button && (longPressFired = !1, pressStartX = e.clientX, pressStartY = e.clientY, clearLongPress(), longPressTimer = setTimeout(function() {
        longPressFired = !0, enterSelectionMode(bookId)
      }, 500))
    }), tile.addEventListener("pointermove", function(e) {
      (Math.abs(e.clientX - pressStartX) > 10 || Math.abs(e.clientY - pressStartY) > 10) && clearLongPress()
    }), tile.addEventListener("pointerup", clearLongPress), tile.addEventListener("pointercancel", clearLongPress), tile.addEventListener("pointerleave", clearLongPress), tile.addEventListener("click", function(e) {
      if (longPressFired) return longPressFired = !1, void e.preventDefault();
      if (selectionMode) return e.preventDefault(), void toggleBookSelection(bookId);
      var book = findBook(bookId);
      book && (closeLibrary(), requestAnimationFrame(function() {
        loadBook(book)
      }))
    })
  }), libraryBody.querySelectorAll(".library-tile-info-btn").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (selectionMode) return;
      var book = findBook(btn.getAttribute("data-book-id"));
      book && openBookInfo(book)
    })
  });
  var shelfRow = $("#libraryShelfRow");
  if (shelfRow) {
    libraryBody.querySelectorAll(".group-tile").forEach(function(tile) {
      var groupKey = tile.getAttribute("data-group"),
        tileLongPressTimer = null,
        tileLongPressFired = !1,
        tilePressX = 0,
        tilePressY = 0;

      function clearTileLongPress() {
        tileLongPressTimer && (clearTimeout(tileLongPressTimer), tileLongPressTimer = null)
      }
      isCustomGroupKey(groupKey) && (tile.addEventListener("pointerdown", function(e) {
        0 === e.button && (tileLongPressFired = !1, tilePressX = e.clientX, tilePressY = e.clientY, clearTileLongPress(), tileLongPressTimer = setTimeout(function() {
          tileLongPressFired = !0, openGroupDeleteConfirm(groupKey)
        }, 500))
      }), tile.addEventListener("pointermove", function(e) {
        (Math.abs(e.clientX - tilePressX) > 10 || Math.abs(e.clientY - tilePressY) > 10) && clearTileLongPress()
      }), tile.addEventListener("pointerup", clearTileLongPress), tile.addEventListener("pointercancel", clearTileLongPress), tile.addEventListener("pointerleave", clearTileLongPress)), tile.addEventListener("click", function() {
        if (tileLongPressFired) return void(tileLongPressFired = !1);
        selectionMode || enterGroup(groupKey)
      }), tile.addEventListener("keydown", function(e) {
        "Enter" !== e.key && " " !== e.key || selectionMode || (e.preventDefault(), enterGroup(groupKey))
      })
    });
    var arrowLeft = $("#shelfArrowLeft"),
      arrowRight = $("#shelfArrowRight"),
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
  }
  updateLibraryHeader(), updateSelectionBar();
  libraryScrollbar && libraryScrollbar.update()
}

var selectionMode = !1,
  selectedBookIds = new Set,
  visibleBookIds = [],
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
  delete names[key], saveGroupNames(names), currentGroupFilter === key && (currentGroupFilter = null, document.title = "Library"), showToast("Group deleted."), renderLibrary()
}
groupDeleteCancel.addEventListener("click", closeGroupDeleteConfirm), groupDeleteOverlay.addEventListener("click", closeGroupDeleteConfirm), groupDeleteConfirm.addEventListener("click", function() {
  groupDeleteTarget && (deleteGroup(groupDeleteTarget), closeGroupDeleteConfirm())
});

function updateSelectionBar() {
  var n = selectedBookIds.size;
  if (!selectionMode || 0 === n) return librarySelectionBar.classList.remove("is-open"), void closeGroupPicker();
  selectionCount.textContent = n + (1 === n ? " selected" : " selected"), librarySelectionBar.classList.add("is-open"), selectionRemoveGroupBtn.hidden = !isCustomGroupKey(currentGroupFilter);
  if (selectionSelectAllBtn) {
    var allSelected = visibleBookIds.length > 0 && visibleBookIds.every(function(id) {
      return selectedBookIds.has(id)
    });
    selectionSelectAllBtn.textContent = allSelected ? "Deselect all" : "Select all", selectionSelectAllBtn.hidden = 0 === visibleBookIds.length
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
  if (!visibleBookIds.length) return;
  var allSelected = visibleBookIds.every(function(id) {
    return selectedBookIds.has(id)
  });
  allSelected ? (selectedBookIds.clear(), exitSelectionMode()) : (visibleBookIds.forEach(function(id) {
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
    var list = loadLibraryList().filter(function(b) {
      return !selectedBookIds.has(b.id)
    }),
      deletedCurrent = currentBook && selectedBookIds.has(currentBook.id);
    saveLibraryList(list), showToast("Deleted " + n + (1 === n ? " book" : " books") + "."), exitSelectionMode(), deletedCurrent && (currentBook = null, state.lastOpenBookId = null, saveState())
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

function resolveHref(dir, href) {
  var parts = (dir + href).split("/"),
    out = [];
  return parts.forEach(function(part) {
    "." !== part && "" !== part && (".." === part ? out.pop() : out.push(part))
  }), out.join("/")
}

// EPUB/XHTML source files sometimes use XML-style self-closing tags for
// elements that aren't actually void in HTML (e.g. `<a id="x"/>` used as an
// empty bookmark). When parsed with DOMParser in "text/html" mode, the
// browser ignores the trailing "/" for non-void tags and treats it as an
// unclosed opening tag — silently swallowing all following content into it
// until the next matching closing/opening tag. That makes unrelated text
// (sometimes whole paragraphs) appear wrapped in a link, div, etc. Rewriting
// these into an explicit empty pair (`<a id="x"></a>`) before parsing keeps
// them truly empty, matching the source's intent.
var HTML_VOID_TAGS = {
  area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
  link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
};

function fixSelfClosingTags(text) {
  return text.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^<>]*)?)\/>/g, function(match, tag, attrs) {
    return HTML_VOID_TAGS[tag.toLowerCase()] ? match : "<" + tag + attrs + "></" + tag + ">"
  })
}

function zipFileLookup(zip, href) {
  if (!href) return null;
  var f = zip.file(href);
  if (f) return f;
  try {
    var decoded = decodeURIComponent(href);
    if (f = zip.file(decoded)) return f
  } catch (e) {}
  for (var lower = href.toLowerCase(), keys = Object.keys(zip.files), i = 0; i < keys.length; i++)
    if (keys[i].toLowerCase() === lower) return zip.file(keys[i]);
  return null
}

function textWordCount(html) {
  var tmp = document.createElement("div");
  return tmp.innerHTML = html, (tmp.textContent || "").trim().split(/\s+/).filter(Boolean).length
}

function isGenericChapterTitle(t) {
  if (!t) return !0;
  var s = t.trim().toLowerCase();
  return !s || (!!/^(chapter|part)\s*\d+$/.test(s) || -1 !== ["contents", "table of contents", "copyright", "title page", "cover", "colophon", "imprint"].indexOf(s))
}
libraryToggle.addEventListener("click", function(e) {
  e.stopPropagation(), document.body.classList.contains("library-open") ? closeLibrary() : openLibrary()
}), libraryBody.addEventListener("scroll", function() {
  var scrollY = this.scrollTop;
  scrollY > 80 && !isLibraryScrolled ? (isLibraryScrolled = !0, libraryHeader.classList.add("is-hidden")) : scrollY <= 80 && isLibraryScrolled && (isLibraryScrolled = !1, libraryHeader.classList.remove("is-hidden"))
}), librarySortBtn.addEventListener("click", function(e) {
  e.stopPropagation(), sortDropdown.classList.toggle("is-open")
}), sortDropdown.addEventListener("click", function(e) {
  var btn = e.target.closest("button[data-sort]");
  btn && (currentSort = btn.getAttribute("data-sort"), state.librarySort = currentSort, saveState(), sortDropdown.querySelectorAll("button").forEach(function(b) {
    b.classList.remove("is-active")
  }), btn.classList.add("is-active"), sortDropdown.classList.remove("is-open"), renderLibrary())
}), document.addEventListener("click", function(e) {
  sortDropdown.contains(e.target) || e.target === librarySortBtn || sortDropdown.classList.remove("is-open")
}), librarySearchInput.addEventListener("input", function() {
  renderLibrary()
}), libraryAddBtn.addEventListener("click", function() {
  libraryFileInput.click()
}), libraryBackBtn.addEventListener("click", function(e) {
  e.stopPropagation(), exitGroup()
}), libraryLabelText.addEventListener("dblclick", function(e) {
  if (currentGroupFilter) {
    e.stopPropagation();
    var key = currentGroupFilter,
      currentName = groupName(key),
      input = document.createElement("input");
    input.type = "text", input.className = "library-label-input", input.value = currentName, libraryLabelText.replaceWith(input), input.focus(), input.select(), input.addEventListener("blur", function() {
      var newName = input.value.trim() || DEFAULT_GROUP_NAMES[key] || "Group",
        names = loadGroupNames();
      names[key] = newName, saveGroupNames(names), input.replaceWith(libraryLabelText), renderLibrary(), currentGroupFilter === key && (document.title = newName)
    }), input.addEventListener("keydown", function(ev) {
      "Enter" === ev.key && (ev.preventDefault(), input.blur()), "Escape" === ev.key && (ev.preventDefault(), input.value = currentName, input.blur())
    })
  }
});

// new library settings button listener
var librarySettingsBtn = document.getElementById("librarySettingsBtn");
if (librarySettingsBtn) {
  librarySettingsBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    openSettings();
  });
}

// Set default Drive folder ID if not already stored
(function() {
  var folderInput = document.getElementById("gdriveFolderId");
  var defaultId = "15hm7VGpCky4dCWOa-jUoM0V-CS14dcLk";
  if (folderInput) {
    var stored = localStorage.getItem("reader_drive_folder_id");
    if (!stored) {
      localStorage.setItem("reader_drive_folder_id", defaultId);
      folderInput.value = defaultId;
    }
  }
})();

var DROP_EPUB_TYPES = ["toc", "landmarks", "cover", "titlepage", "title-page", "halftitle", "copyright-page", "imprint"];

function epubTypeTokens(t) {
  return (t || "").toLowerCase().split(/\s+/).filter(Boolean)
}

function isDropType(epubType) {
  return epubTypeTokens(epubType).some(function(t) {
    return -1 !== DROP_EPUB_TYPES.indexOf(t)
  })
}

// Parse an EPUB3 nav document's <ol><li> tree into a nested structure,
// preserving parent/child grouping (e.g. "Book One" > "Chapter 01"...).
// Independent of the spine — resolved against chapters later.
function parseNavToc(navDoc, navDir) {
  function directChildOl(li) {
    for (var i = 0; i < li.children.length; i++) {
      var c = li.children[i];
      if (c.tagName && "ol" === c.tagName.toLowerCase()) return c
    }
    return null
  }

  function parseLi(li) {
    var directA = null;
    Array.prototype.forEach.call(li.childNodes, function(node) {
      directA || 1 !== node.nodeType || !node.tagName || "a" !== node.tagName.toLowerCase() || (directA = node)
    });
    var linkEl = directA,
      labelText;
    if (directA) labelText = directA.textContent.trim();
    else {
      linkEl = li.querySelector("a[href]");
      var labelSrc = linkEl || li.querySelector("span");
      if (!labelSrc) return null;
      var clone = labelSrc.cloneNode(!0),
        innerOl = clone.querySelector("ol");
      innerOl && innerOl.remove(), labelText = clone.textContent.trim()
    }
    var rawHref = (linkEl && linkEl.getAttribute("href")) || "",
      hashIdx = rawHref.indexOf("#"),
      fragment = -1 !== hashIdx ? rawHref.slice(hashIdx + 1) : "",
      hrefPath = -1 !== hashIdx ? rawHref.slice(0, hashIdx) : rawHref,
      href = hrefPath ? resolveHref(navDir, hrefPath) : "",
      subitems = parseOl(directChildOl(li));
    if (!labelText && !href && !subitems.length) return null;
    return {
      label: labelText,
      href: href,
      fragment: fragment,
      subitems: subitems
    }
  }

  function parseOl(ol) {
    if (!ol) return [];
    return Array.prototype.filter.call(ol.children, function(li) {
      return li.tagName && "li" === li.tagName.toLowerCase()
    }).map(parseLi).filter(Boolean)
  }
  var navEls = Array.prototype.filter.call(navDoc.querySelectorAll("nav"), function(n) {
      return -1 !== epubTypeTokens(n.getAttribute("epub:type")).indexOf("toc")
    }),
    navEl = navEls[0],
    rootOl = (navEl && navEl.querySelector("ol")) || navDoc.querySelector("nav ol") || navDoc.querySelector("ol");
  return parseOl(rootOl)
}

// Parse an EPUB2 NCX <navMap>'s nested <navPoint> tree into the same
// { label, href, fragment, subitems } shape as parseNavToc.
function parseNcxToc(ncxDoc, ncxDir) {
  function parseNavPoint(np) {
    var labelEl = np.getElementsByTagName("text")[0],
      contentEl = np.getElementsByTagName("content")[0];
    if (!labelEl || !contentEl) return null;
    var srcRaw = contentEl.getAttribute("src") || "",
      hashIdx = srcRaw.indexOf("#"),
      fragment = -1 !== hashIdx ? srcRaw.slice(hashIdx + 1) : "",
      hrefPath = -1 !== hashIdx ? srcRaw.slice(0, hashIdx) : srcRaw,
      href = hrefPath ? resolveHref(ncxDir, hrefPath) : "",
      label = labelEl.textContent.trim();
    if (!href || !label) return null;
    return {
      label: label,
      href: href,
      fragment: fragment,
      subitems: parseNavPoints(np)
    }
  }

  function parseNavPoints(parentEl) {
    var points = Array.prototype.filter.call(parentEl.childNodes, function(n) {
      return n.tagName && "navpoint" === n.tagName.toLowerCase()
    });
    return points.map(parseNavPoint).filter(Boolean)
  }
  var navMapEl = ncxDoc.getElementsByTagName("navMap")[0];
  return navMapEl ? parseNavPoints(navMapEl) : []
}

// Resolve a raw { label, href, fragment, subitems } tree (parsed above)
// against the actual chapters we ended up loading, turning each node's
// href/fragment into { chapterId, anchor } for navigation. Nodes that
// don't resolve to a loaded chapter (e.g. filtered/dropped files) keep
// chapterId: null and render as unlinked labels rather than being dropped,
// since e.g. "Book One: Dune" often has no page of its own.
function resolveTocTree(nodes, hrefToChapterId) {
  if (!nodes || !nodes.length) return [];
  var resolved = [];
  nodes.forEach(function(node) {
    var chapterId = node.href ? hrefToChapterId[node.href] : null;
    if (!chapterId && node.href) try {
      chapterId = hrefToChapterId[decodeURIComponent(node.href)]
    } catch (e) {}
    var subitems = resolveTocTree(node.subitems, hrefToChapterId);
    if (!node.label && !chapterId && !subitems.length) return;
    resolved.push({
      label: node.label || "",
      chapterId: chapterId || null,
      anchor: node.fragment || null,
      subitems: subitems
    })
  });
  return resolved
}

function parseEpub(file, fileName) {
  fileName = fileName || (file && file.name) || "Untitled.epub";
  return JSZip.loadAsync(file).then(function(zip) {
    var containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("not a valid EPUB (missing container.xml)");
    return containerFile.async("text").then(function(containerXml) {
      var rootfileEl = (new DOMParser).parseFromString(containerXml, "application/xml").getElementsByTagName("rootfile")[0];
      if (!rootfileEl) throw new Error("could not find the book’s content file");
      var opfPath = rootfileEl.getAttribute("full-path"),
        opfDir = -1 !== opfPath.indexOf("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";
      return zip.file(opfPath).async("text").then(function(opfText) {
        var opfDoc = (new DOMParser).parseFromString(opfText, "application/xml");

        function firstText(tagNames) {
          for (var i = 0; i < tagNames.length; i++) {
            var els = opfDoc.getElementsByTagName(tagNames[i]);
            if (els.length && els[0].textContent.trim()) return els[0].textContent.trim()
          }
          return ""
        }
        var title = firstText(["dc:title", "title"]) || fileName.replace(/\.epub$/i, ""),
          author = firstText(["dc:creator", "creator"]),
          published = (firstText(["dc:date", "date"]) || "").slice(0, 10),
          description = firstText(["dc:description", "description"]),
          manifest = {};
        Array.prototype.forEach.call(opfDoc.getElementsByTagName("item"), function(item) {
          manifest[item.getAttribute("id")] = {
            href: resolveHref(opfDir, item.getAttribute("href")),
            mediaType: item.getAttribute("media-type") || "",
            properties: item.getAttribute("properties") || ""
          }
        });
        var spineIds = Array.prototype.map.call(opfDoc.getElementsByTagName("itemref"), function(ref) {
            return ref.getAttribute("idref")
          }),
          coverHref = null,
          coverItem = Array.prototype.filter.call(opfDoc.getElementsByTagName("item"), function(item) {
            return -1 !== (item.getAttribute("properties") || "").indexOf("cover-image")
          })[0];
        if (coverItem) coverHref = resolveHref(opfDir, coverItem.getAttribute("href"));
        else {
          var coverMeta = Array.prototype.filter.call(opfDoc.getElementsByTagName("meta"), function(m) {
            return "cover" === m.getAttribute("name")
          })[0];
          coverMeta && manifest[coverMeta.getAttribute("content")] && (coverHref = manifest[coverMeta.getAttribute("content")].href)
        }
        var coverHrefPromise = Promise.resolve(coverHref);
        if (!coverHref) {
          var guideRef = Array.prototype.filter.call(opfDoc.getElementsByTagName("reference"), function(r) {
            return "cover" === (r.getAttribute("type") || "").toLowerCase()
          })[0];
          if (guideRef) {
            var guideHref = resolveHref(opfDir, (guideRef.getAttribute("href") || "").split("#")[0]),
              guideFile = zipFileLookup(zip, guideHref);
            guideFile && (coverHrefPromise = guideFile.async("text").then(function(htmlText) {
              var imgEl = (new DOMParser).parseFromString(htmlText, "text/html").querySelector("img[src], image");
              var src = imgEl ? imgEl.getAttribute("src") || imgEl.getAttribute("xlink:href") || imgEl.getAttribute("href") : null;
              return src ? resolveHref(-1 !== guideHref.indexOf("/") ? guideHref.substring(0, guideHref.lastIndexOf("/") + 1) : "", src) : null
            }).catch(function() {
              return null
            }))
          }
        }
        var tocPromise = Promise.resolve({ map: {}, tree: [] }),
          navItem = Array.prototype.filter.call(opfDoc.getElementsByTagName("item"), function(item) {
            return -1 !== (item.getAttribute("properties") || "").indexOf("nav")
          })[0];
        if (navItem) {
          var navHref = resolveHref(opfDir, navItem.getAttribute("href")),
            navDir = -1 !== navHref.indexOf("/") ? navHref.substring(0, navHref.lastIndexOf("/") + 1) : "",
            navFile = zip.file(navHref);
          navFile && (tocPromise = navFile.async("text").then(function(navText) {
            var navDoc = (new DOMParser).parseFromString(fixSelfClosingTags(navText), "text/html"),
              rootOl = navDoc.querySelector("nav ol") || navDoc.querySelector("ol"),
              map = {};
            function walkNavOl(ol) {
              Array.prototype.forEach.call(ol.children, function(li) {
                if (li.tagName && "li" === li.tagName.toLowerCase()) {
                  var linkEl, titleText, directA = null;
                  if (Array.prototype.forEach.call(li.childNodes, function(node) {
                      directA || 1 !== node.nodeType || "a" !== node.tagName.toLowerCase() || (directA = node)
                    }), directA) linkEl = directA, titleText = directA.textContent.trim();
                  else {
                    linkEl = li.querySelector("a[href]");
                    if (linkEl) {
                      var clone = li.cloneNode(!0),
                        innerOl = clone.querySelector("ol");
                      innerOl && innerOl.remove(), titleText = clone.textContent.trim()
                    }
                  }
                  if (linkEl) {
                    var rawHref = linkEl.getAttribute("href") || "",
                      hashIdx = rawHref.indexOf("#"),
                      fragment = -1 !== hashIdx ? rawHref.slice(hashIdx + 1) : "",
                      href = resolveHref(navDir, -1 !== hashIdx ? rawHref.slice(0, hashIdx) : rawHref);
                    href && titleText && (map[href] || (map[href] = []), map[href].some(function(e) {
                      return e.fragment === fragment
                    }) || map[href].push({
                      fragment: fragment,
                      title: titleText
                    }))
                  }
                  // Recurse into any nested <ol> so chapters grouped under a
                  // part/section heading (e.g. "Book One: Dune" > "Chapter 01")
                  // still get their own entry in the flat href->title map.
                  var childOl = Array.prototype.filter.call(li.children, function(c) {
                    return c.tagName && "ol" === c.tagName.toLowerCase()
                  })[0];
                  childOl && walkNavOl(childOl)
                }
              })
            }
            rootOl && walkNavOl(rootOl);
            // Same nav document, parsed again as a tree that keeps nesting
            // (e.g. "Book One: Dune" as a parent of "Chapter 01"..."Chapter 26").
            var tree = parseNavToc(navDoc, navDir);
            return { map: map, tree: tree }
          }).catch(function() {
            return { map: {}, tree: [] }
          }))
        }
        if (!navItem) {
          var ncxItem = Array.prototype.filter.call(opfDoc.getElementsByTagName("item"), function(item) {
            return "application/x-dtbncx+xml" === (item.getAttribute("media-type") || "")
          })[0];
          if (ncxItem) {
            var ncxHref = resolveHref(opfDir, ncxItem.getAttribute("href")),
              ncxDir = -1 !== ncxHref.indexOf("/") ? ncxHref.substring(0, ncxHref.lastIndexOf("/") + 1) : "",
              ncxFile = zip.file(ncxHref);
            ncxFile && (tocPromise = ncxFile.async("text").then(function(ncxText) {
              var ncxDoc = (new DOMParser).parseFromString(ncxText, "application/xml"),
                navMapEl = ncxDoc.getElementsByTagName("navMap")[0],
                map = {};
              navMapEl && Array.prototype.forEach.call(navMapEl.childNodes, function(np) {
                if (np.tagName && "navpoint" === np.tagName.toLowerCase()) {
                  var labelEl = np.getElementsByTagName("text")[0],
                    contentEl = np.getElementsByTagName("content")[0];
                  if (labelEl && contentEl) {
                    var srcRaw = contentEl.getAttribute("src") || "",
                      hashIdx = srcRaw.indexOf("#"),
                      fragment = -1 !== hashIdx ? srcRaw.slice(hashIdx + 1) : "",
                      href = resolveHref(ncxDir, -1 !== hashIdx ? srcRaw.slice(0, hashIdx) : srcRaw),
                      titleText = labelEl.textContent.trim();
                    if (!href || !titleText) return;
                    map[href] || (map[href] = []), map[href].some(function(e) {
                      return e.fragment === fragment
                    }) || map[href].push({
                      fragment: fragment,
                      title: titleText
                    })
                  }
                }
              });
              var tree = navMapEl ? parseNcxToc(ncxDoc, ncxDir) : [];
              return { map: map, tree: tree }
            }).catch(function() {
              return { map: {}, tree: [] }
            }))
          }
        }
        return Promise.all([tocPromise, coverHrefPromise]).then(function(resolvedPair) {
          var tocResult = resolvedPair[0],
            tocMap = tocResult.map,
            tocTreeRaw = tocResult.tree;
          coverHref = resolvedPair[1] || coverHref;
          var chapterPromises = spineIds.map(function(id) {
            var item = manifest[id];
            if (!item) return Promise.resolve(null);
            var zf = zip.file(item.href);
            return zf ? zf.async("text").then(function(text) {
              var doc = (new DOMParser).parseFromString(fixSelfClosingTags(text), "text/html"),
                bodyEl = doc.body;
              if (!bodyEl) return null;
              var epubType = bodyEl.getAttribute("epub:type") || "";
              if (!epubType) {
                var typedEl = bodyEl.querySelector("[epub\\:type]");
                typedEl && (epubType = typedEl.getAttribute("epub:type") || "")
              }
              if (isDropType(epubType)) return null;
              Array.prototype.forEach.call(bodyEl.querySelectorAll("script, style, img, svg, image"), function(el) {
                el.remove()
              });
              var itemDir = -1 !== item.href.indexOf("/") ? item.href.substring(0, item.href.lastIndexOf("/") + 1) : "";
              Array.prototype.forEach.call(bodyEl.querySelectorAll("a[href]"), function(a) {
                var raw = a.getAttribute("href") || "";
                if (!raw || /^(https?:|mailto:|tel:|data:)/i.test(raw)) return;
                var hashIdx = raw.indexOf("#"),
                  fragment = -1 !== hashIdx ? raw.slice(hashIdx + 1) : "",
                  pathPart = -1 !== hashIdx ? raw.slice(0, hashIdx) : raw,
                  targetHref = pathPart ? resolveHref(itemDir, pathPart) : item.href;
                a.setAttribute("data-toc-href", targetHref), fragment && a.setAttribute("data-toc-fragment", fragment), a.setAttribute("data-toc-link", "1"), a.setAttribute("href", "#")
              });
              var html = bodyEl.innerHTML.trim();
              if (!html) return null;
              if (0 === textWordCount(html)) return null;
              var entries = tocMap[item.href] || [],
                wholeFileEntry = entries.filter(function(e) {
                  return !e.fragment
                })[0],
                tocTitle = wholeFileEntry ? wholeFileEntry.title : entries.length ? entries[0].title : "",
                headingEl = bodyEl.querySelector("h1, h2, h3"),
                fallbackTitle = headingEl ? headingEl.textContent.trim() : "";
              return {
                title: tocTitle,
                fallbackTitle: fallbackTitle,
                html: html,
                href: item.href
              }
            }).catch(function() {
              return null
            }) : Promise.resolve(null)
          });
          return Promise.all(chapterPromises).then(function(results) {
            var sections = results.filter(Boolean);
            if (!sections.length) throw new Error("no readable chapters found in this file");
            var chapters = sections.map(function(s, i) {
var rawTitle = (s.title && !isGenericChapterTitle(s.title)) ? s.title
             : (s.fallbackTitle && !isGenericChapterTitle(s.fallbackTitle)) ? s.fallbackTitle
             : (s.title || s.fallbackTitle || "");              return {
                id: "ch-" + i,
                title: rawTitle.trim(),
                originalTitle: rawTitle.trim(),
                html: s.html
              }
            });
            var hrefToChapterId = {};
            sections.forEach(function(s, i) {
              hrefToChapterId[s.href] = "ch-" + i
            });
            // The real book structure, independent of the flat spine order —
            // used to render a nested sidebar instead of "Section N" labels.
            var resolvedToc = resolveTocTree(tocTreeRaw, hrefToChapterId);
            chapters.forEach(function(ch) {
              if (-1 === ch.html.indexOf("data-toc-href")) return;
              var wrap = document.createElement("div");
              wrap.innerHTML = ch.html, Array.prototype.forEach.call(wrap.querySelectorAll("a[data-toc-href]"), function(a) {
                var targetHref = a.getAttribute("data-toc-href"),
                  targetId = hrefToChapterId[targetHref];
                if (!targetId) try {
                  targetId = hrefToChapterId[decodeURIComponent(targetHref)]
                } catch (e) {}
                if (targetId) {
                  a.setAttribute("data-goto-chapter", targetId);
                  var fragAttr = a.getAttribute("data-toc-fragment");
                  fragAttr && a.setAttribute("data-goto-anchor", fragAttr)
                }
                a.removeAttribute("data-toc-href"), a.removeAttribute("data-toc-fragment")
              }), ch.html = wrap.innerHTML
            });

            function guessImageMime(href) {
              var ext = href.split(".").pop().toLowerCase().split("?")[0];
              return "png" === ext ? "image/png" : "svg" === ext ? "image/svg+xml" : "gif" === ext ? "image/gif" : "webp" === ext ? "image/webp" : "image/jpeg"
            }

            function captionFor(href) {
              var base = href.split("/").pop();
              try {
                base = decodeURIComponent(base)
              } catch (e) {}
              return base
            }
            var otherImageHrefs = [];
            Object.keys(manifest).forEach(function(id) {
              var item = manifest[id];
              0 === (item.mediaType || "").trim().toLowerCase().indexOf("image/") && (coverHref && item.href === coverHref || -1 === otherImageHrefs.indexOf(item.href) && otherImageHrefs.push(item.href))
            }), otherImageHrefs = otherImageHrefs.slice(0, 60);
            var coverPromise = Promise.resolve(null);
            if (coverHref) {
              var coverFile = zipFileLookup(zip, coverHref);
              coverFile && (coverPromise = coverFile.async("base64").then(function(base64) {
                return {
                  dataUrl: "data:" + guessImageMime(coverHref) + ";base64," + base64,
                  caption: "Cover"
                }
              }).catch(function() {
                return null
              }))
            }
            var otherImagesPromise = Promise.all(otherImageHrefs.map(function(href) {
              var f = zipFileLookup(zip, href);
              return f ? f.async("base64").then(function(base64) {
                return {
                  dataUrl: "data:" + guessImageMime(href) + ";base64," + base64,
                  caption: captionFor(href)
                }
              }).catch(function() {
                return null
              }) : Promise.resolve(null)
            })).then(function(results) {
              return results.filter(Boolean)
            });
            return Promise.all([coverPromise, otherImagesPromise]).then(function(res) {
              var coverEntry = res[0],
                otherImages = res[1],
                images = coverEntry ? [coverEntry].concat(otherImages) : otherImages;
              return {
                id: "book-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
                title: title,
                author: author,
                published: published,
                description: description,
                cover: coverEntry ? coverEntry.dataUrl : null,
                originalCover: coverEntry ? coverEntry.dataUrl : null,
                images: images,
                chapters: chapters,
                toc: resolvedToc,
                addedAt: Date.now(),
                status: "unread",
                lastOpened: Date.now(),
                driveId: null,
                driveModifiedTime: null
              }
            })
          })
        })
      })
    })
  })
}
libraryFileInput.addEventListener("change", function() {
  var files = Array.prototype.slice.call(this.files);
  if (this.value = "", files.length) {
    if ("undefined" == typeof JSZip) return void showToast("EPUB support failed to load — check your connection and try again.");
    var added = 0,
      failed = 0;
    files.reduce(function(chain, file) {
      return chain.then(function() {
        return showToast("Parsing " + file.name + "…" + (files.length > 1 ? " (" + (added + failed + 1) + "/" + files.length + ")" : "")), parseEpub(file, file.name).then(function(book) {
          var list = loadLibraryList();
          list.push(book), saveLibraryList(list) ? added++ : (failed++, showToast('Parsed "' + book.title + '", but it’s too large to save locally.'))
        }).catch(function(err) {
          console.error(err), failed++, showToast("Could not parse " + file.name + " — " + (err && err.message ? err.message : "unknown error") + ".")
        })
      })
    }, Promise.resolve()).then(function() {
      document.body.classList.contains("library-open") && renderLibrary(), added && showToast(added === files.length ? (1 === added ? "Added 1 book to your library." : "Added " + added + " books to your library.") : "Added " + added + " of " + files.length + " books to your library.")
    })
  }
});
var bookInfoOverlay = $("#bookInfoOverlay"),
  bookInfoModal = $("#bookInfoModal"),
  bookInfoClose = $("#bookInfoClose"),
  infoTitle = $("#infoTitle"),
  infoAuthor = $("#infoAuthor"),
  infoDate = $("#infoDate"),
  infoFetchBtn = $("#infoFetchBtn"),
  infoDescText = $("#infoDescText"),
  infoDescEdit = $("#infoDescEdit"),
  infoDescTextarea = $("#infoDescTextarea"),
  infoDescEditBtn = $("#infoDescEditBtn"),
  infoDescCancel = $("#infoDescCancel"),
  infoDescSave = $("#infoDescSave"),
  infoStatusOptions = $("#infoStatusOptions"),
  infoDeleteBtn = $("#infoDeleteBtn"),
  infoCoverPreview = $("#infoCoverPreview"),
  infoCoverImg = $("#infoCoverImg"),
  infoCoverPlaceholder = $("#infoCoverPlaceholder"),
  infoCoverUploadBtn = $("#infoCoverUploadBtn"),
  infoCoverRemoveBtn = $("#infoCoverRemoveBtn"),
  infoCoverInput = $("#infoCoverInput"),
  bookInfoTarget = null;

function renderBookInfoDesc(book) {
  var desc = (book.description || "").trim();
  desc ? (infoDescText.innerHTML = desc) : (infoDescText.textContent = "No description yet."), infoDescText.classList.toggle("is-empty", !desc)
}

function renderBookInfoStatus(book) {
  var status = book.status || "unread";
  infoStatusOptions.querySelectorAll(".book-info-status-btn").forEach(function(btn) {
    btn.classList.toggle("is-active", btn.getAttribute("data-status") === status)
  })
}

function renderBookInfoCover(book) {
  void 0 === book.originalCover && (book.originalCover = book.cover || null);
  var hasCustomCover = !!book.cover && book.cover !== book.originalCover;
  book.cover ? (infoCoverImg.src = book.cover, infoCoverImg.hidden = !1, infoCoverPlaceholder.hidden = !0) : (infoCoverImg.hidden = !0, infoCoverImg.src = "", infoCoverPlaceholder.hidden = !1), infoCoverRemoveBtn.hidden = !hasCustomCover
}

function persistBookMetadataSafe(book) {
  if (!book) return !1;
  if (currentBook && book.id === currentBook.id) return currentBook.description = book.description, currentBook.published = book.published, currentBook.status = book.status, currentBook.cover = book.cover, currentBook.originalCover = book.originalCover, persistCurrentBookSafe();
  var list = loadLibraryList(),
    idx = list.findIndex(function(b) {
      return b.id === book.id
    });
  return -1 !== idx && (list[idx] = book, saveLibraryList(list))
}

function persistCurrentBookSafe() {
  if (!currentBook) return !1;
  var list = loadLibraryList(),
    idx = list.findIndex(function(b) {
      return b.id === currentBook.id
    });
  return -1 !== idx && (list[idx] = currentBook, saveLibraryList(list))
}
infoCoverPreview.addEventListener("click", function() {
  infoCoverInput.click()
}), infoCoverUploadBtn.addEventListener("click", function() {
  infoCoverInput.click()
}), infoCoverInput.addEventListener("change", function() {
  var file = this.files[0];
  if (file && bookInfoTarget) {
    var book = bookInfoTarget,
      reader = new FileReader;
    reader.onload = function(ev) {
      var url = ev.target.result,
        previousCover = book.cover;
      if (book.cover = url, !persistBookMetadataSafe(book)) return book.cover = previousCover, infoCoverInput.value = "", void showToast("That image is too large to save — try a smaller file.");
      renderBookInfoCover(book), currentBook && currentBook.id === book.id && function() {
        var coverEl = $("#bookCover");
        coverEl.style.backgroundImage = 'url("' + url + '")', coverEl.style.backgroundSize = "cover", coverEl.style.backgroundPosition = "center", coverEl.innerHTML = ""
      }(), document.body.classList.contains("library-open") && renderLibrary(), infoCoverInput.value = "", showToast("Cover updated.")
    }, reader.readAsDataURL(file)
  }
}), infoCoverRemoveBtn.addEventListener("click", function() {
  if (bookInfoTarget) {
    var book = bookInfoTarget;
    book.cover = book.originalCover || "", persistBookMetadataSafe(book), renderBookInfoCover(book), currentBook && currentBook.id === book.id && function() {
      var coverEl = $("#bookCover");
      book.cover ? (coverEl.style.backgroundImage = 'url("' + book.cover + '")', coverEl.style.backgroundSize = "cover", coverEl.style.backgroundPosition = "center", coverEl.innerHTML = "") : (coverEl.style.backgroundImage = "", coverEl.innerHTML = "<span>" + escapeHtml((book.title || "?").charAt(0).toUpperCase()) + "</span>")
    }(), document.body.classList.contains("library-open") && renderLibrary(), showToast("Original cover restored.")
  }
});

function openBookInfo(book) {
  book && (bookInfoTarget = book, infoTitle.textContent = book.title || "Untitled", infoAuthor.textContent = book.author || "", infoAuthor.style.display = book.author ? "" : "none", infoDate.textContent = book.published || "", infoDate.style.display = book.published ? "" : "none", infoFetchBtn.disabled = !1, infoFetchBtn.textContent = "Fetch details from Open Library", renderBookInfoDesc(book), renderBookInfoStatus(book), renderBookInfoCover(book), infoDescEdit.hidden = !0, infoDescText.hidden = !1, infoDescEditBtn.hidden = !1, bookInfoOverlay.classList.add("is-open"), bookInfoModal.classList.add("is-open"))
}

function closeBookInfo() {
  bookInfoOverlay.classList.remove("is-open"), bookInfoModal.classList.remove("is-open"), infoDescEdit.hidden = !0, infoDescText.hidden = !1, infoDescEditBtn.hidden = !1
}

function persistBookMetadata(book) {
  if (book) {
    if (currentBook && book.id === currentBook.id) return currentBook.description = book.description, currentBook.published = book.published, currentBook.status = book.status, void persistCurrentBook();
    var list = loadLibraryList(),
      idx = list.findIndex(function(b) {
        return b.id === book.id
      }); - 1 !== idx && (list[idx] = book, saveLibraryList(list))
  }
}

function fetchFromOpenLibrary(book) {
  var query = [book.title, book.author].filter(Boolean).join(" ");
  return query ? fetch("https://openlibrary.org/search.json?q=" + encodeURIComponent(query) + "&limit=1").then(function(res) {
    return res.json()
  }).then(function(data) {
    var doc = data && data.docs && data.docs[0];
    if (!doc) return null;
    var published = doc.first_publish_year ? String(doc.first_publish_year) : "";
    return doc.key ? fetch("https://openlibrary.org" + doc.key + ".json").then(function(res2) {
      return res2.json()
    }).then(function(workData) {
      var description = "";
      return workData && workData.description && (description = "string" == typeof workData.description ? workData.description : workData.description.value || ""), {
        published: published,
        description: description
      }
    }).catch(function() {
      return {
        published: published,
        description: ""
      }
    }) : {
      published: published,
      description: ""
    }
  }).catch(function() {
    return null
  }) : Promise.resolve(null)
}
infoFetchBtn.addEventListener("click", function() {
  if (bookInfoTarget) {
    var book = bookInfoTarget;
    infoFetchBtn.disabled = !0, infoFetchBtn.textContent = "Fetching…", fetchFromOpenLibrary(book).then(function(result) {
      if (bookInfoTarget === book)
        if (infoFetchBtn.disabled = !1, infoFetchBtn.textContent = "Fetch details from Open Library", result) {
          var filledPublished = !book.published && result.published,
            filledDescription = !book.description && result.description;
          filledPublished && (book.published = result.published), filledDescription && (book.description = result.description), filledPublished || filledDescription ? (infoDate.textContent = book.published || "", infoDate.style.display = book.published ? "" : "none", renderBookInfoDesc(book), persistBookMetadata(book), showToast("Filled in details from Open Library.")) : showToast("No new details found on Open Library.")
        } else showToast("Couldn’t find a match on Open Library.")
    })
  }
}), infoStatusOptions.addEventListener("click", function(e) {
  var btn = e.target.closest(".book-info-status-btn");
  if (btn && bookInfoTarget) {
    var status = btn.getAttribute("data-status");
    bookInfoTarget.status = status, "complete" === status && (bookInfoTarget.completedAt = Date.now()), renderBookInfoStatus(bookInfoTarget), persistBookMetadata(bookInfoTarget), document.body.classList.contains("library-open") && renderLibrary(), showToast("Status updated to " + status + ".")
  }
}), bookInfoClose.addEventListener("click", closeBookInfo), bookInfoOverlay.addEventListener("click", closeBookInfo), document.addEventListener("keydown", function(e) {
  "Escape" === e.key && bookInfoModal.classList.contains("is-open") && closeBookInfo()
}), infoDescEditBtn.addEventListener("click", function() {
  bookInfoTarget && (infoDescTextarea.value = bookInfoTarget.description || "", infoDescText.hidden = !0, infoDescEditBtn.hidden = !0, infoDescEdit.hidden = !1, infoDescTextarea.focus())
}), infoDescCancel.addEventListener("click", function() {
  infoDescEdit.hidden = !0, infoDescText.hidden = !1, infoDescEditBtn.hidden = !1
}), infoDescSave.addEventListener("click", function() {
  bookInfoTarget && (bookInfoTarget.description = infoDescTextarea.value.trim(), renderBookInfoDesc(bookInfoTarget), infoDescEdit.hidden = !0, infoDescText.hidden = !1, infoDescEditBtn.hidden = !1, persistBookMetadata(bookInfoTarget), showToast("Description saved."))
}), infoDeleteBtn.addEventListener("click", function() {
  if (bookInfoTarget) {
    var book = bookInfoTarget,
      title = book.title || "this book";
    if (window.confirm('Delete "' + title + '"? This can\u2019t be undone.')) {
      var list = loadLibraryList().filter(function(b) {
        return b.id !== book.id
      });
      saveLibraryList(list);
      var wasCurrent = currentBook && currentBook.id === book.id;
      closeBookInfo(), document.body.classList.contains("library-open") && renderLibrary(), wasCurrent && (currentBook = null, state.lastOpenBookId = null, saveState(), openLibrary()), showToast('Deleted \u201c' + title + '\u201d.')
    }
  }
}), $("#bookInfo").addEventListener("click", function() {
  openBookInfo(currentBook)
}), $("#sidebarBookInfoBtn").addEventListener("click", function(e) {
  e.stopPropagation(), openBookInfo(currentBook)
});
var bodySizeInput = $("#bodySizeInput");
bodySizeInput.addEventListener("input", function() {
  state.bodySize = parseFloat(this.value) || 16, applyBodyTypography(), saveState()
}), bodySizeInput.addEventListener("change", function() {
  this.value < 8 && (this.value = 8), this.value > 28 && (this.value = 28), state.bodySize = parseFloat(this.value), applyBodyTypography(), saveState()
});
var bodySpacingInput = $("#bodySpacingInput");
bodySpacingInput.addEventListener("input", function() {
  state.bodySpacing = parseFloat(this.value) || 1.8, applyBodyTypography(), saveState()
}), bodySpacingInput.addEventListener("change", function() {
  this.value < 1 && (this.value = 1), this.value > 3 && (this.value = 3), state.bodySpacing = parseFloat(this.value), applyBodyTypography(), saveState()
});
var bodyIndentInput = $("#bodyIndentInput");
bodyIndentInput.addEventListener("input", function() {
  state.bodyIndent = parseFloat(this.value) || 24, applyBodyTypography(), saveState()
}), bodyIndentInput.addEventListener("change", function() {
  this.value < 0 && (this.value = 0), this.value > 40 && (this.value = 40), state.bodyIndent = parseFloat(this.value), applyBodyTypography(), saveState()
});
var marginInput = $("#marginInput");
marginInput.addEventListener("input", function() {
  state.margin = parseFloat(this.value) || 12, document.documentElement.style.setProperty("--margin", state.margin + "%"), saveState()
}), marginInput.addEventListener("change", function() {
  this.value < 0 && (this.value = 0), this.value > 40 && (this.value = 40), state.margin = parseFloat(this.value), document.documentElement.style.setProperty("--margin", state.margin + "%"), saveState()
}), marginInput.value = state.margin || 12, document.documentElement.style.setProperty("--margin", (state.margin || 12) + "%");
var wpmInput = $("#wpmInput");
wpmInput.addEventListener("input", function() {
  state.wpm = parseFloat(this.value) || 220, updateChapterMeta(), updateSidebarMeta(), saveState()
}), wpmInput.addEventListener("change", function() {
  this.value < 50 && (this.value = 50), this.value > 600 && (this.value = 600), state.wpm = parseFloat(this.value), updateChapterMeta(), updateSidebarMeta(), saveState()
}), wpmInput.value = state.wpm || 220;
var customFontNameInput = $("#customFontName"),
  fontUpload = $("#fontUpload"),
  fontStatus = $("#fontStatus"),
  fontRemove = $("#fontRemove"),
  fontSaveBtn = $("#fontSaveBtn");
customFontNameInput.addEventListener("input", function() {
  state.customFontName = this.value.trim(), saveState()
}), fontUpload.addEventListener("change", function(e) {
  var file = this.files[0];
  if (file) {
    var reader = new FileReader;
    reader.onload = function(ev) {
      state.customFontUrl = ev.target.result, fontStatus.textContent = file.name, saveState()
    }, reader.readAsDataURL(file)
  }
}), fontSaveBtn.addEventListener("click", function() {
  var name = customFontNameInput.value.trim() || "Untitled",
    fontName = state.customFontName || name,
    fontUrl = state.customFontUrl;
  if (fontUrl) {
    if (state.savedFonts.some(function(f) {
        return f.name === name
      })) {
      if (!confirm('A font named "' + name + '" already exists. Replace it?')) return;
      state.savedFonts = state.savedFonts.filter(function(f) {
        return f.name !== name
      })
    }
    if (state.savedFonts.push({
        name: name,
        fontName: fontName,
        fontUrl: fontUrl
      }), !saveState()) return state.savedFonts.pop(), void showToast("That font file is too large to save — try a smaller one.");
    customFontNameInput.value = "", fontStatus.textContent = "No file", fontUpload.value = "", state.customFontName = "", state.customFontUrl = "", renderFontToggles(), ["bodyFont", "titleFont", "authorFont"].forEach(function(key) {
      if ("custom" === state[key]) {
        var newKey = "saved-" + (state.savedFonts.length - 1);
        state[key] = newKey
      }
    }), applyBodyTypography(), applyTitleFont(), applyAuthorFont(), renderFontToggles(), updateCustomFontRowVisibility(), saveState()
  } else alert("Please upload a font file first.")
}), fontRemove.addEventListener("click", function() {
  state.customFontName = "", state.customFontUrl = "", customFontNameInput.value = "", fontStatus.textContent = "No file", fontUpload.value = "", saveState()
});
var customPaperInput = $("#customPaper"),
  customInkInput = $("#customInk");
customPaperInput.addEventListener("input", function() {
  state.customPaper = this.value, "custom" === state.themeMode && (applyCustomTheme(state.customPaper, state.customInk, "custom"), saveState())
}), customInkInput.addEventListener("input", function() {
  state.customInk = this.value, "custom" === state.themeMode && (applyCustomTheme(state.customPaper, state.customInk, "custom"), saveState())
});
var themeNameInput = $("#themeNameInput"),
  themeSaveBtn = $("#themeSaveBtn");
themeSaveBtn.addEventListener("click", function() {
  var name = themeNameInput.value.trim() || "Untitled",
    paper = state.customPaper || "#E9E1CB",
    ink = state.customInk || "#2A2419";
  if (state.savedThemes.some(function(t) {
      return t.name === name
    })) {
    if (!confirm('A theme named "' + name + '" already exists. Replace it?')) return;
    state.savedThemes = state.savedThemes.filter(function(t) {
      return t.name !== name
    })
  }
  state.savedThemes.push({
    name: name,
    paper: paper,
    ink: ink
  }), themeNameInput.value = "", renderThemeToggles(), renderSavedThemesList();
  var newIdx = state.savedThemes.length - 1;
  state.activeThemeIndex = newIdx, state.themeMode = "saved", applyThemeByIndex(newIdx), document.getElementById("themeEditor").classList.remove("is-open");
  var btns = $("#themeToggleContainer").querySelectorAll(".toggle-btn");
  btns.forEach(function(b) {
    b.getAttribute("data-theme") === "saved-" + newIdx && (btns.forEach(function(b2) {
      b2.classList.remove("is-selected")
    }), b.classList.add("is-selected"))
  }), saveState()
});
var bgUpload = $("#bgUpload"),
  bgFilename = $("#bgFilename"),
  bgPreview = $("#bgPreview"),
  bgRemove = $("#bgRemove");
bgUpload.addEventListener("change", function(e) {
  var file = this.files[0];
  if (file) {
    var reader = new FileReader;
    reader.onload = function(ev) {
      var url = ev.target.result,
        previousUrl = state.customBgUrl;
      if (state.customBgUrl = url, !saveState()) return state.customBgUrl = previousUrl, bgUpload.value = "", void showToast("That image is too large to save — try a smaller file.");
      bgFilename.textContent = file.name, bgPreview.style.backgroundImage = 'url("' + url + '")', bgPreview.style.display = "block", document.body.classList.add("has-custom-bg"), document.documentElement.style.setProperty("--custom-bg-url", 'url("' + url + '")'), document.documentElement.style.setProperty("--bg-size", state.bgSize)
    }, reader.readAsDataURL(file)
  }
}), bgRemove.addEventListener("click", function() {
  state.customBgUrl = "", bgFilename.textContent = "No background", bgPreview.style.display = "none", bgPreview.style.backgroundImage = "", bgUpload.value = "", document.body.classList.remove("has-custom-bg"), document.documentElement.style.setProperty("--custom-bg-url", "none"), saveState()
});
var bgSizeGroup = document.getElementById("bgSizeGroup");
bgSizeGroup.addEventListener("click", function(e) {
  var btn = e.target.closest(".toggle-btn");
  if (btn) {
    var size = btn.getAttribute("data-bg-size");
    state.bgSize = size, document.documentElement.style.setProperty("--bg-size", size), this.querySelectorAll(".toggle-btn").forEach(function(b) {
      b.classList.remove("is-selected")
    }), btn.classList.add("is-selected"), saveState()
  }
});
var gdriveDot = $("#gdriveDot"),
  gdriveStatusText = $("#gdriveStatusText"),
  gdriveConnect = $("#gdriveConnect"),
  gdriveFolderId = $("#gdriveFolderId"),
  gdriveSyncNow = $("#gdriveSyncNow");
gdriveFolderId.value = localStorage.getItem("reader_drive_folder_id") || "";
gdriveFolderId.addEventListener("change", function() {
  localStorage.setItem("reader_drive_folder_id", gdriveFolderId.value.trim())
});
gdriveConnect.addEventListener("click", function() {
  driveSignIn()
});
gdriveSyncNow.addEventListener("click", function() {
  syncWithDrive()
});
document.addEventListener("keydown", function(e) {
  if ("Escape" === e.key && (groupDeleteModal.classList.contains("is-open") ? closeGroupDeleteConfirm() : selectionMode ? exitSelectionMode() : (closeSidebar(), closeSettings(), currentGroupFilter ? exitGroup() : closeLibrary())), "INPUT" !== e.target.tagName && "TEXTAREA" !== e.target.tagName)
    if ("ArrowRight" !== e.key) {
      if ("ArrowLeft" !== e.key) return "ArrowDown" === e.key || " " === e.key || "Spacebar" === e.key ? (window.scrollBy({
        top: .85 * window.innerHeight,
        behavior: "smooth"
      }), void e.preventDefault()) : "ArrowUp" === e.key ? (window.scrollBy({
        top: .85 * -window.innerHeight,
        behavior: "smooth"
      }), void e.preventDefault()) : "j" === e.key || "J" === e.key ? (window.scrollTo({
        top: 0,
        behavior: "smooth"
      }), void e.preventDefault()) : "l" === e.key || "L" === e.key ? (window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth"
      }), void e.preventDefault()) : void 0;
      var curPagePrev = document.querySelector(".chapter-page:not([hidden])"),
        prev = curPagePrev && curPagePrev.querySelector(".chapter-nav-prev");
      prev && (prev.click(), e.preventDefault())
    } else {
      var curPageNext = document.querySelector(".chapter-page:not([hidden])"),
        next = curPageNext && curPageNext.querySelector(".chapter-nav-next");
      next && (next.click(), e.preventDefault())
    }
});
var isTouch = window.matchMedia("(hover: none)").matches;
if (isTouch) {
  var toolbar = $("#toolbar"),
    touchHint = $("#touchHint");
  touchHint.classList.add("show"), setTimeout(function() {
    touchHint.classList.remove("show")
  }, 3e3), document.addEventListener("click", function(e) {
    var tappedTop = e.clientY < 120,
      tappedToolbar = toolbar.contains(e.target);
    sidebar.contains(e.target) || settingsPanel.contains(e.target) || (tappedTop && !toolbar.classList.contains("is-visible") ? toolbar.classList.add("is-visible") : tappedToolbar || toolbar.classList.remove("is-visible"))
  })
}
var scrollTimer = null;

function onScroll() {
  scrollTimer && (cancelAnimationFrame(scrollTimer), scrollTimer = null), scrollTimer = requestAnimationFrame(function() {
    updateReadingProgress(), updateChapterMeta(), updateSidebarMeta(), scrollTimer = null
  })
}

function addChapterBylines() {
  var mainTitleEl = document.querySelector(".book-title"),
    mainAuthorEl = document.querySelector(".book-author");
  if (mainTitleEl && mainAuthorEl) {
    var titleText = mainTitleEl.textContent.trim(),
      authorText = mainAuthorEl.textContent.trim();
    $$(".chapter-page").forEach(function(page) {
      if (!page.querySelector(".chapter-byline")) {
        var head = page.querySelector(".chapter-head");
        if (head) {
          var byline = document.createElement("div");
          byline.className = "chapter-byline", byline.innerHTML = '<span class="cb-title">' + titleText + '</span><span class="cb-by">' + authorText + "</span>", head.insertBefore(byline, head.firstChild)
        }
      }
    })
  }
}

function init() {
  loadState();
  currentSort = state.librarySort || "recent";
  sortDropdown.querySelectorAll("button[data-sort]").forEach(function(b) {
    b.classList.toggle("is-active", b.getAttribute("data-sort") === currentSort)
  });
  bodySizeInput.value = state.bodySize, bodySpacingInput.value = state.bodySpacing, bodyIndentInput.value = state.bodyIndent, applyBodyTypography(), applyTitleFont(), applyAuthorFont(), addChapterBylines(), renderFontToggles(), renderSavedThemesList(), updateCustomFontRowVisibility(), state.customFontName && (customFontNameInput.value = state.customFontName, state.customFontUrl && (fontStatus.textContent = "Loaded")), document.documentElement.style.setProperty("--bg-size", state.bgSize || "auto"), bgSizeGroup.querySelectorAll(".toggle-btn").forEach(function(b) {
    b.classList.toggle("is-selected", b.getAttribute("data-bg-size") === (state.bgSize || "auto"))
  }), renderThemeToggles(), state.activeThemeIndex >= 0 && state.activeThemeIndex < state.savedThemes.length ? (state.themeMode = "saved", applyThemeByIndex(state.activeThemeIndex)) : "custom" === state.themeMode ? (document.body.setAttribute("data-theme", "custom"), document.getElementById("themeEditor").classList.add("is-open"), customPaperInput.value = state.customPaper || "#E9E1CB", customInkInput.value = state.customInk || "#2A2419", applyCustomTheme(state.customPaper, state.customInk, "custom")) : (document.body.removeAttribute("data-theme"), document.documentElement.style.setProperty("--paper", ""), document.documentElement.style.setProperty("--ink", ""), document.documentElement.style.setProperty("--ink-rgb", "")), state.customBgUrl && (document.body.classList.add("has-custom-bg"), document.documentElement.style.setProperty("--custom-bg-url", 'url("' + state.customBgUrl + '")'), bgFilename.textContent = "Custom background", bgPreview.style.backgroundImage = 'url("' + state.customBgUrl + '")', bgPreview.style.display = "block");
  marginInput.value = state.margin || 12, document.documentElement.style.setProperty("--margin", (state.margin || 12) + "%");
  var route = parseHashRoute();
  var lastBook = route ? route.book : (state.lastOpenBookId ? findBook(state.lastOpenBookId) : null);
  if (lastBook) {
    if (route) state.currentChapter = route.chapter;
    loadBook(lastBook);
  }
  !route && (state.libraryOpen || !lastBook) && openLibrary();
  syncUrlHash();
}
window.addEventListener("scroll", onScroll, {
  passive: !0
}), window.addEventListener("resize", function() {
  updateReadingProgress(), updateChapterMeta(), updateSidebarMeta()
}, {
  passive: !0
});
var loadingOverlay = $("#loadingOverlay");
initLibraryStorage().then(function() {
  loadingOverlay.classList.add("hidden"), init()
}), window.addEventListener("beforeunload", function() {
  saveState();
  Object.keys(persistBookDebounceTimers).forEach(function(id) {
    clearTimeout(persistBookDebounceTimers[id]);
    var book = libraryCache.find(function(b) { return b.id === id });
    book && idbPutBook(book)
  })
});
function setupCustomScrollbar(thumb, scrollEl) {
  if (!thumb) return null;
  var isWindow = !scrollEl || scrollEl === window,
    hideTimer = null,
    dragging = false,
    dragStartY = 0,
    dragStartScroll = 0;

  function viewH() {
    return isWindow ? window.innerHeight : scrollEl.clientHeight
  }

  function fullH() {
    return isWindow ? document.documentElement.scrollHeight : scrollEl.scrollHeight
  }

  function scrollTop() {
    return isWindow ? (window.scrollY || document.documentElement.scrollTop) : scrollEl.scrollTop
  }

  function scrollTo(v) {
    isWindow ? window.scrollTo(0, v) : (scrollEl.scrollTop = v)
  }

  function metrics() {
    var vh = viewH(),
      fh = fullH(),
      thumbH = Math.max(30, vh * vh / fh);
    return {
      viewH: vh,
      fullH: fh,
      thumbH: thumbH,
      maxThumbTop: vh - thumbH,
      maxScroll: fh - vh
    }
  }

  function update() {
    var m = metrics();
    if (m.fullH <= m.viewH + 1) return void(thumb.style.opacity = "0", thumb.style.pointerEvents = "none");
    thumb.style.pointerEvents = "auto";
    var top = scrollTop(),
      thumbTop = m.maxScroll > 0 ? top / m.maxScroll * m.maxThumbTop : 0;
    thumb.style.height = m.thumbH + "px", thumb.style.top = thumbTop + "px"
  }

  function showThumb() {
    update(), thumb.classList.add("is-visible"), clearTimeout(hideTimer), hideTimer = setTimeout(function() {
      dragging || thumb.classList.remove("is-visible")
    }, 900)
  }
  thumb.addEventListener("mousedown", function(e) {
    dragging = !0, dragStartY = e.clientY, dragStartScroll = scrollTop(), thumb.classList.add("is-dragging"), clearTimeout(hideTimer), e.preventDefault()
  }), window.addEventListener("mousemove", function(e) {
    if (!dragging) return;
    var m = metrics();
    if (m.maxThumbTop <= 0) return;
    var scrollDelta = (e.clientY - dragStartY) / m.maxThumbTop * m.maxScroll;
    scrollTo(dragStartScroll + scrollDelta)
  }), window.addEventListener("mouseup", function() {
    dragging && (dragging = !1, thumb.classList.remove("is-dragging"), clearTimeout(hideTimer), hideTimer = setTimeout(function() {
      thumb.classList.remove("is-visible")
    }, 900))
  }), (isWindow ? window : scrollEl).addEventListener("scroll", showThumb, {
    passive: !0
  }), window.addEventListener("resize", update, {
    passive: !0
  }), window.addEventListener("mousemove", function(e) {
    dragging || e.clientX < window.innerWidth - 24 || showThumb()
  }, {
    passive: !0
  }), thumb.addEventListener("mouseenter", showThumb), update();
  return {
    update: update,
    showThumb: showThumb
  }
}
setupCustomScrollbar(document.getElementById("customScrollbarThumb"), window);
var libraryScrollbar = setupCustomScrollbar(document.getElementById("libraryScrollbarThumb"), libraryBody);

