import { defineConfig } from 'wxt';

// E2E builds (WXT_E2E=1) get blanket host access so Playwright can exercise
// auto-apply without clicking through a native permission prompt. They are
// written to a separate output folder and are never zipped or shipped.
const E2E = process.env.WXT_E2E === '1';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  outDirTemplate: E2E ? '{{browser}}-mv{{manifestVersion}}-e2e' : undefined,
  webExt: {
    startUrls: ['https://en.wikipedia.org/wiki/Special:Random'],
  },
  zip: {
    artifactTemplate: 'prime-tools-{{version}}-{{browser}}.zip',
    sourcesTemplate: 'prime-tools-{{version}}-sources.zip',
    excludeSources: ['prototype/**', 'docs/store/**'],
  },
  manifest: ({ browser }) => ({
    name: 'Prime Tools',
    description:
      'Dim, blur or hide any part of a web page. Remembers per site. Local-only, open source.',
    homepage_url: 'https://github.com/prime0x2/prime-tools',
    // Popover API (top-layer overlays) shipped in Chrome 114.
    ...(browser !== 'firefox' && { minimum_chrome_version: '116' }),
    // Minimal by design — see STORE_LISTING.md § Permission justifications.
    //   activeTab  — act on the current tab only when the user clicks the
    //                toolbar button or presses a shortcut
    //   scripting  — inject the overlay script into that tab, and register it
    //                on sites the user opted into
    //   storage    — per-site settings, kept on this device
    permissions: ['activeTab', 'scripting', 'storage'],
    // Requested one site at a time, only when the user turns on
    // "Apply on every visit". Never at install.
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    host_permissions: E2E ? ['<all_urls>'] : undefined,
    action: {
      default_title: 'Prime Tools — dim or blur this page',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+D' },
        description: 'Open the Prime Tools popup',
      },
      'toggle-page': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Turn the whole-page effect on or off for this site',
      },
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'prime-tools@prime0x2',
          strict_min_version: '142.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
