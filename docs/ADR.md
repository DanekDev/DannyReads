# Architecture Decision Records

## ADR-001: Stay with vanilla JS, not React/TypeScript

**Date:** 2026-04-21

**Context:** Spec proposed React + TypeScript + module tree (`src/main/*`, `src/renderer/*`). Current codebase is 5 files of vanilla JS.

**Decision:** Stay with vanilla JS. Keep the 5-file layout. Extract into modules only if a single file exceeds ~1500 lines.

**Reasoning:**
- Current scale (~2k LOC total) doesn't justify a React+TS+build toolchain
- Adds bundler complexity (webpack/esbuild/vite), increases cold-start
- Electron `preload` + `contextBridge` pattern works fine without TypeScript
- Migrating later is feasible if feature set demands it

**Consequences:** No compile-time type checks. Runtime validation at IPC boundaries must be deliberate.

---

## ADR-002: Use `chokidar` for filesystem watching

**Date:** 2026-04-21

**Context:** Current sidebar is one-shot `readdir()`. Files added/deleted externally don't show up until manual refresh.

**Decision:** Add `chokidar` as the watcher in main process. Emit batched TreeEvents via IPC. Renderer maintains expanded/selected state through mutations.

**Reasoning:**
- Standard Node.js filesystem watching library
- Handles cross-platform quirks (macOS FSEvents, Linux inotify, Windows ReadDirectoryChangesW)
- Built-in polling fallback for NFS/SMB mounts
- `awaitWriteFinish` prevents partial-write noise

**Consequences:** +1 dependency. Watcher lifecycle tied to open folder.

---

## ADR-003: Keep `marked`, not migrate to `markdown-it`

**Date:** 2026-04-21

**Context:** Spec assumed `markdown-it` plugin chain for Obsidian syntax.

**Decision:** Keep `marked`. For Obsidian syntax (later), use pre-processing (regex → placeholders → marked → restore) and/or `marked` extensions API.

**Reasoning:**
- `marked` already integrated with custom renderer for PlantUML, Mermaid, code highlighting
- Migration would break tested diagram rendering
- Obsidian syntax (wikilinks, embeds, callouts) is regex-tractable
- Pre-processing is simpler than a parser migration

**Consequences:** Some Obsidian edge cases may be harder to get exactly right than with proper AST plugins. Acceptable trade-off.

---

## ADR-004: Upgrade editor from `<textarea>` to CodeMirror 6

**Date:** 2026-04-21

**Context:** User requested "сильно улучшить редактор". Current editor is a plain `<textarea>`:
- No line numbers
- No syntax highlighting in edit mode
- No real undo grouping
- No folding
- Basic Tab handling only

**Decision:** Replace with CodeMirror 6 (not Monaco — too heavy).

**Reasoning:**
- CodeMirror 6 is modular, ~150-200KB bundled
- Native support for: line numbers, folding, multi-cursor, syntax highlighting via Lezer parsers
- Good find/replace UX
- Plays well with Electron
- Active maintenance
- Monaco pulls in ~3MB and is designed for full IDE use cases — overkill here

**Consequences:**
- Small bundle size increase
- Integration layer needed (state sync with tab model, mode switch, Find panel still via Electron findInPage in preview mode)

---

## ADR-005: Show all text-like files in sidebar, filter by content type

**Date:** 2026-04-21

**Context:** Current sidebar filters to a hardcoded set (md/puml/mmd/txt). Users can't see JSON, YAML, code files, etc.

**Decision:** Expand visible extensions to a broad text/code set. Detect binary files and exclude those. Show folder contents by default; user can narrow via settings later.

**Reasoning:** DannyReads is positioning as a general text/code file viewer, not just Markdown.

**Consequences:** Need a reliable "is text?" check (extension-based whitelist is enough in practice).

---

## Known bugs (captured 2026-04-21)

| # | Bug | Status |
|---|---|---|
| B1 | Sidebar doesn't refresh when files change on disk | **Fixing (ADR-002)** |
| B2 | Drag-and-drop calls `openFile()` instead of using the dropped file's path | **Fixing** |
| B3 | No context menu in sidebar (no rename, delete, new file, reveal in Finder) | **Fixing** |
| B4 | Editor is plain textarea — no line numbers, no syntax highlight | **Fixing (ADR-004)** |
| B5 | Sidebar hides files with unknown extensions | **Fixing (ADR-005)** |
| B6 | Closed tabs are not restored across sessions | Deferred |
| B7 | No way to delete/rename files from within the app | **Fixing** |
| B8 | Tab bar overflows horizontally with many tabs — no scroll indicator | Deferred |
| B9 | `window.api.openFile()` in drag-drop handler opens file dialog, not the dropped file | **Fixing** |
| B10 | Mermaid ESM import may fail in packaged `app.asar` due to relative path | To test |
