"use client";

import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

const TOTAL_SLIDES = 35;
const SLIDES = Array.from({ length: TOTAL_SLIDES }, (_, index) => `/examen/slides/slide-${String(index + 1).padStart(2, "0")}.png`);

type RequestStatus = "idle" | "loading" | "done" | "error";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f1f1f1",
  color: "#111",
  fontFamily: "Arial, Helvetica, sans-serif",
  padding: "24px",
};

const shellStyle: CSSProperties = {
  width: "min(1180px, 100%)",
  margin: "0 auto",
};

const barStyle: CSSProperties = {
  marginBottom: "18px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "24px",
  lineHeight: 1.1,
};

const counterStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#555",
  fontSize: "14px",
};

const slideListStyle: CSSProperties = {
  display: "grid",
  gap: "24px",
};

const slideFrameStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #d0d0d0",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
};

const slideStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
};

const controlsStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const buttonStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid #222",
  background: "#111",
  color: "#fff",
  padding: "10px 14px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#fff",
  color: "#111",
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const uploaderStyle: CSSProperties = {
  marginTop: "28px",
  padding: "18px",
  background: "#fff",
  border: "1px solid #d0d0d0",
};

const statusStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#555",
  fontSize: "14px",
};

const errorStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#b00020",
  fontSize: "14px",
  fontWeight: 700,
};

const renderStyle: CSSProperties = {
  marginTop: "18px",
};

const iframeStyle: CSSProperties = {
  width: "100%",
  minHeight: "760px",
  background: "#fff",
  border: "1px solid #222",
};

function wrapHtmlForIframe(html: string) {
  const normalized = html.trim();

  if (/<!doctype html/i.test(normalized) || /<html[\s>]/i.test(normalized)) {
    return normalized;
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
${normalized}
  </body>
</html>`;
}

export default function ExamenPage() {
  const [renderedHtml, setRenderedHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeHtml = useMemo(() => (renderedHtml ? wrapHtmlForIframe(renderedHtml) : ""), [renderedHtml]);

  const reset = () => {
    setRenderedHtml("");
    setFileName("");
    setStatus("idle");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const runPromptWithFile = async (file: File) => {
    const formData = new FormData();
    formData.append("document", file);

    setRenderedHtml("");
    setFileName(file.name);
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/examen/generate", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { html?: string; error?: string } | null;

      if (!response.ok || !payload?.html) {
        throw new Error(payload?.error || "No se pudo generar HTML con el documento.");
      }

      setRenderedHtml(payload.html);
      setStatus("done");
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "No se pudo generar HTML con el documento.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void runPromptWithFile(file);
  };

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <div style={barStyle}>
          <h1 style={titleStyle}>Examen</h1>
          <p style={counterStyle}>{TOTAL_SLIDES} diapositivas renderizadas en vertical</p>
        </div>

        <div style={slideListStyle}>
          {SLIDES.map((slideSrc, index) => (
            <div key={slideSrc} style={slideFrameStyle}>
              <img src={slideSrc} alt={`Diapositiva ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} style={slideStyle} />
            </div>
          ))}
        </div>

        <section style={uploaderStyle}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.html,.csv,.json,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleDocumentChange}
          />
          <div style={controlsStyle}>
            <button type="button" style={{ ...buttonStyle, ...(status === "loading" ? disabledButtonStyle : {}) }} onClick={() => fileInputRef.current?.click()} disabled={status === "loading"}>
              {status === "loading" ? "PROCESANDO..." : "CARGAR DOCUMENTO Y EJECUTAR PROMPT"}
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={reset}>
              RESETEAR
            </button>
          </div>

          {fileName ? <p style={statusStyle}>Documento: {fileName}</p> : null}
          {status === "done" ? <p style={statusStyle}>HTML recibido y renderizado.</p> : null}
          {error ? <p style={errorStyle}>{error}</p> : null}

          {renderedHtml ? (
            <div style={renderStyle}>
              <iframe title="HTML renderizado" srcDoc={iframeHtml} sandbox="" referrerPolicy="no-referrer" style={iframeStyle} />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
