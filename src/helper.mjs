/**
 * Helper module.
 *
 * ** Not for public use: any function name may change at any time. **
 * @module helper
 */

export function currentElementWithCaret() {
  // https://stackoverflow.com/a/34809030/728804
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

export function currentBlockWithCaret() {
  return currentElementWithCaret().closest(".block");
}

export function elementIsVisible(
  el,
  {
    offsetTop = -1000,
    offsetBottom = -1000,
    offsetLeft = 0,
    offsetRight = 0,
  } = {},
) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 + offsetTop &&
    rect.left >= 0 + offsetLeft &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) -
        offsetBottom &&
    rect.right <=
      (window.innerWidth || document.documentElement.clientWidth) - offsetRight
  );
}

export function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function isFirefox() {
  return /firefox/i.test(navigator.userAgent);
}

export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints;
}

export function whiteSpaceWorkaround() {
  return isFirefox() ? "<br>" : "";
}

/*
 * Escapes HTML entities ("stolen" from lodash)
 * @param {string} string
 * @returns {string}
 */
export function escapeHTMLEntities(string) {
  function basePropertyOf(object) {
    return function (key) {
      return object == null ? undefined : object[key];
    };
  }
  const escapeHtmlChar = basePropertyOf({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  });
  return string.replace(/[&<>"']/g, escapeHtmlChar);
}

export function removeFirstLineBreak(text) {
  if (text.split(/\n/)[0] === "") {
    return text.replace(/^\n/, "");
  }
  return text;
}

export function removeStyleAttributeRecursively(el) {
  el.removeAttribute("style");
  el.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
}

export function htmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText;
}

export function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    let context = this;
    let args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }, wait);
    if (immediate && !timeout) func.apply(context, args);
  };
}
