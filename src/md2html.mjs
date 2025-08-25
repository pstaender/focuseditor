/**
 * Module to help converting commonmark to html for the editor.
 * All methods are exclusively used by the FocusEditorCore class.
 *
 * ** Not for public use: any function name may change at any time. **
 * @module md2html
 */

import * as helper from "./helper.mjs";

export const EMPTY_LINE_HTML_PLACEHOLDER = `<br>`;

export function innerTextToHtml(text, document) {
  text = text.replace(/\r/g, "\n");

  const lines = text.split("\n").map((l) => {
    // strip trailing whitespace
    l = l.replace(/\s+$/, "");

    if (l.trim() === "") {
      return `<div class="block">${EMPTY_LINE_HTML_PLACEHOLDER}</div>`;
    }
    const el = document.createElement("div");
    el.textContent = l;
    return el.outerHTML.replace(/ {2}/g, "&nbsp;&nbsp;");
  });

  let div = document.createElement("div");
  div.innerHTML = lines.join("\n");

  return div.innerHTML;
}

export function addCodeBlockClasses(elements, document) {
  let isCodeBlock = false;
  let codeBlocks = [];

  const allCodeBlocksCount = [...elements].filter((l) =>
    /^```/.test(l.textContent),
  ).length;
  let codeBlockIndex = 0;

  elements.forEach((el) => {
    if (el.tagName === "BR") {
      const div = document.createElement("div");
      div.classList.add("block");
      if (isCodeBlock) {
        div.classList.add("code-block");
      }
      div.innerHTML = EMPTY_LINE_HTML_PLACEHOLDER;
      el.replaceWith(div);
      return;
    }
    el.classList.add("block");
    ["code-block", "code-block-start", "code-block-end"].forEach((className) =>
      el.classList.remove(className),
    );

    const l = el.textContent;

    if (l.trim() === "") {
      el.innerHTML = EMPTY_LINE_HTML_PLACEHOLDER;
    }

    if (
      allCodeBlocksCount % 2 === 1 &&
      codeBlockIndex >= allCodeBlocksCount - 1
    ) {
      /* only add codeblock if it has also a closing ``` */
    } else {
      if (l.match(/^```/) && !isCodeBlock) {
        isCodeBlock = true;
        el.classList.add("code-block-start");
        codeBlockIndex++;
        codeBlocks = [];
      } else if (l.match(/^```$/) && isCodeBlock) {
        isCodeBlock = false;
        codeBlockIndex++;
        el.classList.add("code-block");
        el.classList.add("code-block-end");
      }

      if (isCodeBlock) {
        el.innerHTML = el.innerHTML.replace(/\s{2}/g, "&nbsp;&nbsp;");

        el.classList.add("code-block");
        if (el.innerHTML.match(/[<>]/)) {
          // remove html tags
          el.textContent = String(el.textContent);
        }
        codeBlocks.push(el);
      }
    }

    if (el.innerHTML.trim() === "") {
      el.innerHTML = "<br>";
    }
    return el;
  });
}

function inlineMarkdown(text) {
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
  html = html
    .replace(/([*\\]*)(\*{3}[^\s*]+.*?\*{3})([*]*)/g, (...matches) => {
      if (matches[1] || matches[3]) {
        return matches[0];
      }
      return `<strong><em>${matches[2]}</em></strong>`;
    })
    .replace(/([_\\]*)(_{3}[^\s_]+.*?_{3})([_]*)/g, (...matches) => {
      if (matches[1] || matches[3]) {
        return matches[0];
      }
      return `<strong><em>${matches[2]}</em></strong>`;
    });

  // find *italic* / _italic_
  html = html
    .replace(/([*\\]*)(\*{1}[^\s*]+.*?\*{1})([*]*)/g, (...matches) => {
      if (matches[1] || matches[3]) {
        return matches[0];
      }
      return `<em>${matches[2]}</em>`;
    })
    .replace(/([_\\]*)(_{1}[^\s_]+.*?_{1})([_]*)/g, (...matches) => {
      if (matches[1] || matches[3]) {
        return matches[0];
      }
      return `<em>${matches[2]}</em>`;
    });

  // find **bold text** / __bold text__
  html = html
    .replace(/([*\\]*)(\*\*[^\s*]+.*?\*\*)([*\\]*)/g, (...matches) => {
      if (matches[1] || matches[3]) {
        return matches[0];
      }
      return `<strong>${matches[2]}</strong>`;
    })
    .replace(/([_\\]*)(__[^\s_]+.*?__)([_\\]*)/g, (...matches) => {
      if (matches[1] || matches[3]) {
        return matches[0];
      }
      return `<strong>${matches[2]}</strong>`;
    });

  // find strike through text
  html = html.replace(/([~\\])*(~~[^~][^\s]+.*?~~)([~])*/g, (...matches) => {
    if (matches[1] || matches[3]) {
      return matches[0];
    }
    return `<s>${matches[2]}</s>`;
  });

  // find links
  html = html.replace(/(!)*\[(.+?)\]\((.*)\)/g, (...matches) => {
    let classes = ["link", matches[1] ? "image" : ""]
      .filter((v) => !!v)
      .join(" ");
    let url = helper.stripHtml(matches[3].split(/\s+/)[0]);
    return `<a href="${url}" style="--url: url(${url})" class="${classes}">${matches[1] || ""}[${matches[2]}]<span>(${url})</span></a>`;
  });

  return html;
}

