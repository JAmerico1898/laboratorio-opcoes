"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";

const COLLAPSED_KEY = "opcoes-lab-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      {!collapsed && <Sidebar onCollapse={toggle} />}
      <main className="relative flex-1 px-8 py-10 lg:px-12">
        {collapsed && hydrated && (
          <button
            type="button"
            onClick={toggle}
            title="Mostrar barra lateral"
            className="fixed left-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-md border border-light-border bg-white text-navy shadow-sm transition hover:border-gold hover:text-gold"
            aria-label="Expandir barra lateral"
          >
            <span className="text-base leading-none">☰</span>
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
