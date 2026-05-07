"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Início", num: "" },
  { href: "/mercado", label: "Dados de Mercado", num: "1" },
  { href: "/volatilidade", label: "Volatilidade", num: "2" },
  { href: "/blackscholes", label: "Black-Scholes", num: "3" },
  { href: "/gregas", label: "Gregas", num: "4" },
  { href: "/comparacao", label: "Comparação c/ Mercado", num: "5" },
  { href: "/tutorial", label: "Tutorial", num: "6" },
];

export function Sidebar({ onCollapse }: { onCollapse?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="relative w-64 shrink-0 border-r border-light-border bg-white/60 px-6 py-10">
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          title="Ocultar barra lateral"
          aria-label="Ocultar barra lateral"
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:bg-cream hover:text-navy"
        >
          <span className="text-sm leading-none">«</span>
        </button>
      )}
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.2em] text-warm-gray">
          Opções
        </div>
        <h1 className="mt-1 text-3xl text-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Laboratório
        </h1>
        <div className="mt-2 h-px w-12 bg-gold" />
      </div>

      <nav className="space-y-1">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-baseline gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-navy text-cream"
                  : "text-text-secondary hover:bg-cream hover:text-navy"
              )}
            >
              <span
                className={cn(
                  "w-4 text-[10px] tabular-nums",
                  active ? "text-gold-light" : "text-text-muted"
                )}
              >
                {l.num}
              </span>
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
