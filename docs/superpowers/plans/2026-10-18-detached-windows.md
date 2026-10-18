# Compact picker and detached functional windows

Goal: default draggable picker icon, expandable picker, native functional windows without duplicate classroom state.
Architecture: existing picker BrowserWindow has two sizes; separate icon position and panel bounds. Functional windows receive inert DOM presentations and forward tokenized user gestures to the owning main renderer. They never execute classroom scripts or read classroom storage.
Constraints: secure sandboxed preload, one business owner, offline build, unchanged battle geometry, 1920×1080 1x only, no CircleCI.

- [x] Regression tests: collapsed bounds, expand/collapse, dragging, position memory, unauthorized/stale events.
- [x] Picker presentation: icon and panel, threshold drag using OS cursor position, bounds clamping.
- [x] Functional windows: lifecycle-owned native windows, presentation snapshots, original event dispatch; file inputs preserved through safe File transfer.
- [x] Integration: original modal visibility detection, no duplicate state; refresh/close cleanup.
- [x] Real Electron regression, screenshots, source build/hash, documentation, commits.

Review focus: stale snapshots, input focus during updates, file inputs, parent refresh, multiple confirmation windows. Destructive commands retain their existing confirmation flow.
