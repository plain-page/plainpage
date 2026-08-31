// ---- Keyboard shortcuts, scroll handling, startup init, teardown, custom scrollbar ----

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
  state.sortByScope = state.sortByScope || {};
  "library" in state.sortByScope || (state.sortByScope.library = state.librarySort || "recent");
  currentSort = getScopeSort(currentSortScopeKey());
  updateSortDropdownUI();
  bodySizeInput.value = state.bodySize, bodySpacingInput.value = state.bodySpacing, bodyIndentInput.value = state.bodyIndent, applyBodyTypography(), applyTitleFont(), applyAuthorFont(), addChapterBylines(), renderFontToggles(), renderSavedThemesList(), updateCustomFontRowVisibility(), state.customFontName && (customFontNameInput.value = state.customFontName, state.customFontUrl && (fontStatus.textContent = "Loaded")), document.documentElement.style.setProperty("--bg-size", state.bgSize || "auto"), bgSizeGroup.querySelectorAll(".toggle-btn").forEach(function(b) {
    b.classList.toggle("is-selected", b.getAttribute("data-bg-size") === (state.bgSize || "auto"))
  }), renderThemeToggles(), state.activeThemeIndex >= 0 && state.activeThemeIndex < state.savedThemes.length ? (state.themeMode = "saved", applyThemeByIndex(state.activeThemeIndex)) : "custom" === state.themeMode ? (document.body.setAttribute("data-theme", "custom"), document.getElementById("themeEditor").classList.add("is-open"), customPaperInput.value = state.customPaper || "#E9E1CB", customInkInput.value = state.customInk || "#2A2419", applyCustomTheme(state.customPaper, state.customInk, "custom")) : (document.body.removeAttribute("data-theme"), document.documentElement.style.setProperty("--paper", ""), document.documentElement.style.setProperty("--ink", ""), document.documentElement.style.setProperty("--ink-rgb", "")), state.customBgUrl && (document.body.classList.add("has-custom-bg"), document.documentElement.style.setProperty("--custom-bg-url", 'url("' + state.customBgUrl + '")'), bgFilename.textContent = "Custom background", bgPreview.style.backgroundImage = 'url("' + state.customBgUrl + '")', bgPreview.style.display = "block");
  marginInput.value = state.margin || 12, document.documentElement.style.setProperty("--margin", (state.margin || 12) + "%");
  var route = parseHashRoute();
  var lastBook = route ? route.book : (state.lastOpenBookId ? findBook(state.lastOpenBookId) : null);
  var bookLoadPromise = Promise.resolve();
  if (lastBook) {
    if (route) state.currentChapter = route.chapter;
    bookLoadPromise = loadBook(lastBook);
  }
  !route && (state.libraryOpen || !lastBook) && openLibrary();
  syncUrlHash();
  return bookLoadPromise
}
window.addEventListener("scroll", onScroll, {
  passive: !0
}), window.addEventListener("resize", function() {
  updateReadingProgress(), updateChapterMeta(), updateSidebarMeta()
}, {
  passive: !0
});
var loadingOverlay = $("#loadingOverlay");
// Ask the browser not to evict this site's data under disk pressure. This is
// advisory (the browser can still say no, e.g. if the site was never
// interacted with), but it costs nothing to ask, and it meaningfully lowers
// the odds of IndexedDB being silently cleared on a low-storage device.
navigator.storage && navigator.storage.persist && navigator.storage.persisted().then(function(already) {
  already || navigator.storage.persist()
}).catch(function() {});
loadState();
var libraryStorageReady = initLibraryStorage();
// Pure UI feedback — never abandons the real openLibraryDB() attempt, which
// keeps waiting and will still complete the moment whatever's blocking it
// closes. This just stops a stuck load from looking indistinguishable from
// a silent freeze.
var stallWarningTimer = setTimeout(function() {
  var textEl = document.getElementById("loadingOverlayText");
  textEl && textEl.textContent.indexOf("Still loading") === -1 && (textEl.textContent = "This is taking a while — try closing other tabs of this app, then reload")
}, 6000);
libraryStorageReady.then(function() {
  clearTimeout(stallWarningTimer);
  // init() resolves once any book it opens has its content loaded (or
  // immediately, if it's opening straight into the library), so the
  // loading overlay stays up through that instead of hiding early and
  // flashing an empty reading page while content fetches in the background.
  return init()
}).then(function() {
  loadingOverlay.classList.add("hidden");
  // Deliberately kicked off after the overlay is gone and the UI is
  // responsive, not as part of startup — see cleanupOversizedCoversInBackground
  // in 03-library-storage.js for why this doesn't speed up this load, only
  // future ones.
  setTimeout(cleanupOversizedCoversInBackground, 2000);
  // Staggered a further 10s behind the cover cleanup rather than run
  // alongside it — both passes read/write every book in the library, and
  // there's no benefit to racing them against each other on disk I/O.
  setTimeout(compressContentInBackground, 12000)
});
function flushPendingBookWrites() {
  saveState();
  Object.keys(persistBookDebounceTimers).forEach(function(id) {
    clearTimeout(persistBookDebounceTimers[id]);
    delete persistBookDebounceTimers[id];
    var book = libraryCache.find(function(b) { return b.id === id });
    book && idbPutBook(book).catch(function(err) {
      console.error("Failed to persist reading progress to IndexedDB", err)
    })
  });
}
// beforeunload alone misses most tab-discard/suspend cases (background tab
// eviction to save memory, mobile OS backgrounding) since those don't
// reliably fire it. visibilitychange -> "hidden" and pagehide do fire in
// those cases, so flush the debounced scroll-position write there too;
// beforeunload stays as a last-resort catch for an actual page close.
document.addEventListener("visibilitychange", function() {
  document.hidden && flushPendingBookWrites()
});
window.addEventListener("pagehide", flushPendingBookWrites);
window.addEventListener("beforeunload", flushPendingBookWrites);
function setupCustomScrollbar(thumb, scrollEl) {
  if (!thumb) return null;
  var isWindow = !scrollEl || scrollEl === window,
    track = thumb.parentElement,
    hideTimer = null,
    dragging = false,
    dragStartY = 0,
    dragStartScroll = 0;

  // For a non-window scroll container, the fixed-position track has to be
  // repositioned to match that container's actual on-screen box every time
  // it moves — otherwise the track (and the thumb math, which assumes the
  // track's 0..viewH exactly covers the container) silently drifts out of
  // sync with any header above it that resizes, hides on scroll, etc.
  function syncTrackToContainer() {
    if (isWindow || !track) return;
    var r = scrollEl.getBoundingClientRect();
    track.style.top = r.top + "px";
    track.style.height = r.height + "px";
  }

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
    syncTrackToContainer();
    var m = metrics();
    if (m.fullH <= m.viewH + 1) return void(thumb.style.opacity = "0", thumb.style.pointerEvents = "none");
    thumb.style.opacity = "", thumb.style.pointerEvents = "auto";
    var top = scrollTop(),
      thumbTop = m.maxScroll > 0 ? top / m.maxScroll * m.maxThumbTop : 0;
    thumb.style.height = m.thumbH + "px", thumb.style.top = thumbTop + "px"
  }

  function showThumb() {
    update(), thumb.classList.add("is-visible"), clearTimeout(hideTimer), hideTimer = setTimeout(function() {
      dragging || thumb.classList.remove("is-visible")
    }, 900);
    // A container's header can animate (e.g. hide-on-scroll) after the
    // scroll event fires; re-sync a few times through that transition so
    // the track doesn't lag behind mid-animation.
    if (!isWindow) [60, 150, 320].forEach(function(d) { setTimeout(update, d) })
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
var libraryScrollbar = setupCustomScrollbar(document.getElementById("libraryScrollbarThumb"), libraryView);
