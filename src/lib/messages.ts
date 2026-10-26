import type { Effect, Mode } from './settings';

/** Popup/background → page script (via tabs.sendMessage). */
export type PageRequest =
  | { type: 'page:get' }
  | { type: 'page:set-temporary'; effect: Effect | null }
  | { type: 'areas:start'; inverted: boolean; mode: Mode }
  | { type: 'areas:clear' };

export interface PageState {
  origin: string;
  effect: Effect | null;
  /** True when the effect is a private-window override that isn't saved. */
  temporary: boolean;
  areas: number;
}

/** Page script → background (via runtime.sendMessage). */
export type BackgroundRequest = { type: 'badge'; on: boolean };
