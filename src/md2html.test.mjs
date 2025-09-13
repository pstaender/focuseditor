import { it } from "vitest";
import { JSDOM } from "jsdom";

import * as md2html from "./md2html";

function createDocument() {
  return new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`)
    .window.document;
}

/**
 * Trims whitespaces from a string
 * @param {string} str
 * @returns {string}
 */
function trws(str) {
  return str
    .split(`\n`)
    .map((line) => line.trim())
    .join(`\n`)
    .trim();
}

it("#innerTextToHtml", ({ expect }) => {
  const document = createDocument();

  expect(trws(md2html.innerTextToHtml(`\n# Headline\n`, document))).toBe(
    trws(`
    <div class="block"><br></div>
    <div># Headline</div>
    <div class="block"><br></div>`),
  );
});

it("#addCodeBlockClasses", ({ expect }) => {
  const document = createDocument();
  const div = document.createElement("div");

  div.innerHTML = md2html.innerTextToHtml(
    "\n# Headline\n```md\n# test\n  * bullet-item\n**bold**\n```\n",
    document,
  );
  document.querySelector("body").append(div);
  let elements = document.querySelectorAll("body > div > div");
  md2html.addCodeBlockClasses(elements, document);
  expect([...elements].map((element) => element.outerHTML).join(`\n`)).toBe(
    trws(`
    <div class="block"><br></div>
    <div class="block"># Headline</div>
    <div class="block code-block-start code-block">\`\`\`md</div>
    <div class="block code-block"># test</div>
    <div class="block code-block">&nbsp;&nbsp;* bullet-item</div>
    <div class="block code-block">**bold**</div>
    <div class="block code-block code-block-end">\`\`\`</div>
    <div class="block"><br></div>`),
  );
});

it("#addParagraphClasses with link", ({ expect }) => {
  const document = createDocument();
  const div = document.createElement("div");
  div.innerHTML = md2html.innerTextToHtml(
    "![**important** link](https://example.com/_wiki_)",
    document,
  );
  document.querySelector("body").append(div);
  let elements = document.querySelectorAll("body > div > div");
  md2html.addCodeBlockClasses(elements, document);
  md2html.addParagraphClasses(elements, document);
  expect([...elements].map((element) => element.outerHTML).join(`\n`)).toBe(
    trws(`
      <div class="block"><a href="https://example.com/_wiki_" style="--url: url(https://example.com/_wiki_)" class="link image">![<strong>**important**</strong> link]<span>(https://example.com/_wiki_)</span></a></div>
      `),
  );
});

it("#addParagraphClasses", ({ expect }) => {
  const document = createDocument();
  const div = document.createElement("div");
  div.innerHTML = md2html.innerTextToHtml(
    `## Very *important* Headline

Some **text** with *some* different
     styles.

\`\`\`md
# test
**bold**
\`\`\``,
    document,
  );
  document.querySelector("body").append(div);
  let elements = document.querySelectorAll("body > div > div");
  md2html.addCodeBlockClasses(elements, document);
  md2html.addParagraphClasses(elements, document);
  expect([...elements].map((element) => element.outerHTML).join(`\n`)).toBe(
    trws(`
      <div class="block h2" id="very-important-headline">## Very <em>*important*</em> Headline</div>
      <div class="block"><br></div>
      <div class="block">Some <strong>**text**</strong> with <em>*some*</em> different</div>
      <div class="block">&nbsp;&nbsp;&nbsp;&nbsp; styles.</div>
      <div class="block"><br></div>
      <div class="block code-block-start code-block">\`\`\`md</div>
      <div class="block code-block"># test</div>
      <div class="block code-block">**bold**</div>
      <div class="block code-block code-block-end">\`\`\`</div>
      `),
  );
});
