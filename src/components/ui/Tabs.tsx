"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  label: string;
  tabs: TabItem[];
  defaultTabId?: string;
  onChange?: (id: string) => void;
};

/** ARIA tablist/tab/tabpanel dengan navigasi panah (DS §7.4). */
export function Tabs({ label, tabs, defaultTabId, onChange }: TabsProps) {
  const baseId = useId();
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    setActive(tab.id);
    onChange?.(tab.id);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "-mb-px h-11 shrink-0 border-b-2 px-3 text-body font-medium whitespace-nowrap transition-colors duration-150",
                selected ? "border-primary text-primary" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-4"
        >
          {tab.id === active ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
