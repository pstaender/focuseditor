import * as md2html from "./md2html.mjs";
import * as helper from "./helper.mjs";
import BrowserFixes from "./BrowserFixes.mjs";
import Cursor from "./Cursor.mjs";
import UndoText from "./UndoText.mjs";

/** Focus Editor Core class creates the editable content element and manages all its' changes on the text */
class FocusEditorCore {
  #debug = false;
  #readonly = false;
  #tabSize = 0;
  #caretPosition = [];
  #editorCaretPosition = 0;
  #textLengthOnKeyDown = 0;
  #placeholder = "";
  #maxUndoSteps = 200;
  #textUndo = new UndoText();

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
        } else {
          this.target.parentElement.setAttribute("focus", "paragraph");
        }
      },
      accessKey: "KeyX",
    },
    images: {
      handler: (ev) => {
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

    this.#prepareTargetHTMLElement(initialText);
  }

  /**
   * Replaces the current text with new text
   * @param {string} text
   */
  replaceText(text, { clearHistory = false } = {}) {
    this.target.innerHTML = md2html.innerTextToHtml(text, document);
    this.#updateChildrenElementsWithMarkdownClasses();
    this.#addCssClassToBlockWithCaret();
    this.target.parentElement.scroll({ top: 0 });
    this.target.focus();
    this.target.click();
    if (clearHistory) {
      this.#textUndo.clear();
    } else {
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
    return [...this.allChildren()].filter((el) => helper.elementIsVisible(el));
  }

  /**
   * (Re)renders markdown.
   * Can be helpfull if not all elements are updated correctly.
   * Triggering refresh may change the caret position as well.
   */
  refresh() {
    let cursor = Cursor.getCurrentCursorPosition(this.target);
    const lengthBefore = this.target.innerText.length;

    this.replaceText(this.getMarkdown());

    const diffCursorPosition = lengthBefore - this.target.innerText.length;

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

  /**
   * Returns the plain text.
   * @returns {string} plain text
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
      .forEach((el) => text.push(String(el.innerText).replace(/\n+$/, "")));

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
      document,
    );
    this.#updateChildrenElementsWithMarkdownClasses();

    this.target.classList.add("focus-editor");
    this.target.contentEditable = true;
    this.target.addEventListener("keyup", (ev) => this.#onKeyUp(ev, this));
    this.target.addEventListener("keydown", (ev) => this.#onKeyDown(ev, this));
    this.target.addEventListener("click", (ev) => this.#onClick(ev, this));
    this.target.addEventListener("paste", (ev) => this.#afterPaste(ev, this));
    this.target.parentElement.addEventListener("scroll", (ev) =>
      this.#onScroll(ev, this),
    );
  }

  #hasManyElements() {
    return this.allChildren().length > 700;
  }

  #updateChildrenElementsWithMarkdownClasses() {
    let children = this.allChildren();
    this._warnedAboutTooManyChildren = false;
    md2html.addCodeBlockClasses(children, document);
    md2html.addParagraphClasses(children, document);

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
    const visibleElements = this.#visibleChildren();
    md2html.addCodeBlockClasses(this.allChildren(), document);
    md2html.addParagraphClasses(visibleElements, document);
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
    this.target.focus();
    this.target.click();
    this.#addCssClassToBlockWithCaret();
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

  #checkPlaceholder() {
    if (!this.#placeholder) {
      return;
    }
    if (!this.target.querySelector(".block")) {
      return;
    }
    if (this.target.innerText.length === 0 || this.target.innerText === "\n") {
      this.target.querySelector(".block").dataset.placeholder =
        this.#placeholder;
    } else {
      this.target
        .querySelectorAll(".block[data-placeholder]")
        .forEach((el) => delete el.dataset.placeholder);
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
    if (event.isTrusted) {
      this.#checkPlaceholder();
    }
  }

  #onScroll(event, editor) {
    this.#updateAllVisibleElements();
  }

  #isUndoEnabled() {
    return this.#maxUndoSteps && this.#maxUndoSteps > 0;
  }

  #onKeyDown(event, editor) {
    editor.#debugLog("onKeyDown", event.key);

    if (event.key === "Enter" && !event.shiftKey) {
      const currentParagraph = helper.currentBlockWithCaret();
      if (currentParagraph) {
        if (this.#onHittingEnter) {
          event.preventDefault();
          this.#onHittingEnter(event, currentParagraph);
        }
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

    this.#textLengthOnKeyDown = this.target.innerText.length;

    this.#addCssClassToBlockWithCaret();

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

  #onKeyUp(event, editor) {
    editor.#debugLog("onKeyUp", event.key);

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

    if (event.key === "Enter") {
      // Browser blindly copies all classes to new created element: we are removing them here
      // if (currentParagraph) {
      //   this.POSSIBLE_BLOCK_CLASSES.forEach((tagName) =>
      //     currentParagraph.classList.remove(tagName),
      //   );
      //   currentParagraph.classList.add("block");

      //   if (currentParagraph.previousSibling.classList.contains("code-block")) {
      //     if (
      //       !currentParagraph.previousSibling.classList.contains(
      //         "code-block-end",
      //       ) ||
      //       currentParagraph.innerText.endsWith("```")
      //     ) {
      //       currentParagraph.classList.add("code-block");
      //     }
      //   }
      // }

      return;
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

    this.#storeLastCaretPosition(helper.currentBlockWithCaret());

    if (currentParagraph.innerText.trim() === "") {
      /* BUG: browsers have problems with cursor position on empty paragraphs */
      return;
    }

    if (event.key !== "Enter") {
      if (this.#hasManyElements()) {
        this.__renderMarkdownToHtmlDebounced ||= helper.debounce(() => {
          this.#storeLastCaretPosition();
          this.#updateAllVisibleElements();
          this.#restoreLastCaretPosition();
        }, 350);
        this.__renderMarkdownToHtmlDebounced();
        return;
      }

      md2html.addParagraphClasses([currentParagraph], document);
      md2html.addCodeBlockClasses(this.allChildren(), document);

      this.#updateAllVisibleElements();
      this.#restoreLastCaretPosition();
    }
  }

  static #activateElementWithClickFocusAndCaret(el) {
    el.click();
    el.focus();
    Cursor.setCurrentCursorPosition(el.innerText.length, el);
  }

  #onHittingEnter(event, current) {
    const div = document.createElement("div");
    div.innerHTML = "";
    div.setAttribute("class", "block");
    const cursorPosition = Cursor.getCurrentCursorPosition(current);

    let previousElement = current.previousElementSibling;

    if (cursorPosition === 0) {
      current.before(div);
      Cursor.setCurrentCursorPosition(0, current);
      if (current.classList.contains("code-block")) {
        this.#updateAllVisibleElements();
      }
      return;
    } else {
      if (cursorPosition < current.innerText.length) {
        // split text
        let text = current.innerText;
        current.innerText = text.substr(0, cursorPosition);
        div.innerText = text.substr(cursorPosition);
      }
      current.after(div);
      previousElement = current;
      Cursor.setCurrentCursorPosition(0, div);
      current = div;
    }

    if (!current) current = helper.currentBlockWithCaret();
    if (!current) return;
    if (current.classList.contains("code-block")) {
      this.#updateAllVisibleElements();
      return;
    }

    if (this.target.parentElement.getAttribute("autocomplete") === "off") {
      return;
    }

    const setCursorToEndAndUpdate = () => {
      if (!current) current = helper.currentBlockWithCaret();

      this.#updateAllVisibleElements();
      // setTimeout(() => {
        Cursor.setCurrentCursorPosition(current.innerText.length, current);
      // }, 1);
    };

    const previousAutocompletePattern =
      previousElement.dataset?.autocompletePattern || "";
    const insertedElementText = current.innerText;
    const previousText = previousElement.innerText;

    const lineBeginsWithUnorderedList =
      /^(\s*-\s+|\s*\*\s+|\s*•\s+|\s*\*\s+|\s*\+\s+|\>+\s*)(.*)$/;
    const lineBeginsWithOrderedList = /^(\s*)(\d+)(\.|\.\)|\))\s.+/;

    let matches = previousText.match(lineBeginsWithUnorderedList);

    if (matches && matches[1]) {
      let previousTextTrimmed = insertedElementText
        .replace(lineBeginsWithUnorderedList, "")
        .trim();
      current.innerText = matches[1] + previousTextTrimmed;
      if (
        previousAutocompletePattern &&
        previousElement.innerText === matches[1]
      ) {
        current.innerText = previousTextTrimmed || "";
        previousElement.innerText = "";
        this.#updateAllVisibleElements();
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
          previousElement.innerText === current.innerText
        ) {
          current.innerText = previousTextTrimmed || "";
          previousElement.innerText = "";
          return;
        }
        setCursorToEndAndUpdate();
        current.dataset.autocompletePattern = autocompleteText;
        // TODO: cleanup dataset.autocompletePattern afterwards
      }
    }
    // this.#updateAllVisibleElements()
  }

  #dispatchInputEvent() {
    this.target.parentElement.dispatchEvent(new InputEvent("input"));
  }

  #undoStep(event) {
    event.preventDefault();
    let undo = this.#textUndo.undo();
    if (!undo) {
      return;
    }

    this.replaceText(undo.text);
    this.#dispatchInputEvent();
    // restore caret
    const { currentParagraphCaret, currentParagraphIndex } =
      undo.additionalData;
    if (
      currentParagraphCaret !== undefined &&
      currentParagraphIndex !== undefined
    ) {
      setTimeout(() => {
        let currentParagraph = this.target.children[currentParagraphIndex];

        if (currentParagraph) {
          Cursor.setCurrentCursorPosition(
            currentParagraphCaret,
            currentParagraph,
          );
        } else {
          currentParagraph = this.target.children[this.target.children.length];
        }
        Cursor.setCurrentCursorPosition(
          currentParagraphCaret,
          currentParagraph,
        );
      }, 1);
    }
  }

  #addUndoStep(currentParagraph) {
    //#maxUndoSteps
    this.#textUndo.add(
      this.getMarkdown(),
      currentParagraph?.parentNode
        ? {
            currentParagraphCaret:
              Cursor.getCurrentCursorPosition(currentParagraph),
            currentParagraphIndex: Array.from(
              currentParagraph.parentNode.children,
            ).indexOf(currentParagraph),
          }
        : {},
    );
  }

  #redoStep(event) {
    event.preventDefault();
    let redo = this.#textUndo.redo();
    if (!redo) {
      return;
    }
    this.replaceText(redo.text);
    this.#dispatchInputEvent();
    // restore caret
    const { currentParagraphCaret, currentParagraphIndex } =
      redo.additionalData;
    if (
      currentParagraphCaret !== undefined &&
      currentParagraphIndex !== undefined
    ) {
      const currentParagraph = this.target.children[currentParagraphIndex];
      if (currentParagraph) {
        Cursor.setCurrentCursorPosition(
          currentParagraphCaret,
          currentParagraph,
        );
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
        md2html.addParagraphClasses([div.previousElementSibling], document);
      }
      this.#updateAllVisibleElements();
      return;
    }

    let last = this.target.querySelector(".block:last-child");
    last.innerText += char;
    md2html.addParagraphClasses([last], document);
  }
}

export default FocusEditorCore;
