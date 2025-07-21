function stripLeadingWhitespaces(text) {
  /* Strips leading whitespaces from a given text. Can be used when using text from an element with has intended text. */
  const firstLine = text.split("\n").filter((t) => t.length > 0)[0];
  const initialSpace = firstLine
    ? firstLine.match(/^\s+/)
      ? firstLine.match(/^\s+/)[0]?.length
      : 0
    : 0;
  return text
    .split("\n")
    .map((l) => {
      // strip leading whitespace
      if (initialSpace > 0) {
        l = l.replace(new RegExp(`^\\s{${initialSpace}}`), "");
      }
      // also strip trailing whitespace
      return l.replace(/\s+$/, "");
    })
    .join("\n");
}

document.querySelectorAll(".demo-code").forEach((el) => {
  let container =
    el.querySelector("pre.show-demo-code") ||
    el.parentElement.querySelector("pre.show-demo-code");
  if (!container) {
    return;
  }
  container.textContent = stripLeadingWhitespaces(el.innerHTML).trim();
});

document
  .querySelectorAll("button.show-code")
  .forEach((b) =>
    b.addEventListener("click", (ev) => ev.target.classList.toggle("active")),
  );
