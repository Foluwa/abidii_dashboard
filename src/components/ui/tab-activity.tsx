"use client";

import { createContext, useContext } from "react";

/**
 * Signals whether the enclosing tab panel is currently the active one. `UrlTabs`
 * provides this per-panel so Radix Select/Popover menus can close themselves when
 * their tab is hidden (their portal content lives outside the `hidden` panel and
 * would otherwise stay open). Defaults to `true` so selects used outside a hub
 * (standalone pages, modals) are always treated as active.
 */
export const TabActivityContext = createContext(true);

export const useTabActivity = () => useContext(TabActivityContext);
