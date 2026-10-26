import { browser } from 'wxt/browser';

/** The shortcut currently bound to a command, e.g. "⌥⇧S", or null. */
export async function shortcutFor(command: string): Promise<string | null> {
  try {
    const all = await browser.commands.getAll();
    const keys = all.find((c) => c.name === command)?.shortcut;
    return keys ? prettyShortcut(keys) : null;
  } catch {
    return null;
  }
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** Chrome reports "⌥⇧S" on macOS already; Firefox reports "Alt+Shift+S". */
export function prettyShortcut(keys: string, mac = isMac): string {
  if (!mac || !keys.includes('+')) return keys;
  const map: Record<string, string> = {
    Alt: '⌥',
    Shift: '⇧',
    Command: '⌘',
    Ctrl: '⌘',
    MacCtrl: '⌃',
  };
  return keys
    .split('+')
    .map((k) => map[k] ?? k)
    .join('');
}

/** Opens the browser's own shortcut editor. */
export async function openShortcutSettings(): Promise<void> {
  const commands = browser.commands as typeof browser.commands & {
    openShortcutSettings?: () => Promise<void>;
  };
  if (commands.openShortcutSettings) {
    await commands.openShortcutSettings(); // Firefox 137+
    return;
  }
  await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
}
