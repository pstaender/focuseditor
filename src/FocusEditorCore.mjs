import * as md2html from "./md2html.mjs";
import * as helper from "./helper.mjs";
import BrowserFixes from "./BrowserFixes.mjs";
import Cursor from "./Cursor.mjs";

/** Focus Editor Core class creates the editable content element and manages all its' changes on the text */
class FocusEditorCore {
  #debug = false;
  #readonly = false;
  #tabSize = 0;
  #scroll = {
    behavior: null,
    block: null,
  };
  #caretPosition = [];
  #editorCaretPosition = 0;
  #textLengthOnKeyDown = 0;
  #keyboardShortcuts = {
    refresh: {
      accessKey: "KeyR",
      handler: () => {
        this.refresh();
      },
    },
    zen: {
      accessKey: "KeyZ",
      handler: () => {
        this.toggleZenMode();
      },
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
      accessKey: "KeyX",
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
      accessKey: "KeyI",
    },
  };
  #scrollToCaretDebounced = null;
  #renderMarkdownToHtmlDebounced = null;

  HIDE_CARET_ON_CHANGE_FOR_MILLISECONDS = helper.isTouchDevice() ? false : 100;

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
    "hr",
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
    this.#scrollToCaretDebounced = helper.debounce(() => {
      this.#scrollToCaret();
    }, 400);
    this.#renderMarkdownToHtmlDebounced = helper.debounce(() => {
      const currentParagraph = helper.currentBlockWithCaret();
      if (currentParagraph) {
        md2html.addParagraphClasses([currentParagraph]);
      }
      md2html.addCodeBlockClasses(this.allChildren());

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
    this.target.innerHTML = md2html.innerTextToHtml(text);
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
    let cursor = Cursor.getCurrentCursorPosition(this.target);
    this.replaceText(this.getMarkdown());
    if (cursor === 0) {
      // Firefox issue
      Cursor.setCurrentCursorPosition(
        cursor,
        this.target.querySelector(".block:first-child") || this.target,
      );
    } else {
      Cursor.setCurrentCursorPosition(cursor, this.target);
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
      // firefox bug
      if (!helper.isFirefox()) {
        console.error("No .block element found");
      }
      return this.target.innerText;
    }
    this.target
      .querySelectorAll(".block")
      .forEach((el) =>
        text.push(String(el.innerText).replace(/\n+$/, "") /* .trimEnd()*/),
      );

    text = text.join("\n");

    // sometimes a browser (firefox) screws up blocks. user inner text instead
    return text.trim() === "" && this.target.innerText
      ? this.target.innerText
      : text;
  }

  /* this should only be called once (maybe make it idempotent?) */
  #prepareTargetHTMLElement(text) {
    this.target.innerHTML = md2html.innerTextToHtml(
      helper.removeFirstLineBreak(text),
    );
    this.#updateChildrenElementsWithMarkdownClasses();

    this.target.classList.add("focus-editor");
    this.target.contentEditable = true;
    this.target.addEventListener("keyup", (ev) => this.#onKeyUp(ev, this));
    this.target.addEventListener("keydown", (ev) => this.#onKeyDown(ev, this));
    this.target.addEventListener("click", (ev) => this.#onClick(ev, this));
    this.target.addEventListener("paste", (ev) => this.#afterPaste(ev, this));
    this.target.parentElement.addEventListener("scroll", (ev) =>
      this.onScroll(ev, this),
    );
  }

  #updateChildrenElementsWithMarkdownClasses /*removeHtmlEntities = false*/() {
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
    md2html.addCodeBlockClasses(children);
    md2html.addParagraphClasses(children);

    this.#updateAllVisibleElements();
  }

  #storeEditorCaretPosition() {
    this.#editorCaretPosition = Cursor.getCurrentCursorPosition(this.target);
  }

  #restoreEditorCaretPosition({ offset = 0 } = {}) {
    let position = this.#editorCaretPosition + offset;
    if (position > this.target.innerText.length) {
      position = this.target.innerText.length;
    }
    Cursor.setCurrentCursorPosition(position, this.target);
  }

  #debugLog(...args) {
    if (this.#debug) {
      console.debug(...args);
    }
  }

  #storeLastCaretPosition(
    paragraph = helper.currentBlockWithCaret(),
    offset = 0,
  ) {
    if (!paragraph) {
      this.#debugLog("no element with current caret");
      return;
    }
    const caretPosition = Cursor.getCurrentCursorPosition(paragraph);
    this.#caretPosition.push(caretPosition + offset);
    return caretPosition;
  }

  #restoreLastCaretPosition(
    paragraph = helper.currentBlockWithCaret(),
    { offset = 0 } = {},
  ) {
    if (!paragraph) {
      this.#debugLog("no element with current caret");
      return;
    }
    const caretPosition = this.#caretPosition.pop();
    Cursor.setCurrentCursorPosition(caretPosition + offset, paragraph);
    return caretPosition;
  }

  #updateAllVisibleElements() {
    const visibleElements = [...this.allChildren()].filter((el) =>
      helper.elementIsVisible(el),
    );
    md2html.addCodeBlockClasses(visibleElements);
    md2html.addParagraphClasses(visibleElements);
  }

  #addCssClassToBlockWithCaret() {
    let current = null;
    try {
      current = helper.currentBlockWithCaret();
      if (!current) return;
    } catch (e) {
      if (helper.isFirefox()) {
        console.warn(e);
      } else {
        console.error(e);
      }
      return;
    }

    this.target
      .querySelectorAll(".with-caret")
      .forEach((el) => el.classList.remove("with-caret"));

    if (current.classList.contains("with-caret")) {
      return;
    }
    current.classList.add("with-caret");

    /* FIX FOR FIREFOX */
    if (
      current.innerText.trim() === "" &&
      md2html.EMPTY_LINE_HTML_PLACEHOLDER &&
      helper.isFirefox()
    ) {
      current.innerHTML = md2html.EMPTY_LINE_HTML_PLACEHOLDER;
    }

    if (
      current.getBoundingClientRect().height <
        this.target.parentElement.getBoundingClientRect().height &&
      current.getBoundingClientRect().height < window.innerHeight
    ) {
      this.#scrollToCaret();
    }
  }

  #scrollToCaret() {
    if (!this.#scroll.behavior || helper.isTouchDevice()) {
      return;
    }

    // if (window.matchMedia('(prefers-reduced-motion: reduce)')) {
    //   return;
    // }

    this.target.querySelector(".with-caret")?.scrollIntoView({
      behavior: this.#scroll.behavior,
      block: this.#scroll.block || "center",
    });
  }

  set tabSize(value) {
    if (value === "\\t") {
      /* Bug: Safari can not handle the custom \t tab behaviour, use 4 spaces instead */
      this.#tabSize = helper.isSafari() ? 4 : "\t";
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
        block: null,
      };
      return;
    }
    this.#scroll = {
      behavior: value.split("|")[0],
      block: value.split("|")[1],
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
    if (!this.#tabSize > 0 && this.#tabSize !== "\t") return;

    event.preventDefault();
    const current = helper.currentBlockWithCaret();
    this.#storeLastCaretPosition();

    if (this.#tabSize === "\t") {
      if (event.shiftKey) {
        current.innerHTML = current.innerHTML.replace(/^(\t){1}/, "");
        this.#restoreLastCaretPosition(helper.currentBlockWithCaret(), {
          offset: -1,
        });
      } else {
        current.innerHTML = "\t" + current.innerHTML;
        this.#restoreLastCaretPosition(helper.currentBlockWithCaret(), {
          offset: 1,
        });
      }
      return;
    }

    if (event.shiftKey) {
      current.innerHTML = current.innerHTML.replace(
        new RegExp(`^(&nbsp;|\s){1,${this.#tabSize}}`),
        "",
      );
      this.#restoreLastCaretPosition(helper.currentBlockWithCaret(), {
        offset: -1 * this.#tabSize,
      });
    } else {
      current.innerHTML =
        [...new Array(this.#tabSize + 1)].join("&nbsp;") + current.innerHTML;
      this.#restoreLastCaretPosition(helper.currentBlockWithCaret(), {
        offset: this.#tabSize,
      });
    }
  }

  #afterPaste(event, editor) {
    setTimeout(async () => {
      this.refresh();
      let offset = this.target.innerText.length - this.#textLengthOnKeyDown + 2;

      this.#restoreEditorCaretPosition({
        offset,
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

    if (
      this.HIDE_CARET_ON_CHANGE_FOR_MILLISECONDS &&
      (event.key === "Enter" || event.key === "Backspace")
    ) {
      this.target.classList.add("hide-caret");
      if (!this.hitEnterDebounce) {
        this.hitEnterDebounce = helper.debounce(() => {
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
    /* BROWSER-FIX-1: FIXES BEHAVIOUR OF CHROME WHEN BACKSPACE IS PRESSED, MOVING CONTAINER UP */
    if (event.key === "Backspace") {
      let current = helper.currentBlockWithCaret();
      if (current?.innerText?.trim() === "") {
        event.preventDefault();
        if (!current.previousSibling.innerText?.trim()) {
          current.previousSibling.innerHTML = "";
        }
        Cursor.setCurrentCursorPosition(
          current.previousSibling.innerText?.length || 0,
          current.previousSibling,
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
      window.getSelection().extentOffset - window.getSelection().baseOffset,
    );

    const textIsSelectedInBlock =
      selectionRange > 0 &&
      (window
        .getSelection()
        .baseNode?.parentNode?.classList?.contains("block") ||
        window
          .getSelection()
          .baseNode?.parentNode?.closest(".focus-editor[contenteditable]"))
        ? true
        : false;

    if (textIsSelectedInBlock) {
      return;
    }

    if (helper.isFirefox() && !this.target.querySelector(".block")) {
      /* Firefox Bug (1): When selecting all text and clean it, not div is there anymore */
      try {
        Cursor.setCurrentCursorPosition(0, this.target.querySelector(".block"));
      } catch (error) {
        this.refresh();
        return;
      }
    }

    const currentParagraph = helper.currentBlockWithCaret();

    if (
      helper.isFirefox() &&
      currentParagraph &&
      currentParagraph.innerText.trim() === "" &&
      event.key === " "
    ) {
      // TODO: prevent firefox deleting the spaces
      // console.log(event, currentParagraph.innerText)
      // return;
    }

    if (
      helper.isFirefox() &&
      this.target.innerText.trim() !== "" &&
      this.target.querySelectorAll(".block").length === 1 &&
      this.target.querySelector(".block").innerText.trim() === ""
    ) {
      /* Firefox Bug (2): When selecting all text and clean it, not div is there anymore */
      this.refresh();
      Cursor.setCurrentCursorPosition(0, this.target.querySelector(".block"));
    }

    this.#addCssClassToBlockWithCaret();

    if (helper.isFirefox()) {
      if (event.key === "Enter") {
        this.#scrollToCaretDebounced();
      }
    } else {
      this.#scrollToCaretDebounced();
    }

    if (!currentParagraph) {
      /**
       * Firefox Bug (3): When selecting text and clean it, the text might be outside of any div
       */
      if (helper.isFirefox()) {
        let divs = this.target.querySelectorAll("div:not(.block)");
        if (divs.length > 0) {
          console.log(divs);
          divs.forEach((el) => el.classList.add("block"));
          divs[0].click();
          divs[0].focus();
        } else {
          // find text which is outside from any div (happens on firefox)
          let elements = [...this.target.childNodes]
            .filter((el) => el.nodeType === Node.TEXT_NODE)
            .filter((v) => !!v.data.trim());
          elements.forEach((el) => {
            let div = document.createElement("div");
            div.innerText = el.innerText;
            div.classList.add("block");
            if (el.nextElementSibling) {
              el.nextElementSibling.after(div);
            } else {
              this.target.appendChild(div);
            }
            FocusEditorCore.#activateElementWithClickFocusAndCaret(div);

            el.remove();
          });
          console.warn("restored text");
        }
      }
      console.warn("… no element with current caret…");
      return;
    }

    if (event.key === "Enter") {
      // Browser blindly copies all classes to new created element: we are removing them here
      this.POSSIBLE_BLOCK_CLASSES.forEach((tagName) =>
        currentParagraph.classList.remove(tagName),
      );
      currentParagraph.classList.add("block");

      if (currentParagraph.previousSibling.classList.contains("code-block")) {
        if (
          !currentParagraph.previousSibling.classList.contains(
            "code-block-end",
          ) ||
          currentParagraph.innerText.endsWith("```")
        ) {
          currentParagraph.classList.add("code-block");
        }
      }

      if (this.#onAfterHittingEnter) {
        this.#onAfterHittingEnter();
      }
      return;
    }

    this.#storeLastCaretPosition(helper.currentBlockWithCaret());

    if (currentParagraph.classList.contains("code-block")) {
      md2html.addCodeBlockClasses(this.allChildren());
      this.#updateChildrenElementsWithMarkdownClasses();
    }

    if (currentParagraph.innerText.trim() === "") {
      /* BUG: browsers have problems with cursor position on empty paragraphs */
      return;
    }

    /* if many paragraphs exists, bounce the rendering to avoid lag */
    const hasManyParagraphs = this.allChildren().length > 500;
    if (hasManyParagraphs) {
      this.#renderMarkdownToHtmlDebounced();
      return;
    }

    md2html.addParagraphClasses([currentParagraph]);
    md2html.addCodeBlockClasses(this.allChildren());

    this.#updateAllVisibleElements();
    this.#restoreLastCaretPosition();
  }

  static #activateElementWithClickFocusAndCaret(el) {
    el.click();
    el.focus();
    Cursor.setCurrentCursorPosition(el.innerText.length, el);
  }

  #onAfterHittingEnter() {
    let current = helper.currentBlockWithCaret();
    if (!current) return;
    if (current.classList.contains("code-block")) return;

    // BUG: safari will not create a new paragraph element on hitting enter, so exclude safari here
    if (!helper.isSafari()) {
      // store and restore caret position: otherwise the caret may jump when typing fast
      this.#storeLastCaretPosition();
      this.#updateAllVisibleElements();
      md2html.addParagraphClasses([current]);
      this.#restoreLastCaretPosition(); //
    }

    if (this.target.parentElement.getAttribute("autocomplete") === "off") {
      return;
    }

    const setCursorToEndAndUpdate = () => {
      this.#updateAllVisibleElements();
      let current = helper.currentBlockWithCaret();
      Cursor.setCurrentCursorPosition(current.innerText.length, current);
    };

    const previousAutocompletePattern =
      current.previousSibling?.dataset?.autocompletePattern || "";
    const insertedElementText = current.innerText;
    const previousText = current.previousSibling.innerText;
    const lineBeginsWithUnorderedList =
      /^(\s*\-\s+|\s*\*\s+|\s*•\s+|\s*\*\s+|\s*\+\s+|\>+\s*)(.*)$/;
    const lineBeginsWithOrderedList = /^(\s*)(\d+)(\.|\.\))\s.+/;

    let matches = previousText.match(lineBeginsWithUnorderedList);

    if (matches && matches[1]) {
      let previousTextTrimmed = insertedElementText
        .replace(lineBeginsWithUnorderedList, "")
        .trim();
      current.innerText = matches[1] + previousTextTrimmed;
      if (
        previousAutocompletePattern &&
        current.previousSibling.innerText === matches[1]
      ) {
        current.innerText = previousTextTrimmed || "";
        current.previousSibling.innerText = "";
        return;
      }
      current.dataset.autocompletePattern = matches[1];
      setCursorToEndAndUpdate();
    } else {
      matches = previousText.match(lineBeginsWithOrderedList);
      if (matches && matches[2] && matches[3]) {
        let autocompleteText =
          (matches[1] || "") +
          (Number(matches[2].trim()) + 1) +
          matches[3] +
          " ";
        let previousTextTrimmed = insertedElementText
          .replace(lineBeginsWithOrderedList, "")
          .trim();
        current.innerText = autocompleteText + previousTextTrimmed;
        if (
          previousAutocompletePattern &&
          current.previousSibling.innerText === current.innerText
        ) {
          current.innerText = previousTextTrimmed || "";
          current.previousSibling.innerText = "";
          return;
        }
        setCursorToEndAndUpdate();
        current.dataset.autocompletePattern = autocompleteText;
        // TODO: cleanup dataset.autocompletePattern afterwards
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
        md2html.addParagraphClasses([div.previousElementSibling]);
      }
      this.#updateAllVisibleElements();
      return;
    }

    let last = this.target.querySelector(".block:last-child");
    last.innerText += char;
    md2html.addParagraphClasses([last]);
  }
}

export default FocusEditorCore;
