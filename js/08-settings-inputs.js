// ---- Reading settings inputs: size, spacing, indent, margin, WPM, custom fonts/themes, background ----

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