export function addParagraphClasses(elements, document) {
  // TODO: check for trim
  elements.forEach((el) => {
    helper.removeStyleAttributeRecursively(el);

    // remove new line at the beginning
    el.textContent = el.textContent.replace(/^\n+/, "");
    // add whitespace workaround
    if (el.textContent.trim() === "") {
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

    if (el.textContent.match(/^#{1,6}\s/)) {
      let id = helper.slugify(el.textContent.replace(/^#{1,6}\s/, "").trim());
      if (!document.getElementById(id)) {
        el.id = id;
      }
      el.innerHTML = inlineMarkdown(el.textContent);
      el.classList.add(`h${el.textContent.match(/^(#{1,6})\s/)[1].length}`);
      return;
    }

    if (el.textContent.match(/^>{1,3}/)) {
      el.classList.add(`blockquote`);
      el.classList.add(
        `blockquote-${el.textContent.match(/^(>{1,3})/)[1].length}`,
      );
    }

    // <hr>
    if (el.textContent.match(/^(-{3,}|\*{3,})\s*$/)) {
      el.classList.add("hr");
    }

    let html = el.innerHTML;
    html = html.replace(/(!)*\[(.+?)\]\((.*)\)/g, (...matches) => {
      let classes = ["link", matches[1] ? "image" : ""]
        .filter((v) => !!v)
        .join(" ");
      return `<a href="${matches[3]}" style="--url: url(${matches[3]})" class="${classes}">${matches[1] || ""}[${matches[2]}]<span>(${matches[3]})</span></a>`;
    });

    // previous way:
    html = el.textContent
      .split(/(`+[^`]+?`+)/g)
      .map(inlineMarkdown)
      .join("");
    // previous way

    if (html !== el.innerHTML) {
      el.innerHTML = html;
    }

    if (el.textContent.trim() === "" && EMPTY_LINE_HTML_PLACEHOLDER) {
      el.innerHTML = EMPTY_LINE_HTML_PLACEHOLDER;
    }

    if (el.textContent.trim() === "") {
      el.innerHTML = EMPTY_LINE_HTML_PLACEHOLDER;
    }
  });
  return;
}

export function convertElementsWithMarkdownTablesToVisualTables(elements) {
  let tableRows = [];

  function columnsToVisualTable(columns) {
    const ul = document.createElement("div");
    columns.forEach((row, i) => {
      const li = document.createElement("span");
      li.innerHTML = (i === 0 ? "|" : "") + row + "|";
      ul.appendChild(li);
    });
    return ul;
  }

  elements.forEach((el, i) => {
    if (tableRows.length === 0) {
      if (!/^\|.+?\|$/.test(el.textContent)) {
        return;
      }
      if (
        /^\|.+?\|/.test(el.textContent) &&
        elements[i + 1] &&
        /^\|\s*:*[-]+:*\s*\|/.test(elements[i + 1].textContent)
      ) {
        if (!elements[i + 1].textContent.trim().endsWith("|")) {
          // if the next line is not a valid table line, stop here
          return;
        }
        if (
          !elements[i + 2] ||
          !elements[i + 2].textContent.trim().endsWith("|")
        ) {
          // if the line after next line is not a valid table line, stop here
          return;
        }
        // table header found
        let columns = el.textContent.split(/\|/);
        let tableExtraCssClass = null;
        if (
          columns.at(-2).startsWith(".") &&
          elements[i + 1].textContent.split(/\|/).length + 1 === columns.length
        ) {
          tableExtraCssClass = columns.at(-2).replace(/^\./, "").trim();
        }
        columns = columns.slice(1, -1);
        const table = columnsToVisualTable(columns);
        table.classList.add("table-header-text");
        table.classList.add("table");
        if (tableExtraCssClass) {
          table.classList.add("table-with-extra-class");
          table.classList.add(`table-${tableExtraCssClass}`);
        }
        el.innerHTML = "";
        el.append(table);
        tableRows.push(columns);
      }
    } else if (/^\|.+?\|$/.test(el.textContent)) {
      const columns = columnsToVisualTable(
        el.textContent.split(/\|/).slice(1, -1),
      );
      if (tableRows.length === 1) {
        columns.classList.add("table-header-separator");
        columns.classList.add("table");
      } else {
        columns.classList.add("table");
        columns.classList.add("table-row");
        columns.classList.add(tableRows.length % 2 === 0 ? "table-row-odd" : "table-row-even");
        if (
          !elements[i + 1] ||
          !elements[i + 1].textContent.trim().endsWith("|")
        ) {
          columns.classList.add("table-row-last");
        }
      }
      el.innerHTML = "";
      el.append(columns);

      tableRows.push(columns);
    } else {
      tableRows = [];
    }
  });
}
