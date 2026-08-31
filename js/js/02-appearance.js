// ---- Reading appearance: color themes and fonts (apply + render pickers) ----

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
