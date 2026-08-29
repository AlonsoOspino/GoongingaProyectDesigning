"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMaps } from "@/lib/api/map";
import type { GameMap, MapType } from "@/lib/api/types";
import styles from "./information.module.css";

/* EL POOL DE MAPAS.
 *
 * Antes era una fila de cinco iconos sin nada detras: decia que hay cinco modos,
 * pero no que mapas entran en cada uno, que es la pregunta real.
 *
 * Los mapas salen de /map, la misma fuente que usa el draft table. No hay lista
 * escrita a mano en ningun sitio: si el pool cambia en el backend, esta pagina
 * cambia con el. Y si la API no responde, se dice —no se inventa una rotacion. */

const MODES: Array<{ id: MapType; name: string; icon: string }> = [
  { id: "CONTROL", name: "Control", icon: "/icons/map-types/control.png" },
  { id: "HYBRID", name: "Hybrid", icon: "/icons/map-types/hybrid.png" },
  { id: "PAYLOAD", name: "Payload", icon: "/icons/map-types/payload.png" },
  { id: "PUSH", name: "Push", icon: "/icons/map-types/push.png" },
  { id: "FLASHPOINT", name: "Flashpoint", icon: "/icons/map-types/flashpoint.png" },
];

type LoadState = "loading" | "ready" | "unavailable";

export default function ModeTabs() {
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");
  // Control primero: es el modo con el que abre todo partido, asi que es el que
  // mas se consulta.
  const [active, setActive] = useState<MapType>("CONTROL");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let mounted = true;
    getMaps()
      .then((all) => {
        if (!mounted) return;
        setMaps(all);
        setLoad("ready");
      })
      .catch(() => {
        if (mounted) setLoad("unavailable");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const byMode = useMemo(() => maps.filter((map) => map.type === active), [maps, active]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = MODES.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;

    event.preventDefault();
    setActive(MODES[next].id);
    tabRefs.current[next]?.focus();
  };

  const activeMode = MODES.find((mode) => mode.id === active) ?? MODES[0];

  return (
    <div className={styles.modeBlock}>
      <div className={styles.modes} role="tablist" aria-label="Game modes in the pool">
        {MODES.map((mode, index) => (
          <button
            key={mode.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`mode-tab-${mode.id}`}
            type="button"
            role="tab"
            aria-selected={active === mode.id}
            aria-controls="mode-panel"
            tabIndex={active === mode.id ? 0 : -1}
            className={`${styles.mode} ${active === mode.id ? styles.modeActive : ""}`}
            onClick={() => setActive(mode.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <img className={styles.modeIcon} src={mode.icon} alt="" loading="lazy" decoding="async" />
            <span className={styles.modeName}>{mode.name}</span>
          </button>
        ))}
      </div>

      <div
        id="mode-panel"
        role="tabpanel"
        aria-labelledby={`mode-tab-${active}`}
        tabIndex={0}
        className={styles.modePanel}
      >
        {load === "loading" ? (
          <p className={styles.modeNote}>Loading the {activeMode.name} pool…</p>
        ) : load === "unavailable" ? (
          <p className={styles.modeNote}>
            The map pool is served live from the league database and is not reachable right now.
          </p>
        ) : byMode.length === 0 ? (
          <p className={styles.modeNote}>No {activeMode.name} maps are registered for this season yet.</p>
        ) : (
          <ul className={styles.mapGrid}>
            {byMode.map((map) => (
              <li key={map.id} className={styles.mapCard}>
                {/* Sin miniatura autorizada se queda el panel de color con el
                    nombre, que es una decision de diseno y no un hueco roto. */}
                {map.imgPath ? (
                  <img
                    className={styles.mapThumb}
                    src={map.imgPath}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className={styles.mapThumbEmpty} aria-hidden="true" />
                )}
                <span className={styles.mapName}>{map.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
