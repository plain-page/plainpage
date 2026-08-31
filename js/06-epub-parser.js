// ---- EPUB parsing: TOC/NCX resolution, chapter/cover extraction, file upload ----

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

// Some EPUB producers (this shows up in a fair number of Z-Library-sourced
// files) prefix every OPF element with an "opf:" namespace prefix
// (<opf:package>, <opf:item>, <opf:itemref>, <opf:meta>, <opf:reference>...)
// instead of leaving OPF as the document's default namespace. When the OPF
// is parsed as XML, getElementsByTagName() matches an element's exact
// qualified name including any prefix — so a plain getElementsByTagName
// ("item") finds nothing in a document where every item is actually named
// "opf:item", silently producing an empty manifest and an empty spine. That
// then surfaces much later, confusingly, as "no readable chapters found in
// this file" once the (empty) spine yields zero chapters.
// getElementsByTagNameNS with a "*" namespace matches by local name alone,
// regardless of prefix or its absence, so it handles both OPF styles.
function opfEls(doc, localName) {
  return doc.getElementsByTagNameNS("*", localName)
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
}), libraryMenuBtn.addEventListener("click", function(e) {
  e.stopPropagation(), libraryMenuDropdown.classList.toggle("is-open"), libraryMenuBtn.setAttribute("aria-expanded", libraryMenuDropdown.classList.contains("is-open")), libraryMenuDropdown.classList.contains("is-open") && updateStorageUsage()
}), librarySortToggle.addEventListener("click", function(e) {
  e.stopPropagation();
  var wasOpen = librarySortToggle.parentElement.classList.contains("is-open");
  closeLibraryMenuSubmenus(), wasOpen || (librarySortToggle.parentElement.classList.add("is-open"), librarySortToggle.setAttribute("aria-expanded", "true"))
}), sortDropdown.addEventListener("click", function(e) {
  var btn = e.target.closest("button[data-sort]");
  btn && (currentSort = btn.getAttribute("data-sort"), setScopeSort(currentSortScopeKey(), currentSort), sortDropdown.querySelectorAll("button").forEach(function(b) {
    b.classList.remove("is-active")
  }), btn.classList.add("is-active"), closeLibraryMenu(), renderLibrary())
}), libraryAddToggle.addEventListener("click", function(e) {
  e.stopPropagation();
  var wasOpen = libraryAddToggle.parentElement.classList.contains("is-open");
  closeLibraryMenuSubmenus(), wasOpen || (libraryAddToggle.parentElement.classList.add("is-open"), libraryAddToggle.setAttribute("aria-expanded", "true"))
}), libraryAddDropdown.addEventListener("click", function(e) {
  var btn = e.target.closest("button[data-add-action]");
  if (btn) {
    var action = btn.getAttribute("data-add-action");
    closeLibraryMenu(), "files" === action ? libraryFileInput.click() : "folder" === action && folderImportInput.click()
  }
}), libraryMenuExportBtn.addEventListener("click", function(e) {
  e.stopPropagation(), closeLibraryMenu(), exportLibrary()
}), libraryMenuImportBtn.addEventListener("click", function(e) {
  e.stopPropagation(), closeLibraryMenu(), libraryImportInput.click()
}), document.addEventListener("click", function(e) {
  libraryMenuDropdown.contains(e.target) || e.target === libraryMenuBtn || closeLibraryMenu()
}), librarySearchInput.addEventListener("input", function() {
  renderLibrary()
}), libraryBackBtn.addEventListener("click", function(e) {
  e.stopPropagation(), exitGroup()
}), libraryLabelText.addEventListener("dblclick", function(e) {
  if (currentGroupFilter) {
    e.stopPropagation();
    var key = currentGroupFilter,
      currentName = groupName(key),
      input = document.createElement("input");
    input.type = "text", input.className = "library-label-input", input.value = currentName, libraryLabelText.replaceWith(input), input.focus(), input.select(), input.addEventListener("blur", function() {
      var newName = input.value.trim() || currentName || "Group",
        names = loadGroupNames();
      names[key] = newName, saveGroupNames(names), input.replaceWith(libraryLabelText), renderLibrary(), currentGroupFilter === key && (document.title = "plainpage · " + newName)
    }), input.addEventListener("keydown", function(ev) {
      "Enter" === ev.key && (ev.preventDefault(), input.blur()), "Escape" === ev.key && (ev.preventDefault(), input.value = currentName, input.blur())
    })
  }
});

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

