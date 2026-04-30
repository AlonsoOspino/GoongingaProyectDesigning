import type { Metadata } from "next";
import "./overlay.css";

export const metadata: Metadata = {
  title: "Match Overlay",
  description: "Live esports overlay for streaming",
};

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* 🔴 CRÍTICO para OBS / Opera */}
        <meta
          name="viewport"
          content="width=1920, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </head>

      <body
        style={{
          margin: 0,
          padding: 0,
          background: "transparent",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "1920px",
            height: "1080px",

            position: "relative",

            /* 🔴 evita render inconsistente */
            transformOrigin: "top left",
            backfaceVisibility: "hidden",
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}