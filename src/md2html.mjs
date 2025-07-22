/**
 * Module to help converting commonmark to html for the editor.
 * All methods are exclusively used by the FocusEditorCore class.
 *
 * ** Not for public use: any function name may change at any time. **
 * @module md2html
 */

import * as helper from "./helper.mjs";

export const EMPTY_LINE_HTML_PLACEHOLDER = `<br>`;

export function innerTextToHtml(text) {
  text = text.replace(/\r/g, "\n");
  const firstLine = text.split("\n").filter((t) => t.length > 0)[0];
  const initialSpace = firstLine
    ? firstLine.match(/^\s+/)
      ? firstLine.match(/^\s+/)[0]?.length
      : 0
    : 0;
  const lines = text.split("\n").map((l) => {
    // strip leading whitespace
    if (initialSpace > 0) {
      l = l.replace(new RegExp(`^\\s{${initialSpace}}`), "");
    }
    // strip trailing whitespace
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

export function addCodeBlockClasses(elements) {
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
    ["code-block", "code-block-start", "code-block-end"].forEach((className) =>
      el.classList.remove(className),
    );

    const l = el.innerText;

    if (l.trim() === "") {
      el.innerHTML = helper.whiteSpaceWorkaround();
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
        // remove html tags
        el.innerText = el.innerText;
      }
      codeBlocks.push(el);
    }
    if (el.innerHTML.trim() === "") {
      el.innerHTML = "<br>";
    }
    return el;
  });
  // check for unclosed code block
  if (isCodeBlock && codeBlocks.length > 0) {
    codeBlocks.forEach((el) => {
      el.classList.remove("code-block");
      el.classList.remove("code-block-start");
    });
  }
}

export function addParagraphClasses(elements) {
  // TODO: check for trim
  elements.forEach((el) => {
    helper.removeStyleAttributeRecursively(el);

    // remove new line at the beginning
    el.innerText = el.innerText.replace(/^\n+/, '');
    // add whitespace workaround
    if (el.innerText.trim() === "") {
      el.innerHTML = helper.whiteSpaceWorkaround();
    }

    ["h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr"].forEach(
      (className) => el.classList.remove(className),
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
        `blockquote-${el.innerText.match(/^(>{1,3})/)[1].length}`,
      );
    }

    if (el.innerText.match(/^---\s*$/)) {
      el.classList.add(`hr`);
    }

    let html = el.innerText;

    html = html
      .split(/(`+[^\`]+?`+)/g)
      .map((text) => {
        if (
          text.startsWith("`") &&
          text.endsWith("`") &&
          text[1] != "`" &&
          text !== "`"
        ) {
          return `<code>${text}</code>`;
        }

        let html = helper.escapeHTMLEntities(text);

        // find bold+italic
        html = html.replace(
          /([\*\\]*)(\*{3}.+?\*{3})([\*]*)/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<strong><em>${matches[2]}</em></strong>`;
          },
        );

        // find italic
        html = html.replace(
          /([\*\\]*)(\*{1}.+?\*{1})([\*]*)/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<em>${matches[2]}</em>`;
          },
        );

        // find bold text
        html = html.replace(
          /([\*\\]*)(\*\*.+?\*\*)([\*\\]*)/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<strong>${matches[2]}</strong>`;
          },
        );

        // find strike through text
        html = html.replace(
          /([\~\\])*(\~\~[^~].+?\~\~)([\~])*/g,
          (...matches) => {
            if (matches[1] || matches[3]) {
              return matches[0];
            }
            return `<s>${matches[2]}</s>`;
          },
        );

        // find links
        html = html.replace(/(\!)*\[(.+?)\]\((.+?)\)/g, (...matches) => {
          let classes = ["link", matches[1] ? "image" : ""]
            .filter((v) => !!v)
            .join(" ");
          return `<a href="${matches[3]}" style="--url: url(${matches[3]})" class="${classes}">${matches[1] || ""}[${matches[2]}]<span>(${matches[3]})</span></a>`;
        });

        return html;
      })
      .join("");

    if (html !== el.innerHTML) {
      el.innerHTML = html;
    }

    if (el.innerText.trim() === "" && EMPTY_LINE_HTML_PLACEHOLDER) {
      el.innerHTML = EMPTY_LINE_HTML_PLACEHOLDER;
    }
    el.querySelectorAll("a.link[href]").forEach((el) => {
      el.addEventListener("dblclick", (ev) => {
        if (ev.metaKey || ev.altKey ||/^http[s]*\:\/\//i.test(el.getAttribute('href'))) {
          // open in new tab
          window.open(el.href, "_blank");
        } else {
          window.location.href = el.href;
        }
      });
    });
  });
  return;
}