// Content hash of the raw epub bytes — same file re-downloaded on another
// device (e.g. from a Google Drive backup) hashes to the same id, so
// progress/status synced by id still matches it. Falls back to a random id
// if crypto.subtle is unavailable (e.g. non-HTTPS context).
function hashFileToId(file) {
  return (window.crypto && crypto.subtle ? file.arrayBuffer().then(function(buf) {
    return crypto.subtle.digest("SHA-256", buf)
  }).then(function(hashBuf) {
    return "book-" + Array.prototype.map.call(new Uint8Array(hashBuf), function(b) {
      return b.toString(16).padStart(2, "0")
    }).join("")
  }).catch(function() {
    return null
  }) : Promise.resolve(null)).then(function(id) {
    return id || "book-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
  })
}

// knownId lets callers pass an id that's already been computed (see
// importEpubFiles below), so a duplicate file doesn't get hashed twice.
function parseEpub(file, fileName, knownId) {
  fileName = fileName || (file && file.name) || "Untitled.epub";
  var idPromise = knownId ? Promise.resolve(knownId) : hashFileToId(file);
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
        Array.prototype.forEach.call(opfEls(opfDoc, "item"), function(item) {
          manifest[item.getAttribute("id")] = {
            href: resolveHref(opfDir, item.getAttribute("href")),
            mediaType: item.getAttribute("media-type") || "",
            properties: item.getAttribute("properties") || ""
          }
        });
        var spineIds = Array.prototype.map.call(opfEls(opfDoc, "itemref"), function(ref) {
            return ref.getAttribute("idref")
          }),
          coverHref = null,
          coverItem = Array.prototype.filter.call(opfEls(opfDoc, "item"), function(item) {
            return -1 !== (item.getAttribute("properties") || "").indexOf("cover-image")
          })[0];
        if (coverItem) coverHref = resolveHref(opfDir, coverItem.getAttribute("href"));
        else {
          var coverMeta = Array.prototype.filter.call(opfEls(opfDoc, "meta"), function(m) {
            return "cover" === m.getAttribute("name")
          })[0];
          coverMeta && manifest[coverMeta.getAttribute("content")] && (coverHref = manifest[coverMeta.getAttribute("content")].href)
        }
        var coverHrefPromise = Promise.resolve(coverHref);
        if (!coverHref) {
          var guideRef = Array.prototype.filter.call(opfEls(opfDoc, "reference"), function(r) {
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
          navItem = Array.prototype.filter.call(opfEls(opfDoc, "item"), function(item) {
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
          var ncxItem = Array.prototype.filter.call(opfEls(opfDoc, "item"), function(item) {
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
                id: "page-" + i,
                title: rawTitle.trim(),
                originalTitle: rawTitle.trim(),
                html: s.html
              }
            });
            var hrefToChapterId = {};
            sections.forEach(function(s, i) {
              hrefToChapterId[s.href] = "page-" + i
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
            // Chapter images only ever render inline at reading width, never
            // at a print/production resolution — but epub source images
            // (especially from scanned or professionally-typeset books) can
            // be several MB each at full res, and with up to 60 of them per
            // book that's the single biggest driver of both storage size and
            // backup size for anything illustrated. Downscale rasters
            // (JPEG/PNG/WebP) the same way downscaleImageDataUrl already
            // handles covers; SVG and GIF are left untouched since re-encoding
            // through canvas would flatten vector art and kill GIF animation.
            // 1000px covers any screen these render on at normal reading
            // size; bump this if books commonly get pinch-zoomed to inspect
            // detail.
            var CONTENT_IMAGE_MAX_DIM = 1000, CONTENT_IMAGE_QUALITY = .82;

            function downscaleIfRaster(dataUrl, mime) {
              return "image/jpeg" === mime || "image/png" === mime || "image/webp" === mime ? downscaleImageDataUrl(dataUrl, CONTENT_IMAGE_MAX_DIM, CONTENT_IMAGE_QUALITY) : Promise.resolve(dataUrl)
            }
            var coverPromise = Promise.resolve(null);
            if (coverHref) {
              var coverFile = zipFileLookup(zip, coverHref);
              coverFile && (coverPromise = coverFile.async("base64").then(function(base64) {
                var mime = guessImageMime(coverHref),
                  dataUrl = "data:" + mime + ";base64," + base64;
                return downscaleIfRaster(dataUrl, mime).then(function(finalUrl) {
                  return {
                    dataUrl: finalUrl,
                    caption: "Cover"
                  }
                })
              }).catch(function() {
                return null
              }))
            }
            var otherImagesPromise = Promise.all(otherImageHrefs.map(function(href) {
              var f = zipFileLookup(zip, href);
              return f ? f.async("base64").then(function(base64) {
                var mime = guessImageMime(href),
                  dataUrl = "data:" + mime + ";base64," + base64;
                return downscaleIfRaster(dataUrl, mime).then(function(finalUrl) {
                  return {
                    dataUrl: finalUrl,
                    caption: captionFor(href)
                  }
                })
              }).catch(function() {
                return null
              }) : Promise.resolve(null)
            })).then(function(results) {
              return results.filter(Boolean)
            });
            return Promise.all([coverPromise, otherImagesPromise, idPromise]).then(function(res) {
              var coverEntry = res[0],
                otherImages = res[1],
                bookId = res[2],
                images = coverEntry ? [coverEntry].concat(otherImages) : otherImages,
                // coverEntry.dataUrl above is now the same downscaled image
                // used in `images`; the metadata-facing cover thumbnail is
                // shrunk further still (600px), since that's what getAll()
                // has to deserialize on every startup. No separate
                // originalCover backup is kept — see renderBookInfoCover in
                // 07-book-info.js for why.
                coverThumbPromise = coverEntry ? downscaleImageDataUrl(coverEntry.dataUrl, 600, .85) : Promise.resolve(null);
              return coverThumbPromise.then(function(coverThumb) {
                return {
                  id: bookId,
                  title: title,
                  author: author,
                  published: published,
                  description: description,
                  cover: coverThumb,
                  images: images,
                  chapters: chapters,
                  toc: resolvedToc,
                  addedAt: Date.now(),
                  status: "unread",
                  lastOpened: 0
                }
              })
            })
          })
        })
      })
    })
  })
}
// Importing a folder re-sends every file in it, including ones already in
// the library. A file's id is a content hash (see hashFileToId), and just
// hashing a file is cheap — it's the full parseEpub() below (unzip, walk
// every chapter, base64-encode every image) that's expensive. So the id is
// computed for every file up front, checked against the library, and only
// files that are actually new go through the expensive parse. For 185
// already-added books plus 2 new ones, this means 187 cheap hashes and only
// 2 full parses, instead of 187 full parses.
function importEpubFiles(files) {
  if (!files.length) return;
  if ("undefined" == typeof JSZip) return void showToast("EPUB support failed to load — check your connection and try again.");
  var epubFiles = files.filter(function(f) {
    return /\.epub$/i.test(f.name)
  });
  if (!epubFiles.length) return void showToast("No .epub files found there.");
  var existingIds = {};
  loadLibraryList().forEach(function(b) {
    existingIds[b.id] = !0
  });
  var added = 0,
    skipped = 0,
    failed = 0;
  epubFiles.length > 1 && showToast("Checking " + epubFiles.length + " files…");
  Promise.all(epubFiles.map(function(file) {
    return hashFileToId(file).then(function(id) {
      return { file: file, id: id }
    })
  })).then(function(hashed) {
    var toParse = hashed.filter(function(h) {
      var isNew = !existingIds[h.id];
      return isNew || (skipped++, !1)
    });
    return toParse.reduce(function(chain, entry, i) {
      return chain.then(function() {
        return showToast("Parsing " + entry.file.name + "…" + (toParse.length > 1 ? " (" + (i + 1) + "/" + toParse.length + ")" : "")), parseEpub(entry.file, entry.file.name, entry.id).then(function(book) {
          if (existingIds[book.id]) return void skipped++;
          existingIds[book.id] = !0;
          var list = loadLibraryList();
          // idbPutBook() below writes the full book (content included) to
          // storage; the in-memory cache only needs the metadata half, so a
          // folder import of many books doesn't leave all their content
          // sitting in memory for the rest of the session.
          list.push(stripContentFields(book)), libraryCache = list;
          return idbPutBook(book).then(function() {
            added++
          }).catch(function(err) {
            console.error("Failed to save book to library", err), failed++, libraryCache = libraryCache.filter(function(b) { return b.id !== book.id }), showToast('Parsed "' + book.title + '", but it couldn’t be saved.')
          })
        }).catch(function(err) {
          console.error("Failed to parse " + entry.file.name, err), failed++, showToast("Could not parse " + entry.file.name + " — " + (err && err.message ? err.message : "unknown error") + ".")
        })
      })
    }, Promise.resolve())
  }).then(function() {
    document.body.classList.contains("library-open") && renderLibrary();
    var parts = [];
    added && parts.push(added + (1 === added ? " book" : " books") + " added");
    skipped && parts.push(skipped + " already in your library");
    failed && parts.push(failed + " failed");
    parts.length && showToast(parts.join(", ") + ".")
  })
}
libraryFileInput.addEventListener("change", function() {
  var files = Array.prototype.slice.call(this.files);
  this.value = "", importEpubFiles(files)
});
folderImportInput && folderImportInput.addEventListener("change", function() {
  var files = Array.prototype.slice.call(this.files);
  this.value = "", importEpubFiles(files)
});

