import * as difflib from './lib/difflib.mjs';

export default class UndoText {

  #undos = [];
  #position = -1;
  #previousText = null;
  #currentText = null;

  SEPARATOR = '\n';

  add(text, additionalData = {}) {
    if (text === this.#previousText || text === this.#currentText) {
      return;
    }
    const cutOff = this.#position < this.#undos.length - 1;
    let previousText = this.previous() ? this.previous().text : this.#previousText;
    if (cutOff) {
      // console.log(this.#position < this.#undos.length - 1, this.#previousText);
      this.#undos = this.#undos.splice(0, this.#position + 1);
      previousText = this.#currentText;
      // console.log('Cut off', this.#undos, { text, previousText })
    }

    if (previousText) {
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
      return {};
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
    if (!this.#undos[this.#position] || !this.#undos[this.#position + 1]) {
      return null;
    }

    this.#position++;

    return {
      text: difflib.restore(this.#undos[this.#position].diff, 2).join(this.SEPARATOR),
      additionalData: this.#undos[this.#position].additionalData
    };
  }

  previous() {
    return this.#undos[this.#position];
  }

  clear() {
    this.#undos = [];
    this.#position = -1;
    this.#previousText = null;
    this.#currentText = null;
  }

  get undos() {
    return this.#undos;
  }
}
