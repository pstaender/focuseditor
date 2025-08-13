import FocusEditorCore from "./FocusEditorCore.mjs";
import { debounce } from "./helper.mjs";

/** FocusEditorWebComponent replaces a given HTML element with a editable foxus editor element */
class FocusEditorWebComponent extends HTMLElement {
  static observedAttributes = [
    "scroll",
    "name",
    "tab-size",
    "buttons",
    "placeholder",
    "autofocus",
    "readonly",
  ];

  editor = null;

  constructor() {
    super();

    function removeLeadingWhitespaces(text) {
      text = text.replace(/\r/g, "\n");
      const firstLine = text.split("\n").filter((t) => t.length > 0)[0];
      const initialSpace = firstLine
        ? firstLine.match(/^\s+/)
          ? firstLine.match(/^\s+/)[0]?.length
          : 0
        : 0;
      if (initialSpace === 0) {
        return text;
      }
      return text
        .split("\n")
        .map((l) => l.replace(new RegExp(`^\\s{${initialSpace}}`), ""))
        .join("\n");
    }

    const div = document.createElement("div");
    let text =
      this.getAttribute("value") ||
      removeLeadingWhitespaces(this.textContent.replace(/\n\s+$/, ""));

    if (
      this.childElementCount &&
      this.firstElementChild.tagName === "TEXTAREA"
    ) {
      this.classList.add("textarea");

      if (
        !this.getAttribute("name") &&
        this.firstElementChild.getAttribute("name")
      ) {
        this.setAttribute("name", this.firstElementChild.getAttribute("name"));
      }
      if (
        !this.getAttribute("id") &&
        this.firstElementChild.getAttribute("id") !== null
      ) {
        this.setAttribute("id", this.firstElementChild.getAttribute("id"));
      }

      this.#syncValueForTextareaElementDebounced();
    }

    this.innerText = "";
    this.appendChild(div);

    this.editor = new FocusEditorCore(div, text.trim() === "" ? "" : text);

    if (this.hasAttribute("autofocus")) {
      this.editor.focus = true;
    }
    this.editor.tabSize = this.getAttribute("tab-size");
    if (this.hasAttribute("placeholder")) {
      this.editor.placeholder = this.getAttribute("placeholder");
    }

    this.addEventListener("input", () =>
      this.#syncValueForTextareaElementDebounced(),
    );
    this.addEventListener("keydown", () =>
      this.#syncValueForTextareaElementDebounced(),
    );
    this.addEventListener("keyup", () =>
      this.#syncValueForTextareaElementDebounced(),
    );
  }

  #syncValueForTextareaElement = (inputName = this.getAttribute("name")) => {
    if (!inputName) {
      return;
    }
    let textArea = this.querySelector(`textarea[name="${inputName}"]`);
    if (!textArea) {
      textArea = document.createElement("textarea");
      textArea.name = inputName;
      this.appendChild(textArea);
    }
    if (textArea.placeholder) {
      this.setAttribute('placeholder', textArea.placeholder);
      this.editor.placeholder = textArea.placeholder;
    }
    textArea.innerText = this.value;
  };

  #syncValueForTextareaElementDebounced = debounce(
    this.#syncValueForTextareaElement,
    10,
  );

  set value(text) {
    this.editor.replaceText(text, { clearHistory: true });
  }

  get value() {
    return this.editor.getMarkdown();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "tab-size") {
      this.editor.tabSize = newValue;
    }
    if (name === "readonly") {
      this.editor.readonly = newValue != "true";
    }
    if (name === "placeholder") {
      this.editor.placeholder = newValue;
    }
    if (name === "name") {
      this.#syncValueForTextareaElement(newValue);
    }
  }
}

export default FocusEditorWebComponent;
