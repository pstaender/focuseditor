import { init } from "./src/FocusEditor.mjs?{{LAST_GIT_COMMIT_HASH}}";
import Cursor from "./src/Cursor.mjs?{{LAST_GIT_COMMIT_HASH}}";

init();

const localStorageKey = "focus-editor-text";

let localStorage =
  window.localStorage.getItem(`${localStorageKey}-remember`) === "true"
    ? window.localStorage
    : window.sessionStorage;
const focusEditor = document.querySelector("focus-editor");

/* this is a hard reset option to break the loop:
 * For the case that the editor is not responding
 * and restores a broken state from session storage
 */
if (window.location.hash === "#__force_new__") {
  window.localStorage.clear();
  window.newFile();
}

window.newFile = () => {
  localStorage.clear();
  focusEditor.value = "";
  window.setFilename(`focus-editor-${Date.now()}.txt`);
  document.getElementById("remember").checked = true;
  document.getElementById("remember").dispatchEvent(new Event("change"));
};

window.importFile = () => {
  const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'text/plain,.md,.markdown';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          displayText(event.target.result);
          window.setFilename(file.name);
        };
        reader.readAsText(file);
      }
    };
    input.click();
}

window.setFilename = (filename) => {
  document.getElementById("filename").value = filename;
  document.getElementById("filename").dispatchEvent(new Event("change"));
};

function removeWordWrap(text, maxLength = null) {
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
      !/[?!|.]$/.test(l.trimEnd()) &&
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
  focusEditor.value = document.getElementById("word-wrap").checked
    ? removeWordWrap(txt)
    : txt;
  rememberText();
}

// on dropping txt file on focus editor, load the file
focusEditor.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  const reader = new FileReader();
  window.setFilename(file.name || "import.txt");
  reader.onload = (e) => {
    displayText(e.target.result);
  };
  reader.readAsText(file);
});

focusEditor.addEventListener("keyup", () => {
  rememberText();
});

window.addEventListener("keydown", (ev) => {
  let urls = [
    "https://raw.githubusercontent.com/9EED/Markdown-guide/refs/heads/main/README.md",
    "https://raw.githubusercontent.com/im-luka/markdown-cheatsheet/refs/heads/main/README.md",
    "https://raw.githubusercontent.com/mlschmitt/classic-books-markdown/refs/heads/main/H.P.%20Lovecraft/The%20Call%20of%20Cthulhu.md",
    "https://raw.githubusercontent.com/mlschmitt/classic-books-markdown/refs/heads/main/Edgar%20Allan%20Poe/The%20Murders%20in%20the%20Rue%20Morgue.md",
    "https://raw.githubusercontent.com/brilliantorg/sherlock/refs/heads/master/novels/028_Hound_of_theBaskervilles.txt",
    "./specs/example.md",
  ];
  if (ev.ctrlKey && ev.altKey && ev.shiftKey && /^Digit\d+$/.test(ev.code)) {
    // load txt from
    const url = urls[Number(ev.code.replace("Digit", "")) - 1];
    ev.preventDefault();
    fetch(url)
      .then((response) => response.text())
      .then((text) => {
        displayText(text);
        window.setFilename(decodeURI(url.split("/").at(-1) || "demo.txt"));
      });
    return;
  }

  if ((ev.ctrlKey || ev.metaKey) && ev.key === "s") {
    ev.preventDefault();
    window.save();
  }
});

focusEditor.addEventListener("keyup", () => {
  let caret = Cursor.getCurrentCursorPosition(focusEditor);
  localStorage.setItem(`${localStorageKey}-caret-position`, caret);
});

window.save = function () {
  // save text to file
  const blob = new Blob([focusEditor.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = document.getElementById("filename").value || "focus-editor.txt";
  a.click();
  URL.revokeObjectURL(url);
};

document
  .querySelectorAll('main input[type="checkbox"][id]')
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
      if (input.id === "image-preview") {
        if (input.checked) {
          focusEditor.setAttribute("image-preview", "auto");
        } else {
          focusEditor.removeAttribute("image-preview");
        }
      }
      if (input.id === "highlight-current-paragraph") {
        if (input.checked) {
          focusEditor.classList.add("highlight-current-paragraph");
        } else {
          focusEditor.classList.remove("highlight-current-paragraph");
        }
      }
      localStorage.setItem(`${localStorageKey}-${input.id}`, input.checked);
    });
    input.dispatchEvent(new Event("change"));
  });

document.querySelectorAll('main input[type="text"][id]').forEach((input) => {
  input.value =
    localStorage.getItem(`${localStorageKey}-${input.id}`) || input.value;
  input.addEventListener("change", () => {
    localStorage.setItem(`${localStorageKey}-${input.id}`, input.value);
  });
});

if (
  document.getElementById("remember").checked &&
  localStorage.getItem(`${localStorageKey}-text`)
) {
  focusEditor.value = localStorage.getItem(`${localStorageKey}-text`);
}

document.getElementById("filename").addEventListener('change', () => {
  if (!/\.\w+$/.test(document.getElementById("filename").value)) {
    document.getElementById("filename").value += ".txt";
    if (document.getElementById("filename").value === '.txt') {
      document.getElementById("filename").value = 'focus-editor.txt';
    }
  }
  document.title = document.getElementById("filename").value;
})

document.getElementById("filename").dispatchEvent(new Event("change"));

if (localStorage.getItem(`${localStorageKey}-caret-position`)) {
  // restore caret position
  Cursor.setCurrentCursorPosition(
    localStorage.getItem(`${localStorageKey}-caret-position`),
    focusEditor
  );
}
