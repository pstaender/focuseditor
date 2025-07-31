import * as helper from "./helper.mjs";

export default class BrowserFixes {
  static noDivInsideContentEditable(target) {
    // FIX: If the cursor is out of anz div and no .block exists, create one
    target.addEventListener("keyup", () => {
      if (
        helper.currentBlockWithCaret() === null &&
        target.innerContent === "" &&
        target.allChildren === undefined
      ) {
        target.innerHTML = '<div class="block"></div>';
      }
    });
  }
}
