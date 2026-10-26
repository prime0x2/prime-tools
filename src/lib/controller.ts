/**
 * Tab-level operations shared by the popup and the keyboard shortcut.
 */
import { browser } from 'wxt/browser';
import type { PageRequest, PageState } from './messages';
import type { Effect } from './settings';
import { getPrefs, setSiteEffect } from './store';

export interface TabRef {
  id: number;
  incognito: boolean;
}

export const PAGE_SCRIPT = '/page.js';

export function sendToPage(
  tabId: number,
  msg: PageRequest,
): Promise<PageState> {
  return browser.tabs.sendMessage(tabId, msg) as Promise<PageState>;
}

/** Injects the page script (no-op if already there) and reads its state. */
export async function connect(tabId: number): Promise<PageState | null> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [PAGE_SCRIPT],
    });
    return await sendToPage(tabId, { type: 'page:get' });
  } catch {
    return null;
  }
}

/**
 * Normal windows save per site (every tab on that site follows). Private
 * windows never write to storage: the change lives in that tab only.
 */
export async function setEffect(
  tab: TabRef,
  origin: string,
  effect: Effect | null,
): Promise<void> {
  if (tab.incognito) {
    await sendToPage(tab.id, { type: 'page:set-temporary', effect });
  } else {
    await setSiteEffect(origin, effect);
  }
}

/** On ↔ off. Turning on restores the last-used mode and strength. */
export async function toggle(tab: TabRef): Promise<boolean> {
  const state = await connect(tab.id);
  if (!state || state.origin === 'null') return false;
  await setEffect(tab, state.origin, state.effect ? null : await getPrefs());
  return true;
}
