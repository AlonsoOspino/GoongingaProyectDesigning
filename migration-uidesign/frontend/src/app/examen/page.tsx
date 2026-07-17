"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

const TOTAL_SLIDES = 35;
const SLIDES = Array.from({ length: TOTAL_SLIDES }, (_, index) => `/examen/slides/slide-${String(index + 1).padStart(2, "0")}.png`);
const MIDPOINT_SLIDE_INDEX = Math.floor(TOTAL_SLIDES / 2);

type RequestStatus = "idle" | "loading" | "done" | "error";
type SharedDocument = {
  fileName: string;
  url: string;
  downloadUrl: string;
  pathname: string;
  size: number;
  uploadedAt: string;
};

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

const middleSlideFrameStyle: CSSProperties = {
  ...slideFrameStyle,
  position: "relative",
};

const slideStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
};

const uploadOverlayStyle: CSSProperties = {
  position: "absolute",
  top: "12px",
  right: "12px",
  display: "flex",
  gap: "6px",
  zIndex: 2,
};

const smallUploadButtonStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  border: "1px solid rgba(0, 0, 0, 0.55)",
  background: "rgba(255, 255, 255, 0.9)",
  color: "#111",
  fontSize: "15px",
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};

const smallDangerButtonStyle: CSSProperties = {
  ...smallUploadButtonStyle,
  background: "rgba(255, 235, 235, 0.92)",
  color: "#9b0000",
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

const resultPanelStyle: CSSProperties = {
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
  display: "block",
  width: "100%",
  height: "33vh",
  background: "#fff",
  border: "1px solid #222",
  overflow: "auto",
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
  const [sharedDocument, setSharedDocument] = useState<SharedDocument | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const iframeHtml = useMemo(() => (renderedHtml ? wrapHtmlForIframe(renderedHtml) : ""), [renderedHtml]);
  const hasResultPanel = Boolean(fileName || sharedDocument || renderedHtml || error || status === "loading" || documentBusy);
  const uploadDisabled = status === "loading" || documentBusy || Boolean(sharedDocument);

  useEffect(() => {
    let ignore = false;

    async function loadSharedDocument() {
      try {
        const response = await fetch("/api/examen/document", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { document?: SharedDocument | null } | null;

        if (!ignore && response.ok) {
          setSharedDocument(payload?.document || null);
        }
      } catch {
        if (!ignore) {
          setSharedDocument(null);
        }
      }
    }

    void loadSharedDocument();

    return () => {
      ignore = true;
    };
  }, []);

  const reset = () => {
    setRenderedHtml("");
    setFileName("");
    setStatus("idle");
    setError("");

    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
    }

    if (wordInputRef.current) {
      wordInputRef.current.value = "";
    }
  };

  const saveSharedDocument = async (file: File) => {
    const formData = new FormData();
    formData.append("document", file);

    const response = await fetch("/api/examen/document", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as { document?: SharedDocument; error?: string } | null;

    if (!response.ok || !payload?.document) {
      throw new Error(payload?.error || "No se pudo guardar el documento compartido.");
    }

    setSharedDocument(payload.document);

    return payload.document;
  };

  const downloadSharedDocument = () => {
    if (!sharedDocument) {
      return;
    }

    window.open(sharedDocument.downloadUrl || sharedDocument.url, "_blank", "noopener,noreferrer");
  };

  const deleteSharedDocument = async () => {
    setDocumentBusy(true);
    setError("");

    try {
      const response = await fetch("/api/examen/document", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo borrar el documento.");
      }

      setSharedDocument(null);
      setRenderedHtml("");
      setFileName("");
      setStatus("idle");
    } catch (deleteError) {
      setStatus("error");
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo borrar el documento.");
    } finally {
      setDocumentBusy(false);
    }
  };

  const runPromptWithFile = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lowerName.endsWith(".docx");

    if (!isPdf && !isDocx) {
      setRenderedHtml("");
      setFileName(file.name);
      setStatus("error");
      setError("Formato no soportado. Usa PDF o Word .docx.");
      return;
    }

    if (sharedDocument) {
      setRenderedHtml("");
      setFileName(sharedDocument.fileName);
      setStatus("error");
      setError("Ya hay un documento subido. Borralo con X antes de subir otro.");
      return;
    }

    const formData = new FormData();
    formData.append("document", file);

    setRenderedHtml("");
    setFileName(file.name);
    setStatus("loading");
    setError("");
    setDocumentBusy(true);

    try {
      await saveSharedDocument(file);

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
      setDocumentBusy(false);

      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }

      if (wordInputRef.current) {
        wordInputRef.current.value = "";
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
          {SLIDES.map((slideSrc, index) => {
            const isMiddleSlide = index === MIDPOINT_SLIDE_INDEX;

            return (
              <div key={slideSrc}>
                <div style={isMiddleSlide ? middleSlideFrameStyle : slideFrameStyle}>
                  <img src={slideSrc} alt={`Diapositiva ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} style={slideStyle} />

                  {isMiddleSlide ? (
                    <>
                      <input ref={wordInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={handleDocumentChange} />
                      <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={handleDocumentChange} />
                      <div style={uploadOverlayStyle}>
                        <button type="button" title={sharedDocument ? "Borra el documento actual antes de subir Word" : "Cargar Word"} aria-label="Cargar Word" style={{ ...smallUploadButtonStyle, ...(uploadDisabled ? disabledButtonStyle : {}) }} onClick={() => wordInputRef.current?.click()} disabled={uploadDisabled}>
                          W
                        </button>
                        <button type="button" title={sharedDocument ? "Borra el documento actual antes de subir PDF" : "Cargar PDF"} aria-label="Cargar PDF" style={{ ...smallUploadButtonStyle, ...(uploadDisabled ? disabledButtonStyle : {}) }} onClick={() => pdfInputRef.current?.click()} disabled={uploadDisabled}>
                          P
                        </button>
                        <button type="button" title="Descargar documento" aria-label="Descargar documento" style={{ ...smallUploadButtonStyle, ...(!sharedDocument || documentBusy ? disabledButtonStyle : {}) }} onClick={downloadSharedDocument} disabled={!sharedDocument || documentBusy}>
                          D
                        </button>
                        <button type="button" title="Borrar documento" aria-label="Borrar documento" style={{ ...smallDangerButtonStyle, ...(!sharedDocument || documentBusy ? disabledButtonStyle : {}) }} onClick={() => void deleteSharedDocument()} disabled={!sharedDocument || documentBusy}>
                          X
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>

                {isMiddleSlide && hasResultPanel ? (
                  <section style={resultPanelStyle}>
                    <div style={controlsStyle}>
                      <button type="button" style={secondaryButtonStyle} onClick={reset}>
                        RESETEAR
                      </button>
                    </div>

                    {sharedDocument || fileName ? <p style={statusStyle}>Documento: {sharedDocument?.fileName || fileName}</p> : null}
                    {documentBusy && status !== "loading" ? <p style={statusStyle}>Actualizando documento...</p> : null}
                    {status === "loading" ? <p style={statusStyle}>Procesando documento...</p> : null}
                    {status === "done" ? <p style={statusStyle}>HTML recibido y renderizado.</p> : null}
                    {error ? <p style={errorStyle}>{error}</p> : null}

                    {renderedHtml ? (
                      <div style={renderStyle}>
                        <iframe title="HTML renderizado" srcDoc={iframeHtml} sandbox="" referrerPolicy="no-referrer" style={iframeStyle} />
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
