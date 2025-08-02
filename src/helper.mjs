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

  return range.startContainer.parentNode;
}

export function currentBlockWithCaret() {
  return currentElementWithCaret().closest(".block");
}

export function elementIsVisible(
  el,
  {
    offsetTop = 0,
    offsetBottom = 0,
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

export function isElementVisible(element, container = null) {
  if (!container) {
     return !!( element.offsetWidth || element.offsetHeight || element.getClientRects().length );
  }
  const elRect = element.getBoundingClientRect();
  const conRect = container.getBoundingClientRect();

  if (
    elRect.x >= conRect.x &&
    elRect.y >= conRect.y &&
    elRect.x + elRect.width <= conRect.x + conRect.width &&
    elRect.y + elRect.height <= conRect.y + conRect.height
  ) {
    return true;
  }

  return false;
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
  return "<br>";
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

export function stripHtml(html) {
  let tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
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

/* from: https://gist.github.com/codeguy/6684588 */
export function slugify(str) {
  str = str.replace(/^\s+|\s+$/g, ""); // trim
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to = "aaaaeeeeiiiioooouuuunc------";
  for (var i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), "g"), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-"); // collapse dashes

  return str;
}
