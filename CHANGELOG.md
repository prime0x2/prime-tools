# Changelog

## 1.0.0 (unreleased)

First public release. Rebuilt from the prototype on WXT + TypeScript.

### Added
- Toolbar badge (**ON**) when the whole-page effect is active on a tab.
- Keyboard shortcuts: `Alt+Shift+D` opens the popup, `Alt+Shift+S` toggles the current site.
- Settings page: remembered sites (with auto-apply status, allow/forget), shortcuts.
- Private windows: changes apply to that tab only and are never saved.
- Light and dark themes following the browser.
- Touch and pen support for drawing areas; on-screen hint while selecting.

### Changed
- Strength is now 5–100% (was a 0–10 brightness scale). Existing settings migrate automatically.
- Overlays now sit in the browser's top layer, so modal dialogs, popovers and fullscreen elements no longer appear above them.
- Overlays are restored if a page removes them.
- Each site's setting is stored under its own key, so two popups (or a popup and the shortcut) can't overwrite each other.
- New hidden areas start fully opaque.

- Drawing an area works even while the site has a modal dialog open, and Esc cancels the selection without closing the site's dialog.
- Settings also lists auto-apply grants left behind after an effect was turned off, so they can be revoked, and recognises "On all sites" grants.

### Fixed
- Content scripts are re-registered without a gap on browser start, and permission changes can no longer race into "duplicate script ID" errors.
- Page CSS (e.g. `div:empty { display: none }`, `contain`, transforms) can no longer hide or clip the overlays.
- After an extension update, open tabs no longer keep a frozen overlay that can't be turned off.
- Sandboxed pages (opaque `null` origin) no longer share one saved setting.
- The Settings page no longer loses keyboard focus while settings change.
