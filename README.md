# Focus Editor
## … for the focused editor

[See the demo](https://pstaender.github.io/focuseditor/)

### Features

- distraction free (zen-mode)
- zero(!) dependencies
- lightweight: ~50Kbytes *uncompressed*, ~20Kbytes compressed,

### Usage

In your html:

```html
<focus-editor></focus-editor>
```

```js
import { init } from "./src/FocusEditor.mjs"
init();
```

### Textarea Usage

```html
<textarea name="my-textarea"></textarea>
```

and replace any `textarea` with `focus-editor` with:

```js
import { textareasAsFocusEditor } from "./src/FocusEditor.mjs"
textareasAsFocusEditor();
```

### Todos

- [ ] complete docs
- [ ] specs
- [ ] real undos

### License

[GNU Affero General Public License](./LICENSE)
