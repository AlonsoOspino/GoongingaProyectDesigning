"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function ManagerDashboardFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1200);

  const syncHeight = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document) return;
    const nextHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 800);
    setHeight(nextHeight);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(syncHeight, 1000);
    return () => window.clearInterval(interval);
  }, [syncHeight]);

  return (
    <iframe
      ref={frameRef}
      src="/manager-dashboard?embedded=1"
      title="League operations"
      onLoad={syncHeight}
      style={{ display: "block", width: "100%", height, border: 0, background: "transparent" }}
    />
  );
}
