"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion() {
  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionDisabled = new URLSearchParams(window.location.search).get("motion") === "off";

    if (reduceMotion || motionDisabled) {
      return;
    }

    const revealElements = gsap.utils.toArray<HTMLElement>("[data-reveal]");
    revealElements.forEach((element) => {
      gsap.fromTo(
        element,
        {
          y: 48,
          opacity: 0.68,
          clipPath: "inset(0 0 16% 0)",
        },
        {
          y: 0,
          opacity: 1,
          clipPath: "inset(0 0 0% 0)",
          duration: 1.05,
          ease: "expo.out",
          scrollTrigger: {
            trigger: element,
            start: "top 86%",
            once: true,
          },
        },
      );
    });

    const imageElements = gsap.utils.toArray<HTMLElement>("[data-image-reveal]");
    imageElements.forEach((element) => {
      const image = element.querySelector("img") ?? element;

      gsap.fromTo(
        image,
        { scale: 0.9, opacity: 0.7 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top 94%",
            end: "top 48%",
            scrub: 0.8,
          },
        },
      );

      gsap.to(image, {
        scale: 1.025,
        opacity: 0.32,
        ease: "none",
        scrollTrigger: {
          trigger: element,
          start: "bottom 18%",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    });

  }, []);

  return null;
}
