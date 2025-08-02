# Focus Editor
## … for the focused editor

[See the demo 🚀](https://pstaender.github.io/focuseditor/)

<img width="549" height="572" alt="Bildschirmfoto 2025-08-02 um 06 58 55" src="https://github.com/user-attachments/assets/20b5cc9f-4842-43ed-a066-65b9fb630a03" />

### Features

- distraction free **zen-mode**
- zero dependencies
- responsive
- lightweight
  - ~80Kbytes *un*compressed <-> ~20Kbytes compressed

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

### Replacing textareas with focus-editor

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

- [ ] refactor cursor class, md and helper module
- [ ] sync web component with existing textarea/input
- [ ] limit undo steps
- [ ] complete api docs

### License

[GNU Affero General Public License](./LICENSE)
