// CodeMirror 6 editor — bundled via esbuild into editor-bundle.js
// Exposes window.DannyEditor factory.

import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  highlightSpecialChars, drawSelection, keymap,
} from '@codemirror/view';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap,
} from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';

import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';

// Map file extension → CodeMirror language extension
function langForFilename(name) {
  if (!name) return markdown();
  const base = name.toLowerCase();
  const ext = base.includes('.') ? base.substring(base.lastIndexOf('.') + 1) : '';
  switch (ext) {
    case 'md': case 'markdown': case 'mdown': case 'mkd': case 'mdx':
      return markdown({ codeLanguages: [] });
    case 'yml': case 'yaml': return yaml();
    case 'json': case 'jsonc': case 'json5': return json();
    case 'js': case 'mjs': case 'cjs':
      return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'ts': return javascript({ typescript: true });
    case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'py': return python();
    case 'html': case 'htm': case 'svg': return html();
    case 'css': case 'scss': case 'sass': case 'less': return css();
    case 'xml': case 'plist': return xml();
    case 'sql': return sql();
    default:
      // Plaintext / unknown — use markdown as a reasonable fallback for prose
      return markdown({ codeLanguages: [] });
  }
}

export function createEditor(host, opts = {}) {
  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const wrapCompartment = new Compartment();

  const baseExtensions = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightActiveLine(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && opts.onChange) {
        opts.onChange();
      }
    }),
  ];

  const initialState = EditorState.create({
    doc: opts.initialValue || '',
    extensions: [
      ...baseExtensions,
      languageCompartment.of(langForFilename(opts.fileName)),
      themeCompartment.of(opts.theme === 'dark' ? oneDark : []),
      wrapCompartment.of(opts.wrap === false ? [] : EditorView.lineWrapping),
    ],
  });

  const view = new EditorView({ state: initialState, parent: host });

  return {
    view,
    // Value get/set
    getValue() { return view.state.doc.toString(); },
    setValue(value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    },
    // Selection
    getSelection() {
      const r = view.state.selection.main;
      return { from: r.from, to: r.to };
    },
    setSelection(from, to) {
      view.dispatch({ selection: { anchor: from, head: to ?? from } });
    },
    // Focus
    focus() { view.focus(); },
    // Theme
    setTheme(mode) {
      view.dispatch({
        effects: themeCompartment.reconfigure(mode === 'dark' ? oneDark : []),
      });
    },
    // Language
    setLanguage(fileName) {
      view.dispatch({
        effects: languageCompartment.reconfigure(langForFilename(fileName)),
      });
    },
    // Word wrap
    setWrap(wrap) {
      view.dispatch({
        effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
      });
    },
    destroy() { view.destroy(); },
  };
}

// Attach to window for non-module consumers
if (typeof window !== 'undefined') {
  window.DannyEditor = { createEditor };
}
