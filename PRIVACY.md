# Prime Tools Privacy Policy

_Last updated: 2026-10-26_

## Summary

**Prime Tools does not collect, transmit, sell or share any data. Everything it stores stays on your device.**

## What the extension stores

In the browser's local extension storage (`storage.local`), on your device only:

1. **Sites with a whole-page effect.** For each site where you turned on Dim or Blur: the site's origin (for example `https://example.com`), the mode, and the strength.
2. **Your last-used mode and strength**, so turning the effect on again picks up where you left off.

Nothing is stored for **areas** (hide / show only). They exist only on the open page and disappear on reload.

Nothing is stored for **private / incognito windows**. Changes there affect that tab only.

You can see and delete everything Prime Tools stores in **Settings → Remembered sites**. Uninstalling the extension deletes all of it.

## What the extension does not do

- It makes **no network requests** and has no server.
- It contains **no analytics, telemetry, error reporting, ads or third-party code**.
- It does **not read page content**. The page script only adds overlay elements; it never reads text, forms, cookies or history.
- It does **not sync** data across devices.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | To add the overlay to the tab you're on, only when you click the toolbar button or press a Prime Tools shortcut. |
| `scripting` | To insert the overlay script into that tab, and to run it automatically on sites you opted into. |
| `storage` | To remember your per-site settings on this device. |
| Optional: access to a specific site | Requested one site at a time, only when you tick **Apply on every visit**. It lets the effect apply as that site loads. You can revoke it in Settings or in the browser's extension settings at any time. |

## Changes to this policy

Changes will be noted here with a new date and in the release notes. The extension will never start collecting data.

## Contact

Open an issue at [github.com/prime0x2/prime-tools/issues](https://github.com/prime0x2/prime-tools/issues) or email **prime0x2@gmail.com**.
