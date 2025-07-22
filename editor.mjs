import { init } from "./src/FocusEditor.mjs";

init();

function removeWordWrap(text, maxLength = null, autodetect = false) {
  if (!maxLength) {
    // detect max length
    maxLength = text
      .split(`\n`)
      .map((l) => l.length)
      .reduce((a, b) => (a < b ? b : a));
  }
  const averageLineLength = text.split(`\n`).map(l => l.length).reduce((a, b) => a + b, 0) / text.split(`\n`).length;
  if (averageLineLength * 1.9 < maxLength) {
    return text;
  }
  const clearedText = [];
  text.split(`\n`).forEach((l) => {
    if (l.trim() === '') {
      clearedText.push(l);
      return;
    }
    if (l.trimEnd().length > Math.floor(maxLength/2) && !/[\?\!|.]$/.test(l.trimEnd()) && !/^\s+/.test(l)) {
      clearedText.push(l.trimEnd());
      return;
    }
    clearedText.push(l);
  });

  return clearedText.join("");
}

const focusEditor = document.querySelector("focus-editor");

function displayText(txt) {
  focusEditor.value = removeWordWrap(txt);
}

// on dropping txt file on focus editor, load the file
focusEditor.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    displayText(e.target.result);
  };
  reader.readAsText(file);
});

window.addEventListener("keydown", (ev) => {
  let urls = [
    'https://raw.githubusercontent.com/brilliantorg/sherlock/refs/heads/master/novels/028_Hound_of_theBaskervilles.txt',
    'https://raw.githubusercontent.com/9EED/Markdown-guide/refs/heads/main/README.md',
  ]
  if (ev.ctrlKey && ev.altKey && ev.shiftKey && /^Digit\d+$/.test(ev.code)) {
    // load txt from
    ev.preventDefault();
    fetch(
      urls[Number(ev.code.replace('Digit', '')) - 1],
    )
      .then((response) => response.text())
      .then((text) => displayText(text));
  }
});

// file:///Users/philipp/Downloads/028_Hound_of_theBaskervilles.txt
