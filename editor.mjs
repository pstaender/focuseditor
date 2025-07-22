import { init } from "./src/FocusEditor.mjs";

init();

const localStorageKey = "focus-editor-text";
let localStorage =
  window.localStorage.getItem(`${localStorageKey}-remember`) === "true"
    ? window.localStorage
    : window.sessionStorage;
const focusEditor = document.querySelector("focus-editor");

if (window.location.hash === "#new") {
  localStorage.clear();
  focusEditor.value = "";
}

function removeWordWrap(text, maxLength = null, autodetect = false) {
  if (!maxLength) {
    // detect max length
    maxLength = text
      .split(`\n`)
      .map((l) => l.length)
      .reduce((a, b) => (a < b ? b : a));
  }
  const averageLineLength =
    text
      .split(`\n`)
      .map((l) => l.length)
      .reduce((a, b) => a + b, 0) / text.split(`\n`).length;
  if (averageLineLength * 1.9 < maxLength) {
    return text;
  }
  const clearedText = [];
  text.split(`\n`).forEach((l) => {
    if (l.trim() === "") {
      clearedText.push(l);
      return;
    }
    if (
      l.trimEnd().length > Math.floor(maxLength / 2) &&
      !/[\?\!|.]$/.test(l.trimEnd()) &&
      !/^\s+/.test(l)
    ) {
      clearedText.push(l.trimEnd());
      return;
    }
    clearedText.push(l);
  });

  return clearedText.join("");
}

function rememberText() {
  if (document.getElementById("remember").checked) {
    localStorage.setItem(`${localStorageKey}-text`, focusEditor.value || "");
  }
}

function displayText(txt) {
  focusEditor.value = removeWordWrap(txt);
  rememberText();
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
    "https://raw.githubusercontent.com/9EED/Markdown-guide/refs/heads/main/README.md",
    "https://raw.githubusercontent.com/im-luka/markdown-cheatsheet/refs/heads/main/README.md",
    "https://raw.githubusercontent.com/mlschmitt/classic-books-markdown/refs/heads/main/H.P.%20Lovecraft/The%20Call%20of%20Cthulhu.md",
    "https://raw.githubusercontent.com/mlschmitt/classic-books-markdown/refs/heads/main/Edgar%20Allan%20Poe/The%20Murders%20in%20the%20Rue%20Morgue.md",
    "https://raw.githubusercontent.com/brilliantorg/sherlock/refs/heads/master/novels/028_Hound_of_theBaskervilles.txt",
  ];
  if (ev.ctrlKey && ev.altKey && ev.shiftKey && /^Digit\d+$/.test(ev.code)) {
    // load txt from
    ev.preventDefault();
    fetch(urls[Number(ev.code.replace("Digit", "")) - 1])
      .then((response) => response.text())
      .then((text) => displayText(text));
  }
});

window.save = function () {
  // save text to file
  const blob = new Blob([focusEditor.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "focus-editor.txt";
  a.click();
  URL.revokeObjectURL(url);
};

document
  .querySelectorAll('main nav input[type="checkbox"][id]')
  .forEach((input) => {
    input.checked =
      localStorage.getItem(`${localStorageKey}-${input.id}`) === "true";
    input.addEventListener("change", () => {
      if (input.id === "remember" && !input.checked) {
        localStorage.clear();
        localStorage = window.sessionStorage;
        return;
      } else {
        localStorage = window.localStorage;
      }
      if (input.id === "hyphens") {
        if (input.checked) {
          focusEditor.setAttribute("hyphens", "auto");
        } else {
          focusEditor.removeAttribute("hyphens");
        }
      }
      localStorage.setItem(`${localStorageKey}-${input.id}`, input.checked);
    });
  });

if (
  document.getElementById("remember").checked &&
  localStorage.getItem(`${localStorageKey}-text`)
) {
  focusEditor.value = localStorage.getItem(`${localStorageKey}-text`);
}
