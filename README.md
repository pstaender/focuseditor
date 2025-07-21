# Focus Editor
## … for the focused editor

[See the demo 🚀](https://pstaender.github.io/focuseditor/)

### Features

- distraction free (zen-mode)
- zero(!) dependencies
- lightweight: ~50Kbytes *uncompressed*, ~20Kbytes compressed,

### Usage

```html
<head>
  <link rel="stylesheet" href="https://unpkg.com/browser-focus-editor@latest/src/css/FocusEditor.css">
</head>
<body>
  <focus-editor></focus-editor>

  <script type="module">
    import { init } from "https://unpkg.com/browser-focus-editor@latest/src/FocusEditor.mjs"
    init();
  </script>
</body>
```

### Usage with replacing textareas

```html
<head>
  <link rel="stylesheet" href="https://unpkg.com/browser-focus-editor@latest/src/css/FocusEditor.css">
</head>
<body>
  <textarea name="my-textarea"></textarea>

  <script type="module">
    import { textareasAsFocusEditor } from "https://unpkg.com/browser-focus-editor@latest/src/FocusEditor.mjs"
    textareasAsFocusEditor();
  </script>
</body>
```

### JavaScript usage in older browser without module support

```html
<script src="https://unpkg.com/browser-focus-editor@latest/cjs/FocusEditor.js"></script>
<script>
window.initFocusEditor();
</script>
```

### Todos

- [ ] complete docs
- [ ] specs
- [ ] real undos

### License

[GNU Affero General Public License](./LICENSE)
