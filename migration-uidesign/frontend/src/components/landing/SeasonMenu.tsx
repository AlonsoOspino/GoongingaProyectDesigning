"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import menu from "./season-menu.module.css";
import { useCurrentTournament } from "@/features/tournament/useCurrentTournament";
import {
  SEASON_INFORMATION_HREF,
  SEASON_NAV_ITEMS,
  isTournamentLive,
} from "@/features/tournament/seasonNav";

interface Props {
  /** Texto del disparador. Sale del torneo real cuando la API responde. */
  label?: string;
  /** Clase del botón, para que herede el aspecto del header que lo aloja. */
  triggerClassName?: string;
  /** "menu" = desplegable (escritorio). "inline" = lista abierta (nav móvil). */
  layout?: "menu" | "inline";
  /** El nav móvil se saca del orden de tabulación mientras está cerrado. */
  reachable?: boolean;
  onNavigate?: () => void;
}

export default function SeasonMenu({
  label = "Season 9",
  triggerClassName,
  layout = "menu",
  reachable = true,
  onNavigate,
}: Props) {
  const tournament = useCurrentTournament();
  const live = isTournamentLive(tournament?.state);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Mismo comportamiento que el menú de perfil del header: cerrar al pulsar
  // fuera y con Escape, devolviendo el foco al disparador.
  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  // Sin torneo en marcha no hay menú: Season 9 lleva derecho a Information.
  if (!live) {
    return (
      <Link
        href={SEASON_INFORMATION_HREF}
        className={triggerClassName}
        tabIndex={reachable ? 0 : -1}
        onClick={onNavigate}
      >
        {label}
      </Link>
    );
  }

  // En el nav móvil un desplegable dentro de otro desplegable no aporta nada,
  // así que las cinco vistas se listan abiertas.
  if (layout === "inline") {
    return (
      <div className={menu.inline}>
        <p className={menu.inlineLabel}>{label}</p>
        <ul className={menu.inlineList}>
          {SEASON_NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={menu.inlineLink}
                tabIndex={reachable ? 0 : -1}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={menu.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClassName ?? ""} ${menu.trigger} ${open ? menu.triggerOpen : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        tabIndex={reachable ? 0 : -1}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
        <span className={`${menu.caret} ${open ? menu.caretOpen : ""}`} aria-hidden="true" />
      </button>

      <div
        role="menu"
        aria-label={label}
        aria-hidden={!open}
        className={`${menu.panel} ${open ? menu.panelOpen : ""}`}
      >
        {SEASON_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className={menu.item}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
