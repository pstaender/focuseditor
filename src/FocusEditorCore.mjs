import * as md2html from "./md2html.mjs";
import * as helper from "./helper.mjs";
import BrowserFixes from "./BrowserFixes.mjs";
import Cursor from "./Cursor.mjs";
import UndoText from "./UndoText.mjs";

/** Focus Editor Core class creates the editable content element and manages all its' changes on the text */
class FocusEditorCore {
  #readonly = false;
  #tabSize = 0;
  #caretPosition = [];
  #editorCaretPosition = 0;
  #textLengthOnKeyDown = 0;
  #placeholder = "";
  #maxUndoSteps = 200;
  #textUndo = new UndoText();
  #scrollIntoViewOptions = { block: "center" };
  #target = null;

  #keyboardShortcuts = {
    refresh: {
      accessKey: "KeyR",
      handler: () => {
        this.fullRefresh();
      },
    },
    zen: {
      accessKey: "KeyZ",
      handler: () => {
        this.toggleZenMode();
      },
    },
    focus: {
      handler: () => {
        if (this.target.parentElement.hasAttribute("focus")) {
          this.target.parentElement.removeAttribute("focus");
        } else {
          this.target.parentElement.setAttribute("focus", "paragraph");
        }
      },
      accessKey: "KeyX",
    },
    images: {
      handler: () => {
        if (this.target.parentElement.hasAttribute("image-preview")) {
          this.target.parentElement.removeAttribute("image-preview");
        } else {
          this.target.parentElement.setAttribute("image-preview", "*");
        }
      },
      accessKey: "KeyI",
    },
  };

  HIDE_CARET_ON_CHANGE_FOR_MILLISECONDS = false;

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

    this.__addUndoStepDebounced = helper.debounce(this.#addUndoStep, 200);

    BrowserFixes.noDivInsideContentEditable(this.target);

    this.target.innerHTML = md2html.innerTextToHtml(
      helper.removeFirstLineBreak(initialText),
      document,
    );
    this.#updateChildrenElementsWithMarkdownClasses();
  }

  /**
   * Replaces the current text with new text
   * @param {string} text
   * @param {Object} options
   * @param {boolean} options.clearHistory
   * @param {boolean} options.dontAddToHistory
   */
  replaceText(text, { clearHistory = false, dontAddToHistory = false } = {}) {
    // TODO: not sure that this rule is a good idea? But often empty text is set as \n…
    if (text === "\n") {
      text = "";
    }
    this.target.innerHTML = md2html.innerTextToHtml(text || "", document);
    this.#updateChildrenElementsWithMarkdownClasses();
    this.#addCssClassToBlockWithCaret();
    this.target.parentElement.scroll({ top: 0 });
    this.target.focus();
    this.target.click();
    if (clearHistory) {
      this.#textUndo.clear();
    }
    if (!dontAddToHistory) {
      this.#textUndo.add(this.getMarkdown());
    }
  }

  /**
   * @returns {NodeList} All children of the target element
   */
  allChildren() {
    return this.target.querySelectorAll(":scope > *");
  }

  #visibleChildren() {
    return [...this.allChildren()].filter((el) =>
      helper.elementIsVisible(el, {
        offsetTop: -1000,
        offsetBottom: -1000,
        offsetLeft: 0,
        offsetRight: 0,
      }),
    );
  }

  /**
   * (Re)renders markdown.
   * Can be helpful if not all elements are updated correctly.
   * Triggering refresh may change the caret position as well.
   */
  fullRefresh() {
    let cursor = Cursor.getCurrentCursorPosition(this.target);
    const lengthBefore = this.target.textContent.length;

    this.replaceText(this.getMarkdown());

    const diffCursorPosition = lengthBefore - this.target.textContent.length;

    if (cursor === 0) {
      // Firefox issue
      Cursor.setCurrentCursorPosition(
        cursor,
        this.target.querySelector(".block:first-child") || this.target,
      );
    } else {
      Cursor.setCurrentCursorPosition(cursor + diffCursorPosition, this.target);
    }
    this.#addCssClassToBlockWithCaret();
  }

  refresh() {
    this.#updateChildrenElementsWithMarkdownClasses();
  }

  /**
   * Returns the plain text.
   * @returns {string} plain text
   */
  getMarkdown() {
    let text = [];
    if (!this.target.querySelector(".block") && this.target.textContent) {
      console.warn("No .block element found");
      return this.target.textContent;
    }
    this.target
      .querySelectorAll(".block")
      .forEach((el) => text.push(String(el.textContent).replace(/\n+$/, "")));

    text = text.join("\n");

    // sometimes a browser (firefox) screws up blocks. user inner text instead
    return text.trim() === "" && this.target.textContent
      ? this.target.textContent
      : text;
  }

  #hasManyElements() {
    return this.allChildren().length > 700;
  }

  #renderParagraphBlocks(children, document) {
    md2html.addParagraphClasses(children, document);
    this.target.dispatchEvent(
      new CustomEvent("renderParagraphBlocks", {
        bubbles: true,
        detail: {
          elements: children,
        },
      }),
    );
    if (this.target.parentElement.hasAttribute('prevent-dblclick-visit-on-links')) {
      return;
    }
    children.forEach((e) =>
      e.querySelectorAll("a.link[href]:not(.prevent-dblclick-visit)").forEach((el) => {
        el.addEventListener("dblclick", (ev) => {
          if (
            ev.metaKey ||
            ev.altKey ||
            /^http[s]*:\/\//i.test(el.getAttribute("href"))
          ) {
            // open in new tab
            window.open(el.href, "_blank");
          } else {
            window.location.href = el.href;
          }
        });
      }),
    );
  }

  #updateChildrenElementsWithMarkdownClasses() {
    let children = this.allChildren();
    this._warnedAboutTooManyChildren = false;
    md2html.addCodeBlockClasses(children, document);
    this.#renderParagraphBlocks(children, document);

    this.#updateAllVisibleElements();
  }

  #storeEditorCaretPosition() {
    this.#editorCaretPosition = Cursor.getCurrentCursorPosition(this.target);
  }

  #restoreEditorCaretPosition({ offset = 0 } = {}) {
    let position = this.#editorCaretPosition + offset;
    if (position > this.target.textContent.length) {
      position = this.target.textContent.length;
    }
    Cursor.setCurrentCursorPosition(position, this.target);
  }

  #storeLastCaretPosition(
    paragraph = helper.currentBlockWithCaret(),
    offset = 0,
  ) {
    if (!paragraph) {
      console.debug?.("no element with current caret");
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
      console.debug?.("no element with current caret");
      return;
    }
    const caretPosition = this.#caretPosition.pop();
    Cursor.setCurrentCursorPosition(caretPosition + offset, paragraph);
    return caretPosition;
  }

  #updateAllVisibleElements() {
    const visibleElements = this.#visibleChildren();
    md2html.addCodeBlockClasses(this.allChildren(), document);
    this.#renderParagraphBlocks(visibleElements, document);
  }

  #addCssClassToBlockWithCaret() {
    let current = null;
    try {
      current = helper.currentBlockWithCaret();
      if (!current) return;
    } catch (e) {
      if (helper.isFirefox()) {
        console.info(e);
      } else {
        console.warn(e);
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
      current.textContent.trim() === "" &&
      md2html.EMPTY_LINE_HTML_PLACEHOLDER &&
      helper.isFirefox()
    ) {
      current.innerHTML = md2html.EMPTY_LINE_HTML_PLACEHOLDER;
    }
  }

  set placeholder(placeholder) {
    this.#placeholder = placeholder;
    this.#checkPlaceholder();
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

  set readonly(value) {
    this.#readonly = !!value;
    this.target.contentEditable = !this.#readonly;
  }

  set focus(value) {
    if (!value) {
      return;
    }
    this.target.blur();
    this.target.focus();
    // this.target.click();
    this.#addCssClassToBlockWithCaret();
  }

  set target(value) {
    this.#target = value;
    this.#target.contentEditable = !this.#readonly;
    this.#target.classList.add("focus-editor");
    this.#target.contentEditable = true;
    this.#target.setAttribute("role", "textbox");
    this.#target.setAttribute("aria-multiline", "true");
    this.#target.addEventListener("keyup", (ev) => this.#onKeyUp(ev));
    this.#target.addEventListener("keydown", (ev) => this.#onKeyDown(ev));
    this.#target.addEventListener("click", (ev) => this.#onClick(ev));
    this.#target.addEventListener("paste", (ev) => this.#onPaste(ev));
    this.#target.addEventListener("copy", (ev) => this.#onCopy(ev));
    this.#target.addEventListener("blur", (ev) => this.#onBlur(ev));
    this.#target.addEventListener("input", (ev) => this.#onInput(ev));
    this.#target.parentElement.addEventListener("scroll", (ev) =>
      this.#onScroll(ev, this),
    );
  }

  get target() {
    return this.#target;
  }

  #customTabBehaviour(event) {
    if (!this.#tabSize > 0 && this.#tabSize !== "\t") return;

    event.preventDefault();
    const current = helper.currentBlockWithCaret();
    this.#storeLastCaretPosition();

    const caretPosition = Cursor.getCurrentCursorPosition(
      helper.currentBlockWithCaret(),
    );

    if (this.#tabSize === "\t") {
      if (event.shiftKey) {
        if (current.textContent.substring(0, caretPosition).trim() === "") {
          current.innerHTML = current.innerHTML.replace(/^(\t){1}/, "");
          this.#restoreLastCaretPosition(helper.currentBlockWithCaret(), {
            offset: -1,
          });
        }
        return;
      } else {
        if (caretPosition === 0) {
          current.innerHTML = "\t" + current.innerHTML;
        } else {
          current.textContent =
            current.textContent.substring(0, caretPosition) +
            "\t" +
            current.textContent.substring(caretPosition);
        }
        this.#restoreLastCaretPosition(helper.currentBlockWithCaret(), {
          offset: 1,
        });
      }
      return;
    }

    if (event.shiftKey) {
      current.innerHTML = current.innerHTML.replace(
        new RegExp(`^(&nbsp;| ){1,${this.#tabSize}}`),
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

  #checkPlaceholder() {
    if (!this.target.querySelector(".block")) {
      let div = document.createElement("div");
      div.classList.add("block");
      div.textContent = this.target.textContent;
      this.target.textContent = "";
      this.target.appendChild(div);
      this.#updateAllVisibleElements();
    }

    if (!this.#placeholder) {
      return;
    }

    // for aesthetic reasons: add a small delay to ensure the placeholder is removed before checking if the editor is empty (sometimes the editor is not empty yet during check)
    setTimeout(() => {
      this.target
        .querySelectorAll(".block[data-placeholder]")
        .forEach((el) => delete el.dataset.placeholder);
      if (
        this.target.textContent === "" &&
        this.target.querySelectorAll(".block").length === 1
      ) {
        this.target.querySelector(".block").dataset.placeholder =
          this.#placeholder;
      }
    }, 1);
  }

  #onCopy(event) {
    event.preventDefault();
    const selection = document.getSelection();
    const copiedText = selection.toString().replace(/\xA0/g, " ");
    event.clipboardData.setData("text/plain", copiedText);
  }

  #onPaste(event) {
    let pasteText = (event.clipboardData || window.clipboardData).getData(
      "text",
    );

    const selection = window.getSelection();
    if (!selection.rangeCount) return false;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(pasteText));
    this.#textUndo.add(this.getMarkdown());
    this.#dispatchInputEvent();

    event.preventDefault();
    setTimeout(async () => {
      this.fullRefresh();
      let offset = this.target.textContent.length - this.#textLengthOnKeyDown;

      this.#restoreEditorCaretPosition({
        offset,
      });
    }, 1);
  }

  #onBlur() {
    this.#checkPlaceholder();
  }
  #onInput(ev) {
    /*
      Safari Bug: When pasting text fro autosuggestion, safari sometimes adds a leadinng Whitespace
      -> remove leading whitespace then
    */
    if (helper.isSafari() && helper.isTouchDevice() && ev.data) {
      let current = helper.currentBlockWithCaret();
      if (
        current &&
        ev.data.length > 1 &&
        ev.data.startsWith(" ") &&
        ev.data === current.textContent
      ) {
        current.textContent = current.textContent.trimStart();
        // set cursor back to end position
        Cursor.setCurrentCursorPosition(current.textContent.length, current);
      }
    }
    this.#checkPlaceholder();
  }

  #onClick(event) {
    this.#addCssClassToBlockWithCaret();
    if (event.isTrusted) {
      this.#checkPlaceholder();
    }
  }

  #onScroll() {
    this.#updateAllVisibleElements();
  }

  #isUndoEnabled() {
    return this.#maxUndoSteps && this.#maxUndoSteps > 0;
  }

  #onKeyDown(event) {
    this.#checkPlaceholder();
    this.#addCssClassToBlockWithCaret();

    const currentParagraph = helper.currentBlockWithCaret();

    if (event.key === "Enter" && !event.shiftKey && currentParagraph) {
      if (this.#onHittingEnter) {
        event.preventDefault();
        this.#onHittingEnter(event, currentParagraph);
      }
      return;
    }

    if (helper.isSafari() && this.target.textContent === "") {
      if (
        event.key === "Backspace" ||
        (event.key.metaKey && event.key === "x")
      ) {
        // Prevents safaris' incorrect behaviour:
        // Removing all text causes setting caret out of blocks after
        event.preventDefault();
        setTimeout(() => {
          let block = this.target.querySelector(".block");
          if (!block) return;
          FocusEditorCore.#activateElementWithClickFocusAndCaret(block);
        }, 10);
        return;
      }
    }

    if (
      event.key === "Backspace" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      if (this.#onHittingBackspace(event, currentParagraph)) {
        this.#onHittingBackspace(event, currentParagraph);
        return;
      }
    }

    if (
      this.#isUndoEnabled() &&
      (event.metaKey || event.ctrlKey) &&
      event.key === "z"
    ) {
      if (event.shiftKey) {
        this.#redoStep(event);
      } else {
        this.#undoStep(event);
      }
      return;
    }

    this.#storeEditorCaretPosition();

    this.#textLengthOnKeyDown = this.target.textContent.length;

    if ((event.ctrlKey || event.metaKey) && event.key === "x") {
      if (
        currentParagraph?.nextElementSibling &&
        !window.getSelection().toString()
      ) {
        // copy text and remove it
        if (currentParagraph.textContent.trim() !== "") {
          navigator.clipboard.writeText(currentParagraph.textContent);
        }
        Cursor.setCurrentCursorPosition(0, currentParagraph.nextElementSibling);
        currentParagraph.remove();
      }
    }

    if ((event.ctrlKey && event.altKey) || (event.altKey && event.shiftKey)) {
      for (let name in this.#keyboardShortcuts) {
        if (this.#keyboardShortcuts[name].accessKey === event.code) {
          this.#keyboardShortcuts[name].handler(event);
          event.preventDefault();
          return;
        }
      }
    }

    this.#checkPlaceholder();

    if (event.key === "Tab") {
      if (this.#customTabBehaviour) {
        this.#customTabBehaviour(event);
        return;
      }
    }
  }

  #onKeyUp(event) {
    if (event.isComposing) {
      return;
    }

    this.#checkPlaceholder();

    if (!document.fullscreenElement) {
      this.target.parentElement.classList.remove("zen-mode");
    }

    const currentParagraph = helper.currentBlockWithCaret();

    if (this.#maxUndoSteps && this.#maxUndoSteps > 0) {
      this.__addUndoStepDebounced(currentParagraph);
    }

    const selectionRange = Math.abs(
      window.getSelection().extentOffset - window.getSelection().baseOffset,
    );

    let textIsSelectedInBlock =
      selectionRange > 0 &&
      (window
        .getSelection()
        .baseNode?.parentNode?.classList?.contains("block") ||
        window
          .getSelection()
          .baseNode?.parentNode?.closest(".focus-editor[contenteditable]"))
        ? true
        : false;

    if (
      helper.isFirefox() &&
      window.getSelection().extentOffset === undefined
    ) {
      textIsSelectedInBlock = window.getSelection().toString().length > 0;
    }

    if (textIsSelectedInBlock) {
      return;
    }

    if (
      helper.isFirefox() &&
      this.target.textContent.trim() !== "" &&
      this.target.querySelectorAll(".block").length === 1 &&
      this.target.querySelector(".block").textContent.trim() === ""
    ) {
      /* Firefox Bug (2): When selecting all text and clean it, not div is there anymore */
      this.fullRefresh();
      Cursor.setCurrentCursorPosition(
        this.target.textContent.length,
        this.target.querySelector(".block"),
      );
    }

    this.#addCssClassToBlockWithCaret();

    if (!currentParagraph) {
      /**
       * Firefox Bug: When selecting text and clean it, the text might be outside of any div
       */
      if (helper.isFirefox()) {
        let divs = this.target.querySelectorAll("div:not(.block)");
        if (divs.length > 0) {
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
            div.textContent = el.textContent || "";
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

    this.#storeLastCaretPosition(helper.currentBlockWithCaret());

    if (currentParagraph.textContent.trim() === "") {
      /* BUG: browsers have problems with cursor position on empty paragraphs */
      return;
    }

    if (event.key !== "Enter") {
      if (this.#hasManyElements()) {
        this.__renderMarkdownToHtmlDebounced ||= helper.debounce(() => {
          this.#storeLastCaretPosition();
          this.#updateAllVisibleElements();
          this.#restoreLastCaretPosition();
        }, 200);
        this.__renderMarkdownToHtmlDebounced();
        return;
      }

      md2html.addCodeBlockClasses(this.allChildren(), document);
      this.#renderParagraphBlocks([currentParagraph], document);

      this.#updateAllVisibleElements();
      this.#restoreLastCaretPosition();
    }
  }

  static #activateElementWithClickFocusAndCaret(el) {
    el.click();
    el.focus();
    Cursor.setCurrentCursorPosition(el.textContent.length, el);
  }

  #onHittingBackspace(event, current) {
    /* fixes caret jumping on backspace on blocks which where created outside view scope */
    let cursorPosition = Cursor.getCurrentCursorPosition(current);

    if (cursorPosition === 0 && current.previousElementSibling) {
      let prev = current.previousElementSibling;
      let pos = prev.textContent.length;
      setTimeout(
        () => {
          Cursor.setCurrentCursorPosition(pos, prev);
        },
        helper.isTouchDevice() ? 20 : 5,
      );
    }
  }

  #onHittingEnter(event, current) {
    const div = document.createElement("div");
    div.innerHTML = md2html.EMPTY_LINE_HTML_PLACEHOLDER;
    div.setAttribute("class", "block");
    const cursorPosition = Cursor.getCurrentCursorPosition(current);

    let previousElement = current.previousElementSibling;
    const textSplits = [];

    const setCursorToNewPositionAndUpdate = () => {
      if (!current) current = helper.currentBlockWithCaret();
      this.#updateAllVisibleElements();
      // timeout because: if the block is not fully visible yet the cursor may not be in the correct position
      setTimeout(() => {
        Cursor.setCurrentCursorPosition(
          textSplits[1]?.length > 0
            ? current.textContent.length - textSplits[1].length
            : current.textContent.length,
          current,
        );
      }, 1);
    };

    if (cursorPosition === 0) {
      current.before(div);
      Cursor.setCurrentCursorPosition(0, current);
      if (current.classList.contains("code-block")) {
        this.#updateAllVisibleElements();
      }
      if (
        this.#scrollIntoViewOptions &&
        (!helper.isElementVisible(current, this.target) ||
          !helper.elementIsVisible(current))
      ) {
        current.scrollIntoView(this.#scrollIntoViewOptions);
      }
      return;
    }

    if (cursorPosition < current.textContent.length) {
      // split text
      let text = current.textContent;
      textSplits[0] = text.substr(0, cursorPosition);
      textSplits[1] = text.substr(cursorPosition);
      current.textContent = textSplits[0];
      div.textContent = textSplits[1];
    }
    current.after(div);
    if (
      current.classList.contains("code-block") &&
      !current.classList.contains("code-block-end")
    ) {
      div.classList.add("code-block");
    }
    previousElement = current;
    Cursor.setCurrentCursorPosition(0, div);
    current = div;

    if (!current) current = helper.currentBlockWithCaret();
    if (!current) return;

    if (
      this.#scrollIntoViewOptions &&
      (!helper.isElementVisible(current, this.target) ||
        !helper.elementIsVisible(current))
    ) {
      current.scrollIntoView(this.#scrollIntoViewOptions);
    }

    if (current.classList.contains("code-block")) {
      this.#updateAllVisibleElements();
      return;
    }

    if (this.target.parentElement.getAttribute("autocomplete") === "off") {
      return;
    }

    /* AUTOCOMPLETE (list items) */

    const previousAutocompletePattern =
      previousElement.dataset?.autocompletePattern || "";
    const insertedElementText = current.textContent;
    const previousText = textSplits[0] || previousElement.textContent;

    const lineBeginsWithUnorderedList = /^(\s*[-–*•+]\s+|>+\s*)(.*)$/;
    const lineBeginsWithOrderedList = /^(\s*)(\d+)(\.|\.\)|\))\s.+/;

    let matches = previousText.match(lineBeginsWithUnorderedList);

    if (matches && matches[1]) {
      let previousTextTrimmed = insertedElementText
        .replace(lineBeginsWithUnorderedList, "" + (textSplits[1] || ""))
        .trim();
      current.textContent = matches[1] + previousTextTrimmed;

      if (previousText === matches[1]) {
        current.textContent = previousTextTrimmed || "";
        previousElement.textContent = "";
        this.#updateAllVisibleElements();
        return;
      }
      current.dataset.autocompletePattern = lineBeginsWithUnorderedList;
      setCursorToNewPositionAndUpdate();
    } else {
      matches = (textSplits[0] || previousText).match(
        lineBeginsWithOrderedList,
      );
      if (matches && matches[2] && matches[3]) {
        let autocompleteText =
          (matches[1] || "") +
          (Number(matches[2].trim()) + 1) +
          matches[3] +
          " ";
        let previousTextTrimmed = insertedElementText
          .replace(lineBeginsWithOrderedList, "")
          .trim();
        current.textContent = autocompleteText + previousTextTrimmed;
        if (
          previousAutocompletePattern &&
          previousElement.textContent === current.textContent
        ) {
          current.textContent = previousTextTrimmed || "";
          previousElement.textContent = "";
          return;
        }
        current.dataset.autocompletePattern = lineBeginsWithOrderedList;
      } else if (
        previousElement.textContent &&
        previousElement.dataset.autocompletePattern &&
        !current.textContent.match(
          new RegExp(previousElement.dataset.autocompletePattern.slice(1, -1)),
        )
      ) {
        previousElement.textContent = "";
        delete previousElement.dataset.autocompletePattern;
        delete current.dataset.autocompletePattern;
        return;
      }
      setCursorToNewPositionAndUpdate();
    }
    delete previousElement.dataset.autocompletePattern;
  }

  #dispatchInputEvent() {
    this.target.parentElement.dispatchEvent(new InputEvent("input"));
  }

  #undoStep(event) {
    event.preventDefault();
    const { text } = this.#textUndo.undo();
    if (text === undefined) {
      return;
    }

    let caretPosition =
      this.#textUndo.previous()?.additionalData?.caretPosition;

    if (caretPosition) {
      caretPosition = caretPosition + 2;
    }

    this.replaceText(text, { dontAddToHistory: true });
    this.#dispatchInputEvent();
    setTimeout(() => {
      // restore caret
      if (caretPosition === undefined) {
        return;
      }
      Cursor.setCurrentCursorPosition(caretPosition, this.target);
      this.#scrollCurrentParagraphIntoView();
    }, 10);
  }

  #addUndoStep(currentParagraph) {
    this.#textUndo.maxSteps = this.#maxUndoSteps;
    this.#textUndo.add(
      this.getMarkdown(),
      currentParagraph?.parentNode
        ? {
            caretPosition: Cursor.getCurrentCursorPosition(this.target),
          }
        : {},
    );
  }

  #redoStep(event) {
    event.preventDefault();
    const { text, additionalData } = this.#textUndo.redo();
    if (text === undefined) {
      return;
    }
    this.replaceText(text, { dontAddToHistory: true });
    this.#dispatchInputEvent();
    setTimeout(() => {
      // restore caret
      Cursor.setCurrentCursorPosition(
        additionalData.caretPosition + 2,
        this.target,
      );
      this.#scrollCurrentParagraphIntoView();
    }, 10);
  }

  #scrollCurrentParagraphIntoView() {
    if (!this.#scrollIntoViewOptions) {
      return;
    }
    let current = this.currentBlockWithCaret();
    if (!current) {
      return;
    }
    current.scrollIntoView(this.#scrollIntoViewOptions);
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
        this.#renderParagraphBlocks([div.previousElementSibling], document);
      }
      this.#updateAllVisibleElements();
      return;
    }

    let last = this.target.querySelector(".block:last-child");
    last.textContent += char;
    this.#renderParagraphBlocks([last], document);
  }
}

export default FocusEditorCore;
