"use client";

import { useState, type ReactNode } from "react";

export type DashboardTab = {
  id: string;
  label: string;
  content: ReactNode;
  // Optional count shown as a badge on the tab (e.g. missing evidence fields).
  badge?: number;
};

// Tabbed dashboard. Server-rendered content is passed in per tab; every panel
// stays mounted and toggles via `hidden` so an in-progress edit isn't lost when
// switching tabs and switching is instant (no page reload). `badge` surfaces a
// count so the user knows a tab needs attention even when it isn't active.
export function DashboardTabs({
  tabs,
  defaultTabId
}: {
  tabs: DashboardTab[];
  defaultTabId?: string;
}) {
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id);

  return (
    <div className="stack">
      <div className="tab-bar" role="tablist" aria-label="Dashboard sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`tab ${active === tab.id ? "tab-active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 ? <span className="tab-badge">{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={active !== tab.id}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
