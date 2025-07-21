(() => {
  // src/helper.mjs
  function currentElementWithCaret() {
    var sel = window.getSelection();
    var range = null;
    try {
      range = sel.getRangeAt(0);
    } catch (e) {
      if (e.message.match(/IndexSizeError/)) {
        console.error(e);
      } else {
        throw e;
      }
    }
    if (range?.commonAncestorContainer) {
      let el = range.commonAncestorContainer;
      if (el.nodeType === Node.TEXT_NODE) {
        el = el.parentNode;
      }
      return el;
    }
    var sel = window.getSelection();
    var range = sel.getRangeAt(0);
    return range.startContainer.parentNode;
  }
  function currentBlockWithCaret() {
    return currentElementWithCaret().closest(".block");
  }
  function elementIsVisible(el, {
    offsetTop = -3e3,
    offsetBottom = -3e3,
    offsetLeft = 0,
    offsetRight = 0
  } = {}) {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 + offsetTop && rect.left >= 0 + offsetLeft && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - offsetBottom && rect.right <= (window.innerWidth || document.documentElement.clientWidth) - offsetRight;
  }
  function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }
  function isFirefox() {
    return /firefox/i.test(navigator.userAgent);
  }
  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints;
  }
  function whiteSpaceWorkaround() {
    return isFirefox() ? "<br>" : "";
  }
  function escapeHTMLEntities(string) {
    function basePropertyOf(object) {
      return function(key) {
        return object == null ? void 0 : object[key];
      };
    }
    const escapeHtmlChar = basePropertyOf({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    });
    return string.replace(/[&<>"']/g, escapeHtmlChar);
  }
  function removeFirstLineBreak(text) {
    if (text.split(/\n/)[0] === "") {
      return text.replace(/^\n/, "");
    }
    return text;
  }
  function removeStyleAttributeRecursively(el) {
    el.removeAttribute("style");
    el.querySelectorAll("[style]").forEach((el2) => el2.removeAttribute("style"));
  }
  function debounce(func, wait, immediate) {
    let timeout;
    return function() {
      let context = this;
      let args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      }, wait);
      if (immediate && !timeout) func.apply(context, args);
    };
  }

  // src/md2html.mjs
  var EMPTY_LINE_HTML_PLACEHOLDER = `<br>`;
  function innerTextToHtml(text) {
    const firstLine = text.split("\n").filter((t) => t.length > 0)[0];
    const initialSpace = firstLine ? firstLine.match(/^\s+/) ? firstLine.match(/^\s+/)[0]?.length : 0 : 0;
    const lines = text.split("\n").map((l) => {
      if (initialSpace > 0) {
        l = l.replace(new RegExp(`^\\s{${initialSpace}}`), "");
      }
      l = l.replace(/\s+$/, "");
      if (l.trim() === "") {
        return `<div class="block">&nbsp;</div>`;
      }
      const el = document.createElement("div");
      el.innerText = l;
      return el.outerHTML.replace(/\s{2}/g, "&nbsp;&nbsp;");
    });
    let div = document.createElement("div");
    div.innerHTML = lines.join("\n");
    return div.innerHTML;
  }
  function addCodeBlockClasses(elements) {
    let isCodeBlock = false;
    let codeBlocks = [];
    elements.forEach((el) => {
      if (el.tagName === "BR") {
        const div = document.createElement("div");
        div.classList.add("block");
        if (isCodeBlock) {
          div.classList.add("code-block");
        }
        el.replaceWith(div);
        return;
      }
      el.classList.add("block");
      ["code-block", "code-block-start", "code-block-end"].forEach(
        (className) => el.classList.remove(className)
      );
      const l = el.innerText;
      if (l.trim() === "") {
        el.innerHTML = whiteSpaceWorkaround();
      }
      if (l.match(/^```/) && !isCodeBlock) {
        isCodeBlock = true;
        el.classList.add("code-block-start");
        codeBlocks = [];
      } else if (l.match(/^\s*```\s*$/) && isCodeBlock) {
        isCodeBlock = false;
        el.classList.add("code-block");
        el.classList.add("code-block-end");
      }
      if (isCodeBlock) {
        el.innerHTML = el.innerHTML.replace(/\s/g, "&nbsp;");
        el.classList.add("code-block");
        if (el.innerHTML.match(/[<>]/)) {
          el.innerText = el.innerText;
        }
        codeBlocks.push(el);
      }
      if (el.innerHTML.trim() === "") {
        el.innerHTML = "<br>";
      }
      return el;
    });
    if (isCodeBlock && codeBlocks.length > 0) {
      codeBlocks.forEach((el) => {
        el.classList.remove("code-block");
        el.classList.remove("code-block-start");
      });
    }
  }
  function addParagraphClasses(elements) {
    elements.forEach((el) => {
      removeStyleAttributeRecursively(el);
      el.innerText = el.innerText.replace(/^\n+/, "");
      if (el.innerText.trim() === "") {
        el.innerHTML = whiteSpaceWorkaround();
      }
      ["h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr"].forEach(
        (className) => el.classList.remove(className)
      );
      if (el.classList.contains("code-block")) {
        return;
      }
      if (!el.innerHTML) {
        return;
      }
      if (el.innerText.match(/^#{1,6}\s/)) {
        el.classList.add(`h${el.innerText.match(/^(#{1,6})\s/)[1].length}`);
        return;
      }
      if (el.innerText.match(/^>{1,3}/)) {
        el.classList.add(`blockquote`);
        el.classList.add(
          `blockquote-${el.innerText.match(/^(>{1,3})/)[1].length}`
        );
      }
      if (el.innerText.match(/^---\s*$/)) {
        el.classList.add(`hr`);
      }
      let html = el.innerText;
      html = html.split(/(`+[^\`]+?`+)/g).map((text) => {
        if (text.startsWith("`") && text.endsWith("`") && text[1] != "`" && text !== "`") {
          return `<code>${text}</code>`;
        }
        let html2 = escapeHTMLEntities(text);
        html2 = html2.replace(
          /([\*\\]*)(\*{3}.+?\*{3})([\*]*)/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<strong><em>${matches[2]}</em></strong>`;
          }
        );
        html2 = html2.replace(
          /([\*\\]*)(\*{1}.+?\*{1})([\*]*)/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<em>${matches[2]}</em>`;
          }
        );
        html2 = html2.replace(
          /([\*\\]*)(\*\*.+?\*\*)([\*\\]*)/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<strong>${matches[2]}</strong>`;
          }
        );
        html2 = html2.replace(
          /([\~\\])*(\~\~[^~].+?\~\~)([\~])*/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<s>${matches[2]}</s>`;
          }
        );
        html2 = html2.replace(/(\!)*\[(.+?)\]\((.+?)\)/g, (...matches) => {
          let classes = ["link", matches[1] ? "image" : ""].filter((v) => !!v).join(" ");
          return `<a href="${matches[3]}" style="--url: url(${matches[3]})" class="${classes}">${matches[1] || ""}[${matches[2]}]<span>(${matches[3]})</span></a>`;
        });
        return html2;
      }).join("");
      if (html !== el.innerHTML) {
        el.innerHTML = html;
      }
      if (el.innerText.trim() === "" && EMPTY_LINE_HTML_PLACEHOLDER) {
        el.innerHTML = EMPTY_LINE_HTML_PLACEHOLDER;
      }
      el.querySelectorAll("a.link[href]").forEach((el2) => {
        el2.addEventListener("dblclick", (ev) => {
          if (ev.metaKey || ev.altKey || /^http[s]*\:\/\//i.test(el2.getAttribute("href"))) {
            window.open(el2.href, "_blank");
          } else {
            window.location.href = el2.href;
          }
        });
      });
    });
    return;
  }

  // src/BrowserFixes.mjs
  var BrowserFixes = class {
    static noDivInsideContentEditable(target) {
      target.addEventListener("keyup", (ev) => {
        if (currentBlockWithCaret() === null && target.innerText === "" && target.allChildren === void 0) {
          target.innerHTML = '<div class="block"></div>';
        }
      });
    }
  };

  // src/Cursor.mjs
  var Cursor = class _Cursor {
    static getCurrentCursorPosition(parentElement) {
      var selection = window.getSelection(), charCount = -1, node;
      if (selection.focusNode) {
        if (_Cursor._isChildOf(selection.focusNode, parentElement)) {
          node = selection.focusNode;
          charCount = selection.focusOffset;
          while (node) {
            if (node === parentElement) {
              break;
            }
            if (node.previousSibling) {
              node = node.previousSibling;
              charCount += node.textContent.length;
            } else {
              node = node.parentNode;
              if (node === null) {
                break;
              }
            }
          }
        }
      }
      return charCount;
    }
    static setCurrentCursorPosition(chars, element) {
      if (chars >= 0) {
        var selection = window.getSelection();
        let range = _Cursor._createRange(element, { count: chars });
        if (range) {
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
    static getCaretGlobalPosition() {
      const r = document.getSelection().getRangeAt(0);
      const node = r.startContainer;
      const offset = r.startOffset;
      const pageOffset = { x: window.pageXOffset, y: window.pageYOffset };
      let rect, r2;
      if (offset > 0) {
        r2 = document.createRange();
        r2.setStart(node, offset - 1);
        r2.setEnd(node, offset);
        rect = r2.getBoundingClientRect();
        return {
          left: rect.right + pageOffset.x,
          top: rect.bottom + pageOffset.y
        };
      }
    }
    static getCaretPositionRelativTo(divRef) {
      var selection = document.getSelection();
      if (!selection || !divRef) return { top: null };
      selection.collapseToEnd();
      const range = selection.getRangeAt(0);
      const clone = range.cloneRange();
      clone.selectNodeContents(divRef);
      clone.setEnd(range.startContainer, range.startOffset);
      return {
        top: clone.toString().length
      };
    }
    static _createRange(node, chars, range) {
      if (!range) {
        range = document.createRange();
        range.selectNode(node);
        range.setStart(node, 0);
      }
      if (chars.count === 0) {
        range.setEnd(node, chars.count);
      } else if (node && chars.count > 0) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent.length < chars.count) {
            chars.count -= node.textContent.length;
          } else {
            range.setEnd(node, chars.count);
            chars.count = 0;
          }
        } else {
          for (var lp = 0; lp < node.childNodes.length; lp++) {
            range = _Cursor._createRange(node.childNodes[lp], chars, range);
            if (chars.count === 0) {
              break;
            }
          }
        }
      }
      return range;
    }
    static _isChildOf(node, parentElement) {
      while (node !== null) {
        if (node === parentElement) {
          return true;
        }
        node = node.parentNode;
      }
      return false;
    }
  };
  var Cursor_default = Cursor;

  // src/FocusEditorCore.mjs
  var FocusEditorCore = class _FocusEditorCore {
    #debug = false;
    #readonly = false;
    #tabSize = 0;
    #scroll = {
      behavior: null,
      block: null
    };
    #caretPosition = [];
    #editorCaretPosition = 0;
    #textLengthOnKeyDown = 0;
    #keyboardShortcuts = {
      refresh: {
        accessKey: "KeyR",
        handler: () => {
          this.refresh();
        }
      },
      zen: {
        accessKey: "KeyZ",
        handler: () => {
          this.toggleZenMode();
        }
      },
      focus: {
        handler: (ev) => {
          if (this.target.parentElement.hasAttribute("focus")) {
            this.target.parentElement.removeAttribute("focus");
            findButton(ev).classList.remove("active");
          } else {
            this.target.parentElement.setAttribute("focus", "paragraph");
            findButton(ev).classList.add("active");
          }
        },
        accessKey: "KeyX"
      },
      images: {
        handler: (ev) => {
          if (this.target.parentElement.hasAttribute("image-preview")) {
            this.target.parentElement.removeAttribute("image-preview");
            findButton(ev).classList.remove("active");
          } else {
            this.target.parentElement.setAttribute("image-preview", "*");
            findButton(ev).classList.add("active");
          }
        },
        accessKey: "KeyI"
      }
    };
    #scrollToCaretDebounced = null;
    #renderMarkdownToHtmlDebounced = null;
    HIDE_CARET_ON_CHANGE_FOR_MILLISECONDS = isTouchDevice() ? false : 100;
    POSSIBLE_BLOCK_CLASSES = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "code-block",
      "code-block-start",
      "code-block-end",
      "hr"
    ];
    /**
     *
     * @param {HTMLElement} target
     * @param {string} initialText
     */
    constructor(targetHTMLElement, initialText = "") {
      if (!targetHTMLElement?.tagName) {
        throw new Error("A target HTML element is required");
      }
      this.target = targetHTMLElement;
      this.#scrollToCaretDebounced = debounce(() => {
        this.#scrollToCaret();
      }, 400);
      this.#renderMarkdownToHtmlDebounced = debounce(() => {
        const currentParagraph = currentBlockWithCaret();
        if (currentParagraph) {
          addParagraphClasses([currentParagraph]);
        }
        addCodeBlockClasses(this.allChildren());
        this.#updateAllVisibleElements();
        this.#restoreLastCaretPosition();
      }, 500);
      BrowserFixes.noDivInsideContentEditable(this.target);
      this.#prepareTargetHTMLElement(initialText);
    }
    /**
     * Replaces the current text with new text
     * @param {string} text
     */
    replaceText(text) {
      this.target.innerHTML = innerTextToHtml(text);
      this.#updateChildrenElementsWithMarkdownClasses();
      this.#addCssClassToBlockWithCaret();
      this.target.parentElement.scroll({ top: 0 });
      this.target.focus();
      this.target.click();
    }
    /**
     * @returns {NodeList} All children of the target element
     */
    allChildren() {
      return this.target.querySelectorAll(":scope > *");
    }
    /**
     * (Re)renders markdown.
     * Can be helpfull if not all elements are updated correctly.
     * Triggering refresh may change the caret position as well.
     */
    refresh() {
      let cursor = Cursor_default.getCurrentCursorPosition(this.target);
      this.replaceText(this.getMarkdown());
      if (cursor === 0) {
        Cursor_default.setCurrentCursorPosition(
          cursor,
          this.target.querySelector(".block:first-child") || this.target
        );
      } else {
        Cursor_default.setCurrentCursorPosition(cursor, this.target);
      }
      this.#addCssClassToBlockWithCaret();
      this.#scrollToCaret();
    }
    /**
     * Returns the markdown/commonmark text.
     * @returns {string} Markdown text
     */
    getMarkdown() {
      let text = [];
      if (!this.target.querySelector(".block") && this.target.innerText) {
        if (!isFirefox()) {
          console.error("No .block element found");
        }
        return this.target.innerText;
      }
      this.target.querySelectorAll(".block").forEach(
        (el) => text.push(
          String(el.innerText).replace(/\n+$/, "")
          /* .trimEnd()*/
        )
      );
      text = text.join("\n");
      return text.trim() === "" && this.target.innerText ? this.target.innerText : text;
    }
    /* this should only be called once (maybe make it idempotent?) */
    #prepareTargetHTMLElement(text) {
      this.target.innerHTML = innerTextToHtml(
        removeFirstLineBreak(text)
      );
      this.#updateChildrenElementsWithMarkdownClasses();
      this.target.classList.add("focus-editor");
      this.target.contentEditable = true;
      this.target.addEventListener("keyup", (ev) => this.#onKeyUp(ev, this));
      this.target.addEventListener("keydown", (ev) => this.#onKeyDown(ev, this));
      this.target.addEventListener("click", (ev) => this.#onClick(ev, this));
      this.target.addEventListener("paste", (ev) => this.#afterPaste(ev, this));
      this.target.parentElement.addEventListener(
        "scroll",
        (ev) => this.onScroll(ev, this)
      );
    }
    #updateChildrenElementsWithMarkdownClasses() {
      let children = this.allChildren();
      if (children.length > 500) {
        if (!this._warnedAboutTooManyChildren) {
          this._warnedAboutTooManyChildren = true;
          console.warn("Too many child elements. Just updating visible elements");
        }
        this.#updateAllVisibleElements();
        return;
      }
      this._warnedAboutTooManyChildren = false;
      addCodeBlockClasses(children);
      addParagraphClasses(children);
      this.#updateAllVisibleElements();
    }
    #storeEditorCaretPosition() {
      this.#editorCaretPosition = Cursor_default.getCurrentCursorPosition(this.target);
    }
    #restoreEditorCaretPosition({ offset = 0 } = {}) {
      let position = this.#editorCaretPosition + offset;
      if (position > this.target.innerText.length) {
        position = this.target.innerText.length;
      }
      Cursor_default.setCurrentCursorPosition(position, this.target);
    }
    #debugLog(...args) {
      if (this.#debug) {
        console.debug(...args);
      }
    }
    #storeLastCaretPosition(paragraph = currentBlockWithCaret(), offset = 0) {
      if (!paragraph) {
        this.#debugLog("no element with current caret");
        return;
      }
      const caretPosition = Cursor_default.getCurrentCursorPosition(paragraph);
      this.#caretPosition.push(caretPosition + offset);
      return caretPosition;
    }
    #restoreLastCaretPosition(paragraph = currentBlockWithCaret(), { offset = 0 } = {}) {
      if (!paragraph) {
        this.#debugLog("no element with current caret");
        return;
      }
      const caretPosition = this.#caretPosition.pop();
      Cursor_default.setCurrentCursorPosition(caretPosition + offset, paragraph);
      return caretPosition;
    }
    #updateAllVisibleElements() {
      const visibleElements = [...this.allChildren()].filter(
        (el) => elementIsVisible(el)
      );
      addCodeBlockClasses(visibleElements);
      addParagraphClasses(visibleElements);
    }
    #addCssClassToBlockWithCaret() {
      let current = null;
      try {
        current = currentBlockWithCaret();
        if (!current) return;
      } catch (e) {
        if (isFirefox()) {
          console.warn(e);
        } else {
          console.error(e);
        }
        return;
      }
      this.target.querySelectorAll(".with-caret").forEach((el) => el.classList.remove("with-caret"));
      if (current.classList.contains("with-caret")) {
        return;
      }
      current.classList.add("with-caret");
      if (current.innerText.trim() === "" && EMPTY_LINE_HTML_PLACEHOLDER && isFirefox()) {
        current.innerHTML = EMPTY_LINE_HTML_PLACEHOLDER;
      }
      if (current.getBoundingClientRect().height < this.target.parentElement.getBoundingClientRect().height && current.getBoundingClientRect().height < window.innerHeight) {
        this.#scrollToCaret();
      }
    }
    #scrollToCaret() {
      if (!this.#scroll.behavior || isTouchDevice()) {
        return;
      }
      this.target.querySelector(".with-caret")?.scrollIntoView({
        behavior: this.#scroll.behavior,
        block: this.#scroll.block || "center"
      });
    }
    set tabSize(value) {
      if (value === "\\t") {
        this.#tabSize = isSafari() ? 4 : "	";
        return;
      }
      if (Number(value) !== this.#tabSize) {
        this.#tabSize = Number(value);
      }
      if (!value) {
        this.#tabSize = false;
      }
    }
    set scroll(value) {
      if (!value) {
        this.#scroll = {
          behavior: null,
          block: null
        };
        return;
      }
      this.#scroll = {
        behavior: value.split("|")[0],
        block: value.split("|")[1]
      };
    }
    set readonly(value) {
      this.#readonly = !!value;
      this.target.contentEditable = !this.#readonly;
    }
    set focus(value) {
      if (!value) {
        return;
      }
      this.target.focus();
      this.target.click();
      this.#addCssClassToBlockWithCaret();
    }
    #customTabBehaviour(event) {
      if (!this.#tabSize > 0 && this.#tabSize !== "	") return;
      event.preventDefault();
      const current = currentBlockWithCaret();
      this.#storeLastCaretPosition();
      if (this.#tabSize === "	") {
        if (event.shiftKey) {
          current.innerHTML = current.innerHTML.replace(/^(\t){1}/, "");
          this.#restoreLastCaretPosition(currentBlockWithCaret(), {
            offset: -1
          });
        } else {
          current.innerHTML = "	" + current.innerHTML;
          this.#restoreLastCaretPosition(currentBlockWithCaret(), {
            offset: 1
          });
        }
        return;
      }
      if (event.shiftKey) {
        current.innerHTML = current.innerHTML.replace(
          new RegExp(`^(&nbsp;|s){1,${this.#tabSize}}`),
          ""
        );
        this.#restoreLastCaretPosition(currentBlockWithCaret(), {
          offset: -1 * this.#tabSize
        });
      } else {
        current.innerHTML = [...new Array(this.#tabSize + 1)].join("&nbsp;") + current.innerHTML;
        this.#restoreLastCaretPosition(currentBlockWithCaret(), {
          offset: this.#tabSize
        });
      }
    }
    #afterPaste(event, editor) {
      setTimeout(async () => {
        this.refresh();
        let offset = this.target.innerText.length - this.#textLengthOnKeyDown + 2;
        this.#restoreEditorCaretPosition({
          offset
        });
      }, 1);
    }
    #onClick(event, editor) {
      this.#addCssClassToBlockWithCaret();
      this.#scrollToCaretDebounced();
    }
    onScroll(event, editor) {
      this.#updateAllVisibleElements();
    }
    #onKeyDown(event, editor) {
      editor.#debugLog("onKeyDown", event.key);
      this.#storeEditorCaretPosition();
      this.#textLengthOnKeyDown = this.target.innerText.length;
      this.#addCssClassToBlockWithCaret();
      if (event.ctrlKey && event.altKey || event.altKey && event.shiftKey) {
        for (let name in this.#keyboardShortcuts) {
          if (this.#keyboardShortcuts[name].accessKey === event.code) {
            this.#keyboardShortcuts[name].handler(event);
            event.preventDefault();
            return;
          }
        }
      }
      if (this.HIDE_CARET_ON_CHANGE_FOR_MILLISECONDS && (event.key === "Enter" || event.key === "Backspace")) {
        this.target.classList.add("hide-caret");
        if (!this.hitEnterDebounce) {
          this.hitEnterDebounce = debounce(() => {
            this.target.classList.remove("hide-caret");
          }, this.HIDE_CARET_ON_CHANGE_FOR_MILLISECONDS);
        }
        this.hitEnterDebounce();
      }
      if (event.key === "Tab") {
        if (this.#customTabBehaviour) {
          this.#customTabBehaviour(event);
          return;
        }
      }
      if (event.key === "Backspace") {
        let current = currentBlockWithCaret();
        if (current?.innerText?.trim() === "") {
          event.preventDefault();
          if (!current.previousSibling.innerText?.trim()) {
            current.previousSibling.innerHTML = "";
          }
          Cursor_default.setCurrentCursorPosition(
            current.previousSibling.innerText?.length || 0,
            current.previousSibling
          );
          current.remove();
        }
      }
    }
    #onKeyUp(event, editor) {
      editor.#debugLog("onKeyUp", event.key);
      if (event.isComposing) {
        return;
      }
      if (!document.fullscreenElement) {
        this.target.parentElement.classList.remove("zen-mode");
      }
      const selectionRange = Math.abs(
        window.getSelection().extentOffset - window.getSelection().baseOffset
      );
      const textIsSelectedInBlock = selectionRange > 0 && (window.getSelection().baseNode?.parentNode?.classList?.contains("block") || window.getSelection().baseNode?.parentNode?.closest(".focus-editor[contenteditable]")) ? true : false;
      if (textIsSelectedInBlock) {
        return;
      }
      if (isFirefox() && !this.target.querySelector(".block")) {
        try {
          Cursor_default.setCurrentCursorPosition(0, this.target.querySelector(".block"));
        } catch (error) {
          this.refresh();
          return;
        }
      }
      const currentParagraph = currentBlockWithCaret();
      if (isFirefox() && currentParagraph && currentParagraph.innerText.trim() === "" && event.key === " ") {
      }
      if (isFirefox() && this.target.innerText.trim() !== "" && this.target.querySelectorAll(".block").length === 1 && this.target.querySelector(".block").innerText.trim() === "") {
        this.refresh();
        Cursor_default.setCurrentCursorPosition(0, this.target.querySelector(".block"));
      }
      this.#addCssClassToBlockWithCaret();
      if (isFirefox()) {
        if (event.key === "Enter") {
          this.#scrollToCaretDebounced();
        }
      } else {
        this.#scrollToCaretDebounced();
      }
      if (!currentParagraph) {
        if (isFirefox()) {
          let divs = this.target.querySelectorAll("div:not(.block)");
          if (divs.length > 0) {
            console.log(divs);
            divs.forEach((el) => el.classList.add("block"));
            divs[0].click();
            divs[0].focus();
          } else {
            let elements = [...this.target.childNodes].filter((el) => el.nodeType === Node.TEXT_NODE).filter((v) => !!v.data.trim());
            elements.forEach((el) => {
              let div = document.createElement("div");
              div.innerText = el.innerText;
              div.classList.add("block");
              if (el.nextElementSibling) {
                el.nextElementSibling.after(div);
              } else {
                this.target.appendChild(div);
              }
              _FocusEditorCore.#activateElementWithClickFocusAndCaret(div);
              el.remove();
            });
            console.warn("restored text");
          }
        }
        console.warn("\u2026 no element with current caret\u2026");
        return;
      }
      if (event.key === "Enter") {
        this.POSSIBLE_BLOCK_CLASSES.forEach(
          (tagName) => currentParagraph.classList.remove(tagName)
        );
        currentParagraph.classList.add("block");
        if (currentParagraph.previousSibling.classList.contains("code-block")) {
          if (!currentParagraph.previousSibling.classList.contains(
            "code-block-end"
          ) || currentParagraph.innerText.endsWith("```")) {
            currentParagraph.classList.add("code-block");
          }
        }
        if (this.#onAfterHittingEnter) {
          this.#onAfterHittingEnter();
        }
        return;
      }
      this.#storeLastCaretPosition(currentBlockWithCaret());
      if (currentParagraph.classList.contains("code-block")) {
        addCodeBlockClasses(this.allChildren());
        this.#updateChildrenElementsWithMarkdownClasses();
      }
      if (currentParagraph.innerText.trim() === "") {
        return;
      }
      const hasManyParagraphs = this.allChildren().length > 500;
      if (hasManyParagraphs) {
        this.#renderMarkdownToHtmlDebounced();
        return;
      }
      addParagraphClasses([currentParagraph]);
      addCodeBlockClasses(this.allChildren());
      this.#updateAllVisibleElements();
      this.#restoreLastCaretPosition();
    }
    static #activateElementWithClickFocusAndCaret(el) {
      el.click();
      el.focus();
      Cursor_default.setCurrentCursorPosition(el.innerText.length, el);
    }
    #onAfterHittingEnter() {
      let current = currentBlockWithCaret();
      if (!current) return;
      if (current.classList.contains("code-block")) return;
      if (!isSafari()) {
        this.#storeLastCaretPosition();
        this.#updateAllVisibleElements();
        addParagraphClasses([current]);
        this.#restoreLastCaretPosition();
      }
      if (this.target.parentElement.getAttribute("autocomplete") === "off") {
        return;
      }
      const setCursorToEndAndUpdate = () => {
        this.#updateAllVisibleElements();
        let current2 = currentBlockWithCaret();
        Cursor_default.setCurrentCursorPosition(current2.innerText.length, current2);
      };
      const previousAutocompletePattern = current.previousSibling?.dataset?.autocompletePattern || "";
      const insertedElementText = current.innerText;
      const previousText = current.previousSibling.innerText;
      const lineBeginsWithUnorderedList = /^(\s*\-\s+|\s*\*\s+|\s*•\s+|\s*\*\s+|\s*\+\s+|\>+\s*)(.*)$/;
      const lineBeginsWithOrderedList = /^(\s*)(\d+)(\.|\.\))\s.+/;
      let matches = previousText.match(lineBeginsWithUnorderedList);
      if (matches && matches[1]) {
        let previousTextTrimmed = insertedElementText.replace(lineBeginsWithUnorderedList, "").trim();
        current.innerText = matches[1] + previousTextTrimmed;
        if (previousAutocompletePattern && current.previousSibling.innerText === matches[1]) {
          current.innerText = previousTextTrimmed || "";
          current.previousSibling.innerText = "";
          return;
        }
        current.dataset.autocompletePattern = matches[1];
        setCursorToEndAndUpdate();
      } else {
        matches = previousText.match(lineBeginsWithOrderedList);
        if (matches && matches[2] && matches[3]) {
          let autocompleteText = (matches[1] || "") + (Number(matches[2].trim()) + 1) + matches[3] + " ";
          let previousTextTrimmed = insertedElementText.replace(lineBeginsWithOrderedList, "").trim();
          current.innerText = autocompleteText + previousTextTrimmed;
          if (previousAutocompletePattern && current.previousSibling.innerText === current.innerText) {
            current.innerText = previousTextTrimmed || "";
            current.previousSibling.innerText = "";
            return;
          }
          setCursorToEndAndUpdate();
          current.dataset.autocompletePattern = autocompleteText;
        }
      }
    }
    /**
     * Toggles Zen Mode (means setting the focus editor to full screen)
     */
    toggleZenMode() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        this.target.parentElement.classList.remove("zen-mode");
        setTimeout(() => {
          this.target.parentElement.classList.remove("zen-mode");
        }, 10);
      } else {
        this.target.parentElement.requestFullscreen();
        this.target.parentElement.classList.add("zen-mode");
      }
    }
    /**
     * Appends character(s) without rerendering the whole editor
     * @param {string} char
     */
    appendCharacter(char) {
      if (char === "\n") {
        let div = document.createElement("div");
        div.classList.add("block");
        this.target.appendChild(div);
        if (div.previousElementSibling) {
          addParagraphClasses([div.previousElementSibling]);
        }
        this.#updateAllVisibleElements();
        return;
      }
      let last = this.target.querySelector(".block:last-child");
      last.innerText += char;
      addParagraphClasses([last]);
    }
  };
  var FocusEditorCore_default = FocusEditorCore;

  // src/FocusEditorWebComponent.mjs
  var FocusEditorWebComponent = class extends HTMLElement {
    static observedAttributes = [
      "scroll",
      "name",
      "tab-size",
      "buttons",
      "autofocus",
      "readonly"
    ];
    editor = null;
    constructor() {
      super();
      const div = document.createElement("div");
      let text = this.getAttribute("value") || this.textContent.replace(/\n\s+$/, "");
      if (this.childElementCount && this.firstElementChild.tagName === "TEXTAREA") {
        this.classList.add("textarea");
        if (!this.getAttribute("name") && this.firstElementChild.getAttribute("name")) {
          this.setAttribute("name", this.firstElementChild.getAttribute("name"));
        }
        if (!this.getAttribute("id") && this.firstElementChild.getAttribute("id") !== null) {
          this.setAttribute("id", this.firstElementChild.getAttribute("id"));
        }
      }
      this.innerText = "";
      this.appendChild(div);
      this.editor = new FocusEditorCore_default(div, text.trim() === "" ? "" : text);
      if (this.hasAttribute("autofocus")) {
        this.editor.focus = true;
      }
      this.editor.scroll = this.getAttribute("scroll");
      this.editor.tabSize = this.getAttribute("tab-size");
      this.addEventListener("input", () => this.#syncValueForTextareaElement());
      this.#syncValueForTextareaElement();
    }
    #syncValueForTextareaElement = (inputName = this.getAttribute("name")) => {
      if (!inputName) {
        return;
      }
      let textArea = this.querySelector(`textarea[name="${inputName}"]`);
      if (!textArea) {
        textArea = document.createElement("textarea");
        textArea.name = inputName;
        textArea.style.display = "none";
        this.appendChild(textArea);
      }
      textArea.innerText = this.value;
    };
    set value(text) {
      this.editor.replaceText(text);
    }
    get value() {
      return this.editor.getMarkdown();
    }
    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "scroll") {
        this.editor.scroll = newValue;
      }
      if (name === "tab-size") {
        this.editor.tabSize = newValue;
      }
      if (name === "readonly") {
        this.editor.readonly = newValue != "true";
      }
      if (name === "name") {
        this.#syncValueForTextareaElement(newValue);
      }
    }
  };
  var FocusEditorWebComponent_default = FocusEditorWebComponent;

  // src/FocusEditor.mjs
  function registerFocusEditorWebComponent() {
    try {
      customElements.define("focus-editor", FocusEditorWebComponent_default);
    } catch (error) {
      if (error.name === "NotSupportedError") {
        console.error(error);
      } else {
        throw error;
      }
    }
  }
  function init(...args) {
    registerFocusEditorWebComponent();
    if (args.length === 0) {
      return {
        FocusEditorCore: FocusEditorCore_default,
        FocusEditorWebComponent: FocusEditorWebComponent_default
      };
    }
    if (typeof args[0].forEach === "function") {
      args[0].forEach((e) => {
        let fe = new FocusEditorWebComponent_default();
        fe.value = e.value || e.innerText;
        e.replaceWith(fe);
      });
      return {
        FocusEditorCore: FocusEditorCore_default,
        FocusEditorWebComponent: FocusEditorWebComponent_default
      };
    }
    if (typeof args[0].tagName === "string") {
      let fe = new FocusEditorWebComponent_default();
      fe.value = args[1] !== void 0 ? args[1] : args[0].value || args[0].innerText;
      args[0].replaceWith(fe);
      return {
        FocusEditorCore: FocusEditorCore_default,
        FocusEditorWebComponent: FocusEditorWebComponent_default
      };
    }
    return FocusEditorCore_default(...args);
  }
  var FocusEditor_default = init;
  function textareasAsFocusEditor(selector = "textarea") {
    registerFocusEditorWebComponent();
    document.querySelectorAll(selector).forEach((textarea) => {
      const fe = new FocusEditorWebComponent_default();
      fe.value = textarea.value || textarea.innerText;
      for (let attr of [...textarea.attributes]) {
        fe.setAttribute(attr.name, textarea.getAttribute(attr.name));
      }
      fe.classList.add("textarea");
      textarea.replaceWith(fe);
    });
  }
  globalThis.initFocusEditor = init;
})();
