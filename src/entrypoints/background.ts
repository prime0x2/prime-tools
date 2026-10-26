import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { PAGE_SCRIPT, toggle } from '../lib/controller';
import type { BackgroundRequest } from '../lib/messages';
import { migrateStorage } from '../lib/store';

const SCRIPT_ID = 'page';
const BADGE_COLOR = '#db5c39';

/**
 * Keeps the page script registered (at document_start) on exactly the sites
 * the user allowed. Calls are chained so overlapping permission events can't
 * race each other into "duplicate script ID" errors.
 */
let syncing: Promise<void> = Promise.resolve();
function syncContentScripts(): Promise<void> {
  syncing = syncing.then(async () => {
    const { origins = [] } = await browser.permissions.getAll();
    const matches = origins.filter(
      (o) => o === '<all_urls>' || /^(https?|\*):\/\//.test(o),
    );
    const existing = await browser.scripting.getRegisteredContentScripts({
      ids: [SCRIPT_ID],
    });
    if (!matches.length) {
      if (existing.length) {
        await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
      }
      return;
    }
    const script = {
      id: SCRIPT_ID,
      matches,
      js: [PAGE_SCRIPT],
      runAt: 'document_start' as const,
    };
    if (existing.length) {
      await browser.scripting.updateContentScripts([script]);
    } else {
      await browser.scripting.registerContentScripts([script]);
    }
  });
  syncing = syncing.catch((err) => {
    console.error('[Prime Tools] content script sync failed', err);
  });
  return syncing;
}

async function activeTab() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await migrateStorage();
    await syncContentScripts();
  });

  // Firefox automation can't navigate to moz-extension:// URLs itself, so
  // E2E builds open an extension page for the test to drive. Stripped from
  // production builds.
  if (import.meta.env.WXT_E2E === '1' && import.meta.env.FIREFOX) {
    browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  }
  browser.runtime.onStartup.addListener(() => {
    syncContentScripts();
  });
  browser.permissions.onAdded.addListener(() => {
    syncContentScripts();
  });
  browser.permissions.onRemoved.addListener(() => {
    syncContentScripts();
  });

  browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  browser.action.setBadgeTextColor?.({ color: '#ffffff' });

  // The page script reports whether the whole-page effect is on.
  browser.runtime.onMessage.addListener((raw: unknown, sender) => {
    const msg = raw as BackgroundRequest;
    const tabId = sender.tab?.id;
    if (msg?.type !== 'badge' || tabId === undefined || sender.frameId) {
      return undefined;
    }
    browser.action.setBadgeText({ tabId, text: msg.on ? 'ON' : '' });
    return undefined;
  });

  // A new page load starts clean; its page script (if any) reports again.
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') {
      browser.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    }
  });

  browser.commands.onCommand.addListener(async (command, commandTab) => {
    if (command !== 'toggle-page') return;
    const tab = commandTab?.id !== undefined ? commandTab : await activeTab();
    // Unsupported pages (browser UI, stores) simply fail to connect.
    if (tab?.id !== undefined) {
      await toggle({ id: tab.id, incognito: tab.incognito });
    }
  });
});
