import FocusEditorWebComponent from "./FocusEditorWebComponent.mjs";
import FocusEditorCore from "./FocusEditorCore.mjs";

export function registerFocusEditorWebComponent() {
  if (!customElements.get('focus-editor')) {
    customElements.define("focus-editor", FocusEditorWebComponent);
  } else {
    console.warn("element 'focus-editor' is already defined");
  }
}

/**
 * Initializes the FocusEditor component.
 *
 * The following possibilities are supported:
 * - Many elements or array of elements: Replaces each element with a FocusEditorWebComponent and returns the FocusEditorWebComponent class.
 * - Single element: Replaces the element with a FocusEditorWebComponent and returns the FocusEditorWebComponent class.
 * - Else: returns the FocusEditorCore class
 *
 * @param {HTMLElement|Array<HTMLElement>|NodeList|...any} args - The arguments to initialize the component.
 * @returns {object|FocusEditorCore}
 */
export function init(...args) {
  registerFocusEditorWebComponent();
  if (args.length === 0) {
    return {
      FocusEditorCore,
      FocusEditorWebComponent,
    };
  }
  if (typeof args[0].forEach === "function") {
    args[0].forEach((e) => {
      let fe = new FocusEditorWebComponent();
      fe.value = e.value || e.innerText;
      e.replaceWith(fe);
    });
    return {
      FocusEditorCore,
      FocusEditorWebComponent,
    };
  }
  if (typeof args[0].tagName === "string") {
    let fe = new FocusEditorWebComponent();
    fe.value =
      args[1] !== undefined ? args[1] : args[0].value || args[0].innerText;
    args[0].replaceWith(fe);
    return {
      FocusEditorCore,
      FocusEditorWebComponent,
    };
  }
  return FocusEditorCore(...args);
}

export default init;

export function textareasAsFocusEditor(selector = "textarea") {
  registerFocusEditorWebComponent();
  document.querySelectorAll(selector).forEach((textarea) => {
    const fe = new FocusEditorWebComponent();
    fe.value = textarea.value || textarea.innerContent;
    for (let attr of [...textarea.attributes]) {
      fe.setAttribute(attr.name, textarea.getAttribute(attr.name));
    }
    fe.classList.add("textarea");
    textarea.replaceWith(fe);
  });
}

globalThis.initFocusEditor = init;
