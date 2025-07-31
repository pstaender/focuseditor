import { it } from "vitest";

import UndoText from "../src/UndoText";

it("undos several steps", ({ expect }) => {
  let undo = new UndoText()
    .add(`Hallo!`)
    .add(`Hallo!\nHallo Welt`)
    .add("Hallo!\nHallo Welt?")
    .add("Hallo!\nHallo Welt!");
  expect(undo.undo().text).toBe("Hallo!\nHallo Welt?");
  expect(undo.undo().text).toBe("Hallo!\nHallo Welt");
  expect(undo.undo().text).toBe("Hallo!");
  expect(undo.undo()).toStrictEqual({});
});

it("undos and adds steps", ({ expect }) => {
  let undo = new UndoText()
    .add("1st")
    .add("2nd")
    .add("3rd")
    .add("4th")
    .add("5th");
  expect(undo.undos.length).toBe(5);
  expect(undo.undo().text).toBe("4th");
  expect(undo.undo().text).toBe("3rd");
  expect(undo.undos.length).toBe(5);
  undo.add("6th");
  expect(undo.undos.length).toBe(4);
  expect(undo.undo().text).toBe("3rd");
  undo.add("7th");
  undo.add("8th");
  expect(undo.undo().text).toBe("7th");
});

it("perfoms undos and redos", ({ expect }) => {
  let undo = new UndoText()
    .add(`1st`)
    .add(`2nd`)
    .add("3rd")
    .add("4th");
  undo.undo();
  undo.undo();
  expect(undo.redo().text).toBe("3rd");
  expect(undo.redo().text).toBe("4th");
  expect(undo.undo().text).toBe("3rd");
});
