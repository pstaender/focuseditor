import * as difflib from './lib/difflib.mjs';

export default class UndoText {

  #undos = [];
  #position = -1;
  #previousText = null;
  #currentText = null;

  SEPARATOR = '';

  add(text, additionalData = {}) {
    if (text === this.#previousText || text === this.#currentText) {
      return;
    }
    if (this.previous()) {
      let previousText = this.previous().text === null ? this.#previousText : this.previous().text;
      let diff = difflib.ndiff(previousText.split(this.SEPARATOR), text.split(this.SEPARATOR));
      if (this.#undos[this.#position]) {
        this.#undos[this.#position].text = null;
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
    this.#previousText = text;
    this.#position++;
    return this;
  }

  undo() {
    if (!this.#undos[this.#position] || !this.#undos[this.#position - 1]) {
      return null;
    }

    this.#position--;

    const text = difflib.restore(this.#undos[this.#position + 1].diff, 1).join(this.SEPARATOR);

    this.#currentText = text;

    return {
      text,
      additionalData: this.#undos[this.#position + 1].additionalData
    };
  }

  redo() {
    throw new Error('Not implemented');
    if (!this.#undos[this.#position] || !this.#undos[this.#position + 1]) {
      return null;
    }

    this.#position++;

    return {
      text: difflib.restore(this.#undos[this.#position - 1].diff, -1).join(this.SEPARATOR),
      additionalData: this.#undos[this.#position - 1].additionalData
    };
  }

  previous() {
    return this.#undos[this.#position];
  }

  get undos() {
    return this.#undos;
  }
}
