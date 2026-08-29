"use client";

import type { RefObject } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./story.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/* EL MOVIMIENTO DE LA HISTORIA.
 *
 * Nacio como useLandingMotion, atado a la landing. No tenia por que estarlo: no
 * conoce ni una seccion por su nombre, solo busca atributos data-*. Cualquier
 * ruta que los ponga en su marcado recibe el mismo comportamiento, que es lo que
 * permite que Season 9 y GGL History se muevan como la portada sin duplicar una
 * linea de GSAP.
 *
 * Contrato del marcado:
 *   [data-hero] + [data-hero-copy]   parallax de entrada del hero
 *   [data-word-reveal] > [data-word] parrafo que se enciende palabra a palabra
 *   [data-figure-motion]             figura que entra acercandose y saturando
 *   [data-chapter="id"]              seccion-capitulo; anima --chapter-light
 *   [data-inline-media]              media que se abre con un barrido
 *   [data-marquee-track]             cinta en bucle continuo
 *   [data-story] + [data-chapter-index] + [data-chapter-item="id"]
 *                                    rail de capitulos anclado (solo escritorio)
 *
 * Nada de esto es obligatorio: cada bloque comprueba antes de actuar, asi que una
 * pagina puede usar solo la mitad del vocabulario. */

const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";
const DESKTOP_QUERY = "(min-width: 1200px) and (prefers-reduced-motion: no-preference)";

export function useStoryMotion(scope: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const root = scope.current;
      // Sin esta comprobacion, quien pide movimiento reducido recibe igualmente
      // todo el scrub. Es la unica salida temprana y va antes que nada.
      if (!root || !window.matchMedia(MOTION_QUERY).matches) return;

      const hero = root.querySelector<HTMLElement>("[data-hero]");
      const heroCopy = root.querySelector<HTMLElement>("[data-hero-copy]");

      if (hero && heroCopy) {
        gsap.to(heroCopy, {
          yPercent: -13,
          opacity: 0.24,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom 18%",
            scrub: 0.8,
          },
        });
      }

      root.querySelectorAll<HTMLElement>("[data-word-reveal]").forEach((block) => {
        const words = block.querySelectorAll<HTMLElement>("[data-word]");
        if (words.length === 0) return;

        // De 0.65 y no de 0: el parrafo tiene que ser legible desde el primer
        // momento. Esto subraya la lectura, no la condiciona.
        gsap.fromTo(
          words,
          { opacity: 0.65 },
          {
            opacity: 1,
            stagger: 0.025,
            ease: "none",
            scrollTrigger: {
              trigger: block,
              start: "top 86%",
              end: "bottom 56%",
              scrub: true,
            },
          },
        );
      });

      root.querySelectorAll<HTMLElement>("[data-figure-motion]").forEach((figure, index) => {
        gsap.fromTo(
          figure,
          {
            yPercent: index % 2 === 0 ? 8 : 11,
            scale: 0.9,
            filter: "saturate(0.72) brightness(0.62)",
          },
          {
            yPercent: -3,
            scale: 1,
            filter: "saturate(1) brightness(1)",
            ease: "none",
            scrollTrigger: {
              trigger: figure,
              start: "top 94%",
              end: "center 54%",
              scrub: 0.9,
            },
          },
        );
      });

      root.querySelectorAll<HTMLElement>("[data-chapter]").forEach((chapter) => {
        gsap.fromTo(
          chapter,
          { "--chapter-light": 0 },
          {
            "--chapter-light": 1,
            ease: "none",
            scrollTrigger: {
              trigger: chapter,
              start: "top 88%",
              end: "top 38%",
              scrub: 0.7,
            },
          },
        );
      });

      root.querySelectorAll<HTMLElement>("[data-inline-media]").forEach((media) => {
        gsap.fromTo(
          media,
          { clipPath: "inset(0 100% 0 0)", scale: 0.82 },
          {
            clipPath: "inset(0 0% 0 0)",
            scale: 1,
            duration: 0.8,
            ease: "power4.out",
            scrollTrigger: { trigger: media, start: "top 82%", toggleActions: "play none none reverse" },
          },
        );
      });

      root.querySelectorAll<HTMLElement>("[data-marquee-track]").forEach((track) => {
        gsap.to(track, {
          xPercent: -50,
          duration: 26,
          ease: "none",
          repeat: -1,
        });
      });

      /* El rail anclado solo tiene sentido cuando hay margen lateral libre. Por
         debajo de 1200 se solaparia con el contenido, asi que ni se crea: el CSS
         tambien lo oculta en ese rango. matchMedia se encarga de revertirlo si la
         ventana cruza el umbral. */
      const media = gsap.matchMedia();
      media.add(DESKTOP_QUERY, () => {
        const story = root.querySelector<HTMLElement>("[data-story]");
        const index = root.querySelector<HTMLElement>("[data-chapter-index]");
        const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter]"));
        const indexItems = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter-item]"));
        if (!story || !index || chapters.length === 0 || indexItems.length === 0) return;

        const activate = (id: string | undefined) => {
          indexItems.forEach((item) => {
            const active = item.dataset.chapterItem === id;
            item.classList.toggle(styles.chapterIndexItemActive, active);
          });
        };

        activate(chapters[0]?.dataset.chapter);

        ScrollTrigger.create({
          trigger: story,
          start: "top 156px",
          end: "bottom 72%",
          pin: index,
          pinSpacing: false,
          anticipatePin: 1,
        });

        chapters.forEach((chapter) => {
          ScrollTrigger.create({
            trigger: chapter,
            start: "top 54%",
            end: "bottom 54%",
            onEnter: () => activate(chapter.dataset.chapter),
            onEnterBack: () => activate(chapter.dataset.chapter),
          });
        });
      });

      /* Las medidas de las figuras dependen de imagenes que aun pueden estar
         cargando; sin este refresco los triggers se calculan sobre alturas que
         luego cambian. */
      const refresh = window.requestAnimationFrame(() => ScrollTrigger.refresh());
      return () => {
        window.cancelAnimationFrame(refresh);
        media.revert();
      };
    },
    { scope },
  );
}
