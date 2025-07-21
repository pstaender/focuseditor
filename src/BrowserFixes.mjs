import * as helper from "./helper.mjs";

export default class BrowserFixes {
  static noDivInsideContentEditable(target) {
    // FIX: If the cursor is out of anz div and no .block exists, create one
    target.addEventListener("keyup", (ev) => {
      if (
        helper.currentBlockWithCaret() === null &&
        target.innerText === "" &&
        target.allChildren === undefined
      ) {
        target.innerHTML = '<div class="block"></div>';
      }
    });
  }
}
