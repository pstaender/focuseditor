import * as difflib from './lib/difflib.mjs';

export default class UndoText {

  #undos = [];
  #position = -1;

  SEPARATOR = '';

  add(text, additionalData = {}) {
    if (this.last()) {
      if (this.last().text === text || this.last().text === null || this.last().text === undefined) {
        // no change
        return;
      }
      let diff = difflib.ndiff(this.last().text.split(this.SEPARATOR), text.split(this.SEPARATOR));
      if (this.#undos[this.#position-1]) {
        delete this.#undos[this.#position-1].text;
      }
      this.#undos.push({
        text,
        additionalData,
        diff
      });
    } else {
      this.#undos.push({
        text,
        additionalData,
        diff: {}
      });
    }
    this.#position++;
    return this;
  }

  undo() {
    if (!this.#undos[this.#position] || !this.#undos[this.#position - 1]) {
      return null;
    }

    this.#position--;

    return {
      text: difflib.restore(this.#undos[this.#position + 1].diff, 1).join(this.SEPARATOR),
      additionalData: this.#undos[this.#position + 1].additionalData
    };
  }

  redo() {
    if (!this.#undos[this.#position] || !this.#undos[this.#position + 1]) {
      return null;
    }

    this.#position++;

    return {
      text: difflib.restore(this.#undos[this.#position - 1].diff, -1).join(this.SEPARATOR),
      additionalData: this.#undos[this.#position - 1].additionalData
    };
  }

  last() {
    return this.#undos[this.#position];
  }
}
