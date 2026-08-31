// ---- App state, small utilities (color math, escaping), save/load, toast ----

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
    librarySort: "recent",
    sortByScope: {}
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

// Covers only ever render at tile/thumbnail sizes (the largest is the
// library grid tile, well under 300px even on a wide screen), but a
// cover straight out of an epub or a user's photo library can be several
// MB. That gap is what made the library's metadata balloon — with 187+
// books each carrying a full-res cover, just deserializing them on
// startup could take seconds. This shrinks a cover data URL to a sane
// display size before it's ever stored. Resolves to the original dataUrl
// unchanged if it's already small enough, or if anything about decoding/
// re-encoding it fails (corrupt image, tainted canvas, etc.) — never
// throws, since a slightly-too-large cover is a much better outcome than
// losing the cover entirely.
function downscaleImageDataUrl(dataUrl, maxDim, quality) {
  return new Promise(function(resolve) {
    if (!dataUrl) return resolve(dataUrl);
    var img = new Image();
    img.onload = function() {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return resolve(dataUrl);
      var scale = Math.min(1, maxDim / Math.max(w, h));
      if (scale >= 1) return resolve(dataUrl);
      try {
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale), canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext("2d");
        // Covers are usually opaque, but flatten onto white first in case
        // of a transparent PNG — otherwise re-encoding to JPEG composites
        // transparency onto black instead.
        ctx.fillStyle = "#fff", ctx.fillRect(0, 0, canvas.width, canvas.height), ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality || .85))
      } catch (e) {
        resolve(dataUrl)
      }
    }, img.onerror = function() { resolve(dataUrl) }, img.src = dataUrl
  })
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
