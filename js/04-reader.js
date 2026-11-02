var currentBook=null;document.addEventListener("keydown",function(e){if(e.ctrlKey||e.metaKey||e.altKey)return;if(document.body.classList.contains("library-open"))return;var activeEl=document.activeElement,activeTag=activeEl&&activeEl.tagName?activeEl.tagName.toLowerCase():"";if("input"===activeTag||"textarea"===activeTag||activeEl&&activeEl.isContentEditable)return;if(!currentBook||!currentBook.chapters||!currentBook.chapters.length)return;if(!e.shiftKey&&("w"===e.key||"W"===e.key||"s"===e.key||"S"===e.key))return e.preventDefault(),void window.scrollTo(0,"w"===e.key.toLowerCase()?0:document.documentElement.scrollHeight);if("ArrowLeft"!==e.key&&"ArrowRight"!==e.key)return;var idx=currentBook.chapters.findIndex(function(c){return c.id===state.currentChapter});if(-1===idx)return;var targetIdx=idx+("ArrowRight"===e.key?1:-1);targetIdx>=0&&targetIdx<currentBook.chapters.length&&(e.preventDefault(),showChapter(currentBook.chapters[targetIdx].id))});function progressKey(chapterId){return(currentBook?currentBook.id:"")+"::"+chapterId}var chapterSwitching=!1,chapterSwitchTimer=null;function beginChapterSwitch(){chapterSwitching=!0,clearTimeout(chapterSwitchTimer),chapterSwitchTimer=setTimeout(function(){chapterSwitching=!1},1500)}function endChapterSwitch(){chapterSwitching=!1,clearTimeout(chapterSwitchTimer)}function getSavedChapterScroll(id){var map=currentBook&&currentBook.chapterScroll;if(map&&"number"==typeof map[id])return map[id];var legacy=state.progress[progressKey(id)]||0;return legacy<.995?legacy:0}function saveLeavingChapterScroll(nextId){if(currentBook&&state.currentChapter&&state.currentChapter!==nextId){var page=document.getElementById("page-"+state.currentChapter);if(page&&page.offsetParent){var body=page.querySelector(".chapter-body");if(body){var scrollable=body.scrollHeight-window.innerHeight,f=scrollable>0?Math.min(1,Math.max(0,-body.getBoundingClientRect().top/scrollable)):1;f>.995&&(f=1),currentBook.chapterScroll=currentBook.chapterScroll||{},currentBook.chapterScroll[state.currentChapter]=f}}}}var chapterPages=$$(".chapter-page"),sidebarItems=$$(".sidebar-item[data-target]");function showChapter(id,restoreScroll){var pages=$$(".chapter-page");saveLeavingChapterScroll(id);if(currentBook&&currentBook.chapters&&state.currentChapter&&state.currentChapter!==id){var fromIdx=currentBook.chapters.findIndex(function(c){return c.id===state.currentChapter}),toIdx=currentBook.chapters.findIndex(function(c){return c.id===id});fromIdx>-1&&toIdx===fromIdx+1&&(state.progress[progressKey(state.currentChapter)]=1)}if(!Array.prototype.some.call(pages,function(page){return page.getAttribute("data-chapter-id")===id})&&pages.length&&(id=pages[0].getAttribute("data-chapter-id")),state.currentChapter=id,beginChapterSwitch(),void 0===restoreScroll&&(restoreScroll=getSavedChapterScroll(id)>0),document.body.classList.contains("library-open")||updateReaderDocumentTitle(),chapterPages.forEach(function(page){page.hidden=page.getAttribute("data-chapter-id")!==id}),function(t){sidebarItems.forEach(function(item){item.classList.toggle("is-current",item.getAttribute("data-target")===t)})}(sidebarTargetFor(id)),restoreScroll?setTimeout(function(){restoreChapterScroll(id)},100):(window.scrollTo(0,0),endChapterSwitch(),updateChapterMeta(),updateReadingProgress(),updateSidebarMeta()),saveState(),currentBook){currentBook.lastChapter=id;var idx=libraryCache.findIndex(function(b){return b.id===currentBook.id});-1!==idx?libraryCache[idx]=currentBook:libraryCache.push(currentBook),idbPutBook(currentBook).catch(function(err){console.error("Failed to persist current chapter",err)})}syncUrlHash()}function syncUrlHash(){var params=new URLSearchParams(location.search);document.body.classList.contains("library-open")||!currentBook?(params.delete("book"),params.delete("chapter")):(params.set("book",currentBook.id),params.set("chapter",state.currentChapter));var qs=params.toString(),url=location.pathname+(qs?"?"+qs:"")+location.hash;url!==location.pathname+location.search+location.hash&&history.replaceState(null,"",url)}function parseHashRoute(){var params=new URLSearchParams(location.search),bookId=params.get("book"),chapterId=params.get("chapter");if(!bookId)return null;var book=findBook(bookId);return book?{book:book,chapter:chapterId||null}:null}function goToChapterAnchor(chapterId,anchorId){showChapter(chapterId,!1),closeSidebar(),anchorId&&requestAnimationFrame(function(){var page=document.getElementById("page-"+chapterId);if(page){var targetEl=null;try{targetEl=page.querySelector("#"+CSS.escape(anchorId))||page.querySelector('[name="'+CSS.escape(anchorId)+'"]')}catch(e){}targetEl&&targetEl.scrollIntoView({block:"start"})}})}function goToTocEntry(chapterId,anchorId){if(chapterId!==state.currentChapter&&getSavedChapterScroll(chapterId)>0){var page=document.getElementById("page-"+chapterId),body=page&&page.querySelector(".chapter-body"),el=findAnchorTarget(chapterId,anchorId),atStart=!el;if(body&&el)try{var range=document.createRange();range.setStart(body,0),range.setEndBefore(el),atStart=!range.toString().trim()}catch(e){}if(atStart)return showChapter(chapterId),void closeSidebar()}goToChapterAnchor(chapterId,anchorId)}function findAnchorTarget(chapterId,anchorId){var page=document.getElementById("page-"+chapterId);if(!page||!anchorId)return null;try{return page.querySelector("#"+CSS.escape(anchorId))||page.querySelector('[name="'+CSS.escape(anchorId)+'"]')}catch(e){return null}}function isFootnoteTarget(el){if(!el)return!1;if(el.tagName&&"aside"===el.tagName.toLowerCase())return!0;var node=el,depth=0;while(node&&node.nodeType===1&&depth<4){var et=(node.getAttribute&&node.getAttribute("epub:type")||"").toLowerCase();if(/note/.test(et))return!0;var role=(node.getAttribute&&node.getAttribute("role")||"").toLowerCase();if(/doc-(foot|end|rear)note/.test(role))return!0;var cls=(node.className&&node.className.toString&&node.className.toString()||"").toLowerCase();if(/footnote|endnote|rearnote|\bnote\b/.test(cls))return!0;var idAttr=(node.id||"").toLowerCase();if(/^(fn|footnote|endnote|note)[-_]?\d/.test(idAttr))return!0;node=node.parentElement,depth++}if(el.querySelectorAll)for(var links=el.querySelectorAll("a"),i=0;i<links.length;i++){var linkEt=(links[i].getAttribute("epub:type")||"").toLowerCase();if(-1!==linkEt.indexOf("backlink"))return!0;var linkCls=(links[i].className||"").toString().toLowerCase();if(/backlink/.test(linkCls))return!0}return!1}function collectFootnoteContent(chapterId,anchorId){var markerEl=findAnchorTarget(chapterId,anchorId);if(!markerEl)return null;var container=document.createElement("div");if(markerEl.textContent&&markerEl.textContent.trim().length>3)return container.innerHTML=markerEl.innerHTML,container;if(/^(sup|a|span|b|i|em|strong|small)$/i.test(markerEl.tagName)){var label=markerEl.cloneNode(!0);label.removeAttribute("id"),container.appendChild(label)}for(var node=markerEl.nextSibling,guard=0,collected=0;node&&guard<24&&collected<=1200;node=node.nextSibling,guard++){if(3===node.nodeType){var raw=node.textContent||"";(raw.trim()||collected)&&(container.appendChild(node.cloneNode(!0)),collected+=raw.trim().length);continue}if(1===node.nodeType){var tag=node.tagName.toLowerCase(),text=(node.textContent||"").trim();if("a"===tag&&!text&&node.hasAttribute("id"))break;if(/^h[1-6]$/.test(tag))break;if(collected&&node.hasAttribute("id")&&("sup"===tag||"a"===tag&&text.length<=3))break;text.length<=3&&node.querySelector&&node.querySelector("a")||(container.appendChild(node.cloneNode(!0)),collected+=text.length)}}return collected?container:null}function isFootnoteLink(a,targetChapterId,anchorId){var et=(a.getAttribute("epub:type")||"").toLowerCase();if(-1!==et.indexOf("noteref"))return!0;if(a.querySelector&&a.querySelector("sup"))return!0;if("1"===a.getAttribute("data-maybe-note"))return!0;if(!anchorId)return!1;return isFootnoteTarget(findAnchorTarget(targetChapterId,anchorId))}function closeFootnotePopup(){var existing=document.querySelector(".footnote-popup-overlay");existing&&existing.remove(),document.removeEventListener("keydown",footnotePopupKeyHandler)}function footnotePopupKeyHandler(e){"Escape"===e.key&&closeFootnotePopup()}function showFootnotePopup(anchorEl,targetEl){closeFootnotePopup();var overlay=document.createElement("div");overlay.className="footnote-popup-overlay",overlay.addEventListener("click",function(e){e.target===overlay&&closeFootnotePopup()});var popup=document.createElement("div");popup.className="footnote-popup",popup.setAttribute("role","dialog"),popup.setAttribute("aria-label","footnote");var closeBtn=document.createElement("button");closeBtn.className="footnote-popup-close",closeBtn.setAttribute("aria-label","close"),closeBtn.textContent="×",closeBtn.addEventListener("click",closeFootnotePopup);var body=document.createElement("div");body.className="footnote-popup-body",body.innerHTML=targetEl.innerHTML,Array.prototype.forEach.call(body.querySelectorAll("a"),function(link){var et=(link.getAttribute("epub:type")||"").toLowerCase();var t=(link.textContent||"").trim();-1!==et.indexOf("backlink")||t.length<=30&&/^(return|go back|back)\b/i.test(t)||/^[\u21a9\u21a5\u2191\u21ba^]+\ufe0e?$/.test(t)?link.remove():link.addEventListener("click",function(e){e.preventDefault()})});for(;body.lastChild&&("BR"===body.lastChild.nodeName||3===body.lastChild.nodeType&&!body.lastChild.textContent.trim());)body.removeChild(body.lastChild);popup.appendChild(closeBtn),popup.appendChild(body),overlay.appendChild(popup),document.body.appendChild(overlay),document.addEventListener("keydown",footnotePopupKeyHandler),requestAnimationFrame(function(){if(window.innerWidth>640){var rect=anchorEl.getBoundingClientRect(),popupRect=popup.getBoundingClientRect(),top=rect.bottom+8,left=rect.left,maxLeft=window.innerWidth-popupRect.width-16,maxTop=window.innerHeight-popupRect.height-16;left=Math.max(16,Math.min(left,maxLeft)),top=Math.max(16,Math.min(top,maxTop)),popup.style.top=top+"px",popup.style.left=left+"px"}})}function restoreChapterScroll(id){var page=document.getElementById("page-"+id),body=page?page.querySelector(".chapter-body"):null,fraction=getSavedChapterScroll(id);if(!body||fraction<=0)return endChapterSwitch(),updateChapterMeta(),updateReadingProgress(),void updateSidebarMeta();requestAnimationFrame(function(){var viewportHeight=window.innerHeight,scrollable=body.scrollHeight-viewportHeight;if(scrollable>0){var bodyTop=body.getBoundingClientRect().top+window.scrollY;window.scrollTo(0,bodyTop+fraction*scrollable)}requestAnimationFrame(function(){endChapterSwitch(),updateChapterMeta(),updateReadingProgress(),updateSidebarMeta()})})}var chapterWordCache={};function chapterWordWeight(ch){var key=(currentBook?currentBook.id:"")+"::"+ch.getAttribute("data-chapter-id");if(void 0===chapterWordCache[key]){var body=ch.querySelector(".chapter-body");chapterWordCache[key]=Math.max(1,body?body.textContent.trim().split(/\s+/).filter(Boolean).length:1)}return chapterWordCache[key]}function computeBookProgress(){var chapters=$$(".chapter-page");if(!chapters.length)return 0;if(currentBook&&"complete"===currentBook.status)return 1;var vals=[],lastDone=-1;chapters.forEach(function(ch,i){var v=state.progress[progressKey(ch.getAttribute("data-chapter-id"))]||0;vals.push(v),v>=1&&(lastDone=i)});var sum=0,total=0;chapters.forEach(function(ch,i){var w=chapterWordWeight(ch);total+=w,sum+=w*(i<lastDone?1:vals[i])});var p=total>0?sum/total:0;return p>=.995?1:p}var progressHintText="",scrollSuppressUntil=0;function suppressScrollCount(ms){scrollSuppressUntil=Date.now()+ms}function checkSearchOrigin(){searchOrigin&&searchOrigin.chapter===state.currentChapter&&Date.now()>=scrollSuppressUntil&&Math.abs(window.scrollY-searchOrigin.y)<.5*window.innerHeight&&hideSearchBack()}var searchOrigin=null,searchBackBtn=$("#searchBackBtn");function rememberSearchOrigin(){searchOrigin||!currentBook||(searchOrigin={book:currentBook.id,chapter:state.currentChapter,y:window.scrollY},searchBackBtn&&searchBackBtn.classList.add("is-visible"))}function hideSearchBack(){searchOrigin=null,searchBackBtn&&searchBackBtn.classList.remove("is-visible")}function returnToSearchOrigin(){var o=searchOrigin;hideSearchBack(),o&&currentBook&&currentBook.id===o.book&&(suppressScrollCount(2500),o.chapter===state.currentChapter?window.scrollTo({top:o.y,behavior:"instant"}):(showChapter(o.chapter,!0),setTimeout(function(){window.scrollTo({top:o.y,behavior:"instant"})},300)))}searchBackBtn&&searchBackBtn.addEventListener("click",returnToSearchOrigin),new MutationObserver(function(){document.body.classList.contains("library-open")&&hideSearchBack()}).observe(document.body,{attributes:!0,attributeFilter:["class"]});function updateReadingProgress(){if(chapterSwitching)return;var page=document.getElementById("page-"+state.currentChapter);if(page&&page.offsetParent){var body=page.querySelector(".chapter-body");if(body){var bodyRect=body.getBoundingClientRect(),viewportHeight=window.innerHeight,scrollable=body.scrollHeight-viewportHeight,fraction=scrollable>0?Math.min(1,Math.max(0,-bodyRect.top/scrollable)):1;fraction>.995&&(fraction=1);var key=progressKey(state.currentChapter);checkSearchOrigin();state.progress[key]=fraction,currentBook&&(currentBook.chapterScroll=currentBook.chapterScroll||{},currentBook.chapterScroll[state.currentChapter]=fraction),currentBook&&saveState();var hintEl=$("#shortcutsHint");if(hintEl){var hintWords=body.innerText.trim().split(/\s+/).filter(Boolean).length,hintRemaining=Math.max(0,Math.round(hintWords*(1-fraction))),hintMinsLeft=Math.max(1,Math.round(hintRemaining/state.wpm));progressHintText=Math.round(100*fraction)+"% done reading · "+hintMinsLeft+(1===hintMinsLeft?" min":" mins")+" left";hintEl.textContent=progressHintText}var totalProgress=computeBookProgress();var progressEl=$("#bookProgress");progressEl&&(progressEl.textContent=Math.round(100*totalProgress)+"% complete"),currentBook&&(currentBook.progress=totalProgress,persistCurrentBook()),updateSidebarMeta()}}}function updateChapterMeta(){var page=document.getElementById("page-"+state.currentChapter);if(page){var body=page.querySelector(".chapter-body"),metaEl=page.querySelector(".chapter-meta");if(body&&metaEl){var words=body.innerText.trim().split(/\s+/).filter(Boolean).length,key=progressKey(state.currentChapter),fraction=state.progress[key]||0,remaining=Math.max(0,Math.round(words*(1-fraction))),minsLeft=Math.max(1,Math.round(remaining/state.wpm));metaEl.textContent=words.toLocaleString()+" words · "+minsLeft+(1===minsLeft?" min":" mins")+" left"}}}var sidebarWordCache={};function sidebarChapterWords(ch){var key=(currentBook?currentBook.id:"")+"::"+ch.getAttribute("data-chapter-id");if(void 0===sidebarWordCache[key]){var b=ch.querySelector(".chapter-body");sidebarWordCache[key]=b?b.innerText.trim().split(/\s+/).filter(Boolean).length:0}return sidebarWordCache[key]}function updateSidebarMeta(){var pages=$$(".chapter-page"),metas=[],i,j;for(i=0;i<pages.length;i++)metas.push(document.getElementById("meta-"+pages[i].getAttribute("data-chapter-id")+"-sidebar"));for(i=0;i<pages.length;i++)if(metas[i]){var total=sidebarChapterWords(pages[i]);for(j=i+1;j<pages.length&&!metas[j];j++)total+=sidebarChapterWords(pages[j]);metas[i].textContent=total.toLocaleString()+" words"}}function sidebarTargetFor(id){var pages=$$(".chapter-page"),idx=-1;pages.forEach(function(p,i){p.getAttribute("data-chapter-id")===id&&(idx=i)});for(;idx>=0;idx--){var cid=pages[idx].getAttribute("data-chapter-id");if(document.getElementById("meta-"+cid+"-sidebar"))return cid}return id}function persistCurrentBook(){currentBook&&persistBookDebounced(currentBook)}function renderChapterPageHtml(book,chapter,index,total){var navHtml='<nav class="chapter-nav">'+(index>0?'<button type="button" class="chapter-nav-btn" data-goto="'+book.chapters[index-1].id+'">← previous chapter</button>':'<span class="chapter-nav-spacer"></span>')+(index<total-1?'<button type="button" class="chapter-nav-btn" data-goto="'+book.chapters[index+1].id+'">next chapter →</button>':'<span class="chapter-nav-spacer"></span>')+"</nav>",isFirst=0===index,isLast=index===total-1,endHtml=isLast?'<div class="book-end"><div class="book-end-mark"></div><p class="book-end-text">End of book</p></div>':"";return'<section class="chapter-page" id="page-'+chapter.id+'" data-chapter-id="'+chapter.id+'"'+(isFirst?"":" hidden")+'><header class="chapter-head chapter-head--no-divider"><div class="chapter-byline"><span class="cb-title">'+escapeHtml(book.title)+'</span><span class="cb-by">'+escapeHtml(book.author)+"</span></div>"+'<p class="chapter-meta" id="meta-'+chapter.id+'">&nbsp;</p></header><div class="chapter-body">'+chapter.html+"</div>"+navHtml+endHtml+"</section>"}function renderTocNodeHtml(node,book,depth,seenChapterIds){var itemHtml,hasChildren=node.subitems&&node.subitems.length>0,chapter=node.chapterId?book.chapters.filter(function(c){return c.id===node.chapterId})[0]:null,label=chapter&&chapter.title&&chapter.title!==chapter.originalTitle?chapter.title:node.label&&!isSyntheticTocNode(node)?node.label:chapter&&chapter.title||node.label||"untitled",metaId="";return node.chapterId&&!seenChapterIds[node.chapterId]&&(seenChapterIds[node.chapterId]=!0,metaId=' id="meta-'+node.chapterId+'-sidebar"'),itemHtml=node.chapterId?'<button class="sidebar-item toc-item" data-target="'+node.chapterId+'"'+(node.anchor?' data-anchor="'+escapeHtml(node.anchor)+'"':"")+'><span class="sidebar-item-title">'+escapeHtml(label)+'</span><span class="sidebar-item-meta"'+metaId+"></span></button>":'<span class="sidebar-item toc-item toc-item--unlinked"><span class="sidebar-item-title">'+escapeHtml(label)+"</span></span>",'<li class="toc-node" style="--toc-depth:'+depth+'"><div class="toc-row">'+(hasChildren?'<button class="toc-toggle" aria-expanded="true" aria-label="toggle section"></button>':'<span class="toc-toggle-spacer"></span>')+itemHtml+"</div>"+(hasChildren?'<ul class="toc-children">'+node.subitems.map(function(child){return renderTocNodeHtml(child,book,depth+1,seenChapterIds)}).join("")+"</ul>":"")+"</li>"}function isSyntheticTocNode(n){return n.chapterId&&n.label===n.chapterId}function collectRealToc(nodes,set){nodes.forEach(function(n){!isSyntheticTocNode(n)&&n.chapterId&&(set[n.chapterId]=!0),collectRealToc(n.subitems||[],set)})}function pruneToc(nodes,real,book){return nodes.filter(function(n){if(!isSyntheticTocNode(n))return!0;if(real[n.chapterId])return!1;var ch=book.chapters.filter(function(c){return c.id===n.chapterId})[0];return!(ch&&/^page-\d+$/.test((ch.title||"").trim()))}).map(function(n){return Object.assign({},n,{subitems:pruneToc(n.subitems||[],real,book)})})}function renderSidebarHtml(book){if(book.toc&&book.toc.length){var seenChapterIds={},real={};collectRealToc(book.toc,real);return pruneToc(book.toc,real,book).map(function(node){return renderTocNodeHtml(node,book,0,seenChapterIds)}).join("")}return book.chapters.map(function(ch,i){return'<li><button class="sidebar-item" data-target="'+ch.id+'"><span class="sidebar-item-title">'+escapeHtml(ch.title||"section "+(i+1))+'</span><span class="sidebar-item-meta" id="meta-'+ch.id+'-sidebar"></span></button></li>'}).join("")}function rerenderChapters(book,keepPosition,targetChapterId){if(document.querySelector(".page main").innerHTML=book.chapters.map(function(ch,i){return renderChapterPageHtml(book,ch,i,book.chapters.length)}).join(""),chapterList.innerHTML=renderSidebarHtml(book),chapterPages=$$(".chapter-page"),(sidebarItems=$$(".sidebar-item[data-target]")).forEach(function(item){var chapterId=item.getAttribute("data-target"),anchorId=item.getAttribute("data-anchor"),titleEl=item.querySelector(".sidebar-item-title");item.addEventListener("click",function(e){if(!item.classList.contains("is-renaming")){if(e.target.closest(".sidebar-item-title"))return chapterRenameClickTimer?(clearTimeout(chapterRenameClickTimer),void(chapterRenameClickTimer=null)):void(chapterRenameClickTimer=setTimeout(function(){chapterRenameClickTimer=null,anchorId?goToTocEntry(chapterId,anchorId):(showChapter(chapterId),closeSidebar())},280));anchorId?goToTocEntry(chapterId,anchorId):(showChapter(chapterId),closeSidebar())}}),titleEl&&bindChapterTitleDblClick(item,titleEl,chapterId)}),$$(".toc-toggle").forEach(function(toggle){toggle.addEventListener("click",function(e){e.stopPropagation();var node=toggle.closest(".toc-node"),expanded="true"===toggle.getAttribute("aria-expanded");toggle.setAttribute("aria-expanded",expanded?"false":"true"),node.classList.toggle("is-collapsed",expanded)})}),$$("[data-toc-link]").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();var targetId=a.getAttribute("data-goto-chapter"),anchorId=a.getAttribute("data-goto-anchor");if(targetId)if(isFootnoteLink(a,targetId,anchorId)){var noteContent=anchorId?collectFootnoteContent(targetId,anchorId):null;noteContent?showFootnotePopup(a,noteContent):goToChapterAnchor(targetId,anchorId)}else goToChapterAnchor(targetId,anchorId)})}),keepPosition)book.chapters.some(function(c){return c.id===state.currentChapter})||(state.currentChapter=book.chapters[0].id);else{var targetValid=targetChapterId&&book.chapters.some(function(c){return c.id===targetChapterId}),lastValid=book.lastChapter&&book.chapters.some(function(c){return c.id===book.lastChapter});state.currentChapter=targetValid?targetChapterId:lastValid?book.lastChapter:book.chapters[0].id}showChapter(state.currentChapter,!0),buildChapterData(),saveState(),applyTitleFont(),applyAuthorFont()}window.addEventListener("popstate",function(){var route=parseHashRoute();route?(document.body.classList.contains("library-open")&&closeLibrary(),currentBook&&currentBook.id===route.book.id?showChapter(route.chapter,!0):(state.currentChapter=route.chapter,loadBook(route.book,route.chapter))):document.body.classList.contains("library-open")||openLibrary()});var chapterData=[],currentFlash=null,flashTimeout=null;function buildChapterData(){chapterData=[],$$(".chapter-page").forEach(function(page){var id=page.getAttribute("data-chapter-id"),chapterObj=currentBook&&currentBook.chapters?currentBook.chapters.filter(function(c){return c.id===id})[0]:null,title=chapterObj&&chapterObj.title?chapterObj.title:id,body=page.querySelector(".chapter-body");body&&chapterData.push({id:id,title:title,text:body.textContent,element:body})})}function performSearch(query){if(!query||query.length<2)return searchCount.textContent="0 results",void(searchResults.innerHTML='<div class="search-empty">type at least 2 characters to search</div>');var regex=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),results=[];if(chapterData.forEach(function(chapter){for(var match,text=chapter.text,found=!1,matches=[],tempRegex=new RegExp(regex.source,"gi");null!==(match=tempRegex.exec(text));){var start=Math.max(0,match.index-60),end=Math.min(text.length,match.index+match[0].length+60),highlightedSnippet=text.substring(start,end).replace(regex,function(m){return"<em>"+m+"</em>"});start>0&&(highlightedSnippet="…"+highlightedSnippet),end<text.length&&(highlightedSnippet+="…"),matches.push({snippet:highlightedSnippet,matchText:match[0],index:match.index}),found=!0}found&&results.push({chapterId:chapter.id,chapterTitle:chapter.title,matches:matches})}),0===results.length)return searchCount.textContent="0 results",void(searchResults.innerHTML='<div class="search-empty">no results found for "'+escapeHtml(query)+'"</div>');var totalMatches=0;results.forEach(function(r){totalMatches+=r.matches.length}),searchCount.textContent=totalMatches+" result"+(totalMatches>1?"s":"");var html="";results.forEach(function(result){result.matches.forEach(function(match){html+='<div class="search-result-item" data-chapter="'+result.chapterId+'" data-query="'+escapeHtml(query)+'" data-index="'+match.index+'">',html+='<div class="search-result-chapter">'+(result.chapterTitle||"untitled section")+"</div>",html+='<div class="search-result-snippet">'+match.snippet+"</div>",html+="</div>"})}),searchResults.innerHTML=html,searchResults.querySelectorAll(".search-result-item").forEach(function(item){item.addEventListener("click",function(){var chapterId=this.getAttribute("data-chapter"),query=this.getAttribute("data-query")||searchInput.value,matchIndex=parseInt(this.getAttribute("data-index"),10);rememberSearchOrigin(),suppressScrollCount(2500),closeSearch(),showChapter(chapterId,!1),setTimeout(function(){var bodyEl=document.querySelector("#page-"+chapterId+" .chapter-body");bodyEl&&highlightAndScrollToMatch(query,bodyEl,matchIndex)},350)})})}function highlightAndScrollToMatch(query,container,offset){if(currentFlash){try{var parent=currentFlash.parentNode;if(parent){var textNode=document.createTextNode(currentFlash.textContent);parent.replaceChild(textNode,currentFlash),parent.normalize()}}catch(e){}currentFlash=null}if(flashTimeout&&(clearTimeout(flashTimeout),flashTimeout=null),query&&!(query.length<2))for(var node,pos=0,regex=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"),walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,null,!1);node=walker.nextNode();){var text=node.textContent,match;if(isNaN(offset))match=regex.exec(text);else{if(pos+text.length<=offset){pos+=text.length;continue}var local=offset-pos;match={index:local,0:text.substr(local,query.length)}}if(match){var span=document.createElement("span");span.className="flash-highlight",span.textContent=match[0];var before=text.substring(0,match.index),after=text.substring(match.index+match[0].length),fragment=document.createDocumentFragment();before&&fragment.appendChild(document.createTextNode(before)),fragment.appendChild(span),after&&fragment.appendChild(document.createTextNode(after)),node.parentNode.replaceChild(fragment,node),currentFlash=span,span.scrollIntoView({block:"center",behavior:"smooth"}),flashTimeout=setTimeout(function(){if(span&&span.parentNode){var parent=span.parentNode,textNode=document.createTextNode(span.textContent);parent.replaceChild(textNode,span),parent.normalize(),currentFlash=null}flashTimeout=null},2200);break}}}var searchPanel=$("#searchPanel"),searchOverlay=$("#searchOverlay"),searchInput=$("#searchInput"),searchCount=$("#searchCount"),searchResults=$("#searchResults"),searchClose=$("#searchClose"),searchToggle=$("#searchToggle"),pendingSearchSel="";function takeSearchSelection(){var s=pendingSearchSel||(window.getSelection?String(window.getSelection()):"");return pendingSearchSel="",(s=s.replace(/\s+/g," ").trim()).length>=2&&s.length<=200?s:""}function openSearch(){var picked=takeSearchSelection();closeSettings(),closeSidebar(),searchPanel.classList.add("is-open"),searchOverlay.classList.add("is-open"),searchToggle.classList.add("is-active"),buildChapterData(),picked&&(searchInput.value=picked,performSearch(picked)),setTimeout(function(){searchInput.focus()},100)}function closeSearch(){if(searchInput.blur(),searchPanel.classList.remove("is-open"),searchOverlay.classList.remove("is-open"),searchToggle.classList.remove("is-active"),searchInput.value="",searchCount.textContent="0 results",searchResults.innerHTML='<div class="search-empty">type at least 2 characters to search</div>',currentFlash){try{var parent=currentFlash.parentNode;if(parent){var textNode=document.createTextNode(currentFlash.textContent);parent.replaceChild(textNode,currentFlash),parent.normalize()}}catch(e){}currentFlash=null}flashTimeout&&(clearTimeout(flashTimeout),flashTimeout=null)}searchToggle.addEventListener("click",function(e){e.stopPropagation(),searchPanel.classList.contains("is-open")?closeSearch():openSearch()}),["mousedown","touchstart"].forEach(function(ev){searchToggle.addEventListener(ev,function(){pendingSearchSel=window.getSelection?String(window.getSelection()):"",setTimeout(function(){pendingSearchSel=""},1500)},{passive:!0})}),searchClose.addEventListener("click",closeSearch),searchOverlay.addEventListener("click",closeSearch),searchInput.addEventListener("input",function(){performSearch(this.value)}),searchInput.addEventListener("keydown",function(e){"Escape"===e.key&&closeSearch()}),document.addEventListener("keydown",function(e){(e.ctrlKey||e.metaKey)&&"f"===e.key&&(e.preventDefault(),searchPanel.classList.contains("is-open")?(searchInput.focus(),searchInput.select()):openSearch()),"Escape"===e.key&&searchPanel.classList.contains("is-open")&&closeSearch()});var sidebar=$("#sidebar"),sidebarBackdrop=$("#sidebarBackdrop"),sidebarToggle=$("#sidebarToggle"),chapterList=$("#chapterList");function openSidebar(){closeSettings(),closeSearch(),sidebar.classList.add("is-open"),sidebarBackdrop.classList.add("is-open")}function closeSidebar(){sidebar.classList.remove("is-open"),settingsPanel.classList.contains("is-open")||sidebarBackdrop.classList.remove("is-open")}sidebarToggle.addEventListener("click",function(e){e.stopPropagation(),sidebar.classList.contains("is-open")?closeSidebar():openSidebar()}),sidebarItems.forEach(function(item){item.addEventListener("click",function(){showChapter(item.getAttribute("data-target")),closeSidebar()})});function renameChapter(ch,newTitle){ch.title=newTitle,currentBook&&state.currentChapter===ch.id&&!document.body.classList.contains("library-open")&&updateReaderDocumentTitle(),persistCurrentBook()}var chapterRenameClickTimer=null;function bindChapterTitleDblClick(item,titleEl,chapterId){titleEl.addEventListener("dblclick",function(e){e.preventDefault(),e.stopPropagation(),chapterRenameClickTimer&&(clearTimeout(chapterRenameClickTimer),chapterRenameClickTimer=null),startChapterRename(item,titleEl,chapterId)})}function startChapterRename(item,titleEl,chapterId){if(currentBook&&!item.classList.contains("is-renaming")){var chIndex=currentBook.chapters.findIndex(function(c){return c.id===chapterId});if(-1!==chIndex){var ch=currentBook.chapters[chIndex];void 0===ch.originalTitle&&(ch.originalTitle=ch.title),item.classList.add("is-renaming");var input=document.createElement("input");input.type="text",input.className="sidebar-item-title-input",input.value=ch.title,titleEl.replaceWith(input),input.focus(),input.select(),input.addEventListener("keydown",onKeydown),input.addEventListener("blur",onBlur)}}function finish(commit){input.removeEventListener("keydown",onKeydown),input.removeEventListener("blur",onBlur);var finalValue=commit?input.value.trim()||ch.originalTitle||"":ch.title;finalValue!==ch.title&&renameChapter(ch,finalValue);var displayTitle=ch.title||"section "+(chIndex+1),newTitleEl=document.createElement("span");newTitleEl.className="sidebar-item-title",newTitleEl.textContent=displayTitle,input.replaceWith(newTitleEl),item.classList.remove("is-renaming"),bindChapterTitleDblClick(item,newTitleEl,chapterId)}function onKeydown(e){"Enter"===e.key?(e.preventDefault(),finish(!0)):"Escape"===e.key&&(e.preventDefault(),finish(!1))}function onBlur(){finish(!0)}}(function(){function u(){var y=window.pageYOffset||document.documentElement.scrollTop||0;document.body.classList.toggle("at-top",y<=2)}window.addEventListener("scroll",u,{passive:true});window.addEventListener("resize",u);u()})();function renderWordsToday(){}function getWordsToday(){return{date:"",count:0}}function resetWordsToday(){}document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".chapter-nav-btn[data-goto]");b&&showChapter(b.getAttribute("data-goto"),!1)});
(function () {
  var KEY = "plainpage.pomodoro.v1";
  var MODES = [
    { id: "focus", label: "focus" },
    { id: "short", label: "short break" },
    { id: "long", label: "long break" },
  ];
  var TOMATO =
    '<svg viewBox="-1 -1 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M16.686,5.1c.952-.99,2.3-3.786.314-4.1a1,1,0,0,0-1,1c0,1.235-1.127,2.546-3,2.9V1a1,1,0,0,0-2,0V4.9C9.127,4.546,8,3.235,8,2A1,1,0,0,0,7,1c-1.983.312-.642,3.106.31,4.1A8.854,8.854,0,0,0,0,14c0,4.721,4.276,10,10,10h4C25.992,24.128,27.457,6.975,16.686,5.1ZM14,22H10a8.322,8.322,0,0,1-8-8c-.052-4.611,4.3-8.172,8.5-6.648A4.471,4.471,0,0,1,7.757,9.03a1,1,0,0,0-.727,1.212c.741,2.132,4.745-.975,4.968-1.565.209.579,4.237,3.7,4.972,1.565a1,1,0,0,0-.728-1.212A4.472,4.472,0,0,1,13.5,7.352C23.917,4.589,25.406,21.99,14,22Z"/></svg>';

  var cfg = { focus: 25, short: 5, long: 15, every: 4, auto: false };
  var st = {
    mode: "focus",
    remaining: 25 * 60000,
    running: false,
    endAt: 0,
    cycle: 0,
    day: "",
    count: 0,
  };
  var timer = null;

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw) {
        Object.assign(cfg, raw.cfg || {});
        Object.assign(st, raw.st || {});
      }
    } catch (e) {}
    if (st.day !== today()) {
      st.day = today();
      st.count = 0;
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ cfg: cfg, st: st }));
    } catch (e) {}
  }
  function duration(mode) {
    return Math.max(1, cfg[mode]) * 60000;
  }
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- dom ---------- */
  var toggleBtn = document.createElement("button");
  toggleBtn.className = "icon-btn";
  toggleBtn.id = "pomodoroToggle";
  toggleBtn.title = "pomodoro timer";
  toggleBtn.setAttribute("aria-label", "pomodoro timer");
  toggleBtn.innerHTML = TOMATO;
  var searchBtn = document.getElementById("searchToggle");
  if (searchBtn && searchBtn.parentNode)
    searchBtn.parentNode.insertBefore(toggleBtn, searchBtn);

  var panel = document.createElement("aside");
  panel.className = "pomodoro-panel";
  panel.id = "pomodoroPanel";
  panel.setAttribute("aria-label", "pomodoro timer");
  panel.innerHTML =
    '<div class="settings-header"><div class="settings-header-left"><h2>pomodoro</h2></div>' +
    '<button class="pomodoro-close" id="pomodoroClose" aria-label="close">✕</button></div>' +
    '<div class="pomodoro-scroll">' +
    '<div class="settings-section pomodoro-main">' +
    '<div class="toggle-group" id="pomodoroModes">' +
    MODES.map(function (m) {
      return '<button class="toggle-btn" type="button" data-mode="' + m.id + '">' + m.label + "</button>";
    }).join("") +
    "</div>" +
    '<div class="pomodoro-time" id="pomodoroTime">25:00</div>' +
    '<div class="pomodoro-bar"><div class="pomodoro-bar-fill" id="pomodoroBarFill"></div></div>' +
    '<div class="pomodoro-actions">' +
    '<button class="pomodoro-primary" id="pomodoroStart" type="button">start</button>' +
    '<button class="settings-action-btn" id="pomodoroReset" type="button">reset</button>' +
    '<button class="settings-action-btn" id="pomodoroSkip" type="button">skip</button></div>' +
    '<p class="pomodoro-count" id="pomodoroCount"></p></div>' +
    '<div class="settings-section"><div class="settings-section-label">durations</div>' +
    row("focus", "pomodoroFocus", 1, 180, "min") +
    row("short", "pomodoroShort", 1, 60, "min") +
    row("long", "pomodoroLong", 1, 90, "min") +
    row("long every", "pomodoroEvery", 2, 12, "focus") +
    '<div class="settings-row"><span class="settings-row-label">auto-start</span><div class="settings-control">' +
    '<div class="toggle-group" id="pomodoroAuto"><button class="toggle-btn" type="button" data-auto="1">on</button>' +
    '<button class="toggle-btn" type="button" data-auto="0">off</button></div></div></div></div>' +
    "</div>";
  document.body.appendChild(panel);

  function row(label, id, min, max, unit) {
    return (
      '<div class="settings-row"><span class="settings-row-label">' + label +
      '</span><div class="settings-control"><input class="settings-input" id="' + id +
      '" type="number" min="' + min + '" max="' + max + '" step="1"> <span class="settings-row-value">' +
      unit + "</span></div></div>"
    );
  }

  var chip = document.createElement("button");
  chip.className = "pomodoro-chip";
  chip.id = "pomodoroChip";
  chip.type = "button";
  document.body.appendChild(chip);

  function $id(i) {
    return document.getElementById(i);
  }
  var elTime = $id("pomodoroTime"),
    elFill = $id("pomodoroBarFill"),
    elStart = $id("pomodoroStart"),
    elCount = $id("pomodoroCount"),
    inputs = { focus: $id("pomodoroFocus"), short: $id("pomodoroShort"), long: $id("pomodoroLong"), every: $id("pomodoroEvery") };

  /* ---------- render ---------- */
  function render() {
    var total = duration(st.mode);
    elTime.textContent = fmt(st.remaining);
    elFill.style.width = (100 * (1 - st.remaining / total)).toFixed(2) + "%";
    elStart.textContent = st.running ? "pause" : st.remaining < total ? "resume" : "start";
    Array.prototype.forEach.call($id("pomodoroModes").children, function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-mode") === st.mode);
    });
    Array.prototype.forEach.call($id("pomodoroAuto").children, function (b) {
      b.classList.toggle("is-selected", (b.getAttribute("data-auto") === "1") === cfg.auto);
    });
    var n = st.count;
    elCount.textContent =
      n + (n === 1 ? " session" : " sessions") + " today · " +
      Math.min(st.cycle + (st.mode === "focus" ? 1 : 0), cfg.every) + " of " + cfg.every;
    toggleBtn.classList.toggle("is-active", st.running || panel.classList.contains("is-open"));
    var open = panel.classList.contains("is-open");
    chip.classList.toggle("is-visible", st.running && !open);
    chip.textContent = fmt(st.remaining) + " · " + (st.mode === "focus" ? "focus" : "break");
    Object.keys(inputs).forEach(function (k) {
      if (document.activeElement !== inputs[k]) inputs[k].value = cfg[k];
    });
  }

  /* ---------- timer logic ---------- */
  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      [0, 0.22].forEach(function (t) {
        var o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.2);
      });
      setTimeout(function () { ctx.close(); }, 800);
    } catch (e) {}
  }
  function toast(msg) {
    var t = $id("saveToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 3200);
  }
  function stopTick() {
    clearInterval(timer);
    timer = null;
  }
  function startTick() {
    stopTick();
    timer = setInterval(tick, 250);
  }
  function tick() {
    if (!st.running) return;
    st.remaining = st.endAt - Date.now();
    if (st.remaining <= 0) return advance(true, true);
    render();
  }
  function advance(counted, notify) {
    var wasFocus = st.mode === "focus";
    if (wasFocus && counted) {
      if (st.day !== today()) { st.day = today(); st.count = 0; }
      st.count++;
      st.cycle++;
    }
    if (wasFocus) {
      if (st.cycle >= cfg.every) { st.mode = "long"; st.cycle = 0; }
      else st.mode = "short";
    } else st.mode = "focus";
    st.remaining = duration(st.mode);
    st.running = cfg.auto && notify;
    st.endAt = st.running ? Date.now() + st.remaining : 0;
    if (!st.running) stopTick();
    if (notify) {
      beep();
      toast(wasFocus ? "focus done — time for a break" : "break over — back to focus");
    }
    save();
    render();
  }
  function toggleRun() {
    if (st.running) {
      st.remaining = Math.max(0, st.endAt - Date.now());
      st.running = false;
      stopTick();
    } else {
      st.running = true;
      st.endAt = Date.now() + st.remaining;
      startTick();
    }
    save();
    render();
  }
  function reset() {
    st.running = false;
    st.endAt = 0;
    st.remaining = duration(st.mode);
    stopTick();
    save();
    render();
  }
  function setMode(m) {
    st.mode = m;
    reset();
  }

  /* ---------- panel ---------- */
  function openPanel() {
    ["closeSettings", "closeSidebar", "closeSearch"].forEach(function (fn) {
      try { if (typeof window[fn] === "function") window[fn](); } catch (e) {}
    });
    panel.classList.add("is-open");
    render();
  }
  function closePanel() {
    panel.classList.remove("is-open");
    render();
  }
  toggleBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    panel.classList.contains("is-open") ? closePanel() : openPanel();
  });
  ["sidebarToggle", "searchToggle", "settingsToggle"].forEach(function (id) {
    var b = $id(id);
    if (b) b.addEventListener("click", closePanel);
  });
  $id("pomodoroClose").addEventListener("click", closePanel);
  chip.addEventListener("click", openPanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) closePanel();
  });
  document.addEventListener("mousedown", function (e) {
    if (panel.classList.contains("is-open") && !panel.contains(e.target) && !toggleBtn.contains(e.target)) closePanel();
  });

  elStart.addEventListener("click", toggleRun);
  $id("pomodoroReset").addEventListener("click", reset);
  $id("pomodoroSkip").addEventListener("click", function () { advance(false, false); });
  $id("pomodoroModes").addEventListener("click", function (e) {
    var b = e.target.closest("[data-mode]");
    if (b) setMode(b.getAttribute("data-mode"));
  });
  $id("pomodoroAuto").addEventListener("click", function (e) {
    var b = e.target.closest("[data-auto]");
    if (!b) return;
    cfg.auto = b.getAttribute("data-auto") === "1";
    save();
    render();
  });
  Object.keys(inputs).forEach(function (k) {
    inputs[k].addEventListener("change", function () {
      var min = +inputs[k].min, max = +inputs[k].max;
      var v = Math.round(+inputs[k].value);
      if (!isFinite(v)) v = cfg[k];
      cfg[k] = Math.min(max, Math.max(min, v));
      inputs[k].value = cfg[k];
      if (!st.running && k === st.mode) st.remaining = duration(st.mode);
      save();
      render();
    });
  });

  /* ---------- boot ---------- */
  load();
  if (st.running) {
    st.remaining = st.endAt - Date.now();
    if (st.remaining <= 0) advance(true, false);
    else startTick();
  } else if (!(st.remaining > 0) || st.remaining > duration(st.mode)) {
    st.remaining = duration(st.mode);
  }
  render();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
})();
