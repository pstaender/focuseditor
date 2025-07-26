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
  expect(undo.undo()).toBe(null);
});
