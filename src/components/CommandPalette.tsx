"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { GalleryEntry } from "@/lib/gallery";
import { galleryDoc } from "@/lib/gallery";
import { highlight, rankSearch } from "@/lib/search";
import { partyColor } from "./RulingCard";

type NavCommand = { label: string; href: string };

const NAV_COMMANDS: NavCommand[] = [
  { label: "Courtroom — judge a new case", href: "/" },
  { label: "Browse gallery", href: "/gallery" },
];

export function CommandPaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className="rounded-md border border-oak-300/40 bg-oak-900/50 px-2.5 py-1 text-xs text-oak-300 hover:text-brass-light"
    >
      Search cases <kbd className="ml-1 font-sans">⌘K</kbd>
    </button>
  );
}

export function CommandPalette({ entries }: { entries: GalleryEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const docs = useMemo(() => entries.map(galleryDoc), [entries]);
  const byId = useMemo(
    () => new Map(entries.map((e) => [e.case.id, e])),
    [entries],
  );

  // Open/close listeners. State updates live in the event handlers, not
  // in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSelected(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onOpen() {
      setOpen(true);
      setQuery("");
      setSelected(0);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  const caseHits = useMemo(() => {
    const hits = rankSearch(docs, query, 8);
    return hits
      .map((h) => byId.get(h.id))
      .filter((e): e is GalleryEntry => e !== undefined);
  }, [docs, byId, query]);

  const navHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_COMMANDS;
    return NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const total = caseHits.length + navHits.length;

  function close() {
    setOpen(false);
  }

  function activateCase(id: string) {
    const hash = encodeURIComponent(id);
    if (pathname === "/gallery") {
      window.location.hash = hash;
    } else {
      router.push(`/gallery#${hash}`);
    }
    close();
  }

  function activate(item: number) {
    if (item < caseHits.length) {
      activateCase(caseHits[item].case.id);
    } else {
      const nav = navHits[item - caseHits.length];
      if (nav) router.push(nav.href);
      close();
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (total === 0 ? 0 : (s + 1) % total));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (total === 0 ? 0 : (s - 1 + total) % total));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (total > 0) activate(Math.min(selected, total - 1));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        className="paper mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="wood-dark px-4 py-2 text-sm text-paper/80">
          Search landmark cases
        </div>
        <div className="border-b border-oak-700/20 px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search cases, topics, courts…"
            className="w-full bg-transparent font-serif text-lg text-ink outline-none placeholder:text-ink-soft/60"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {caseHits.map((e, i) => {
            const c = e.case;
            const active = i === selected;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => activateCase(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    active ? "bg-wall-dark" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-[15px] font-medium text-ink">
                      {highlight(c.title, query).map((seg, j) =>
                        seg.hit ? (
                          <mark
                            key={j}
                            className="rounded-md bg-brass-light/60 text-inherit"
                          >
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={j}>{seg.text}</span>
                        ),
                      )}
                    </div>
                    <div className="truncate text-xs text-ink-soft">
                      {c.court} · {c.year} · {c.topic}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${partyColor[e.result.ruling.prevailingParty]}`}
                  >
                    {e.result.ruling.prevailingParty}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      e.result.matchesActual
                        ? "bg-verdict-green/10 text-verdict-green"
                        : "bg-verdict-red/10 text-verdict-red"
                    }`}
                  >
                    {e.result.matchesActual ? "agrees" : "differs"}
                  </span>
                </button>
              </li>
            );
          })}
          {navHits.length > 0 && (
            <li className="px-4 pb-1 pt-2 font-serif text-sm font-medium text-ink">
              Commands
            </li>
          )}
          {navHits.map((c, i) => {
            const idx = caseHits.length + i;
            const active = idx === selected;
            return (
              <li key={c.href}>
                <button
                  type="button"
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => activate(idx)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink ${
                    active ? "bg-wall-dark" : ""
                  }`}
                >
                  <span className="text-brass">→</span> {c.label}
                </button>
              </li>
            );
          })}
          {total === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-soft">
              No matching cases.
            </li>
          )}
        </ul>
        <div className="border-t border-oak-700/20 px-4 py-2 text-xs text-ink-soft">
          ↑↓ navigate · ↵ open · esc close
        </div>
      </div>
    </div>
  );
}
