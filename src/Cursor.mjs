/**
 * Cursor module
 *
 * Credit to Liam (Stack Overflow): https://stackoverflow.com/a/41034697/3480193
 *
 * ** Not for public use: any function name may change at any time. **
 * @module Cursor
 */

class Cursor {
  static getCurrentCursorPosition(parentElement) {
    var selection = window.getSelection(),
      charCount = -1,
      node;

    if (selection.focusNode) {
      if (Cursor._isChildOf(selection.focusNode, parentElement)) {
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

      let range = Cursor._createRange(element, { count: chars });

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
        top: rect.bottom + pageOffset.y,
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
      top: clone.toString().length,
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
          range = Cursor._createRange(node.childNodes[lp], chars, range);

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
}

export default Cursor;
