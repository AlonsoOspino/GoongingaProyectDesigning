"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DraftTableDevData } from "./demo-data";

const DraftTableDevContext = createContext<DraftTableDevData | null>(null);

export function DraftTableDevProvider({
  data,
  children,
}: {
  data: DraftTableDevData;
  children: ReactNode;
}) {
  return (
    <DraftTableDevContext.Provider value={data}>
      {children}
    </DraftTableDevContext.Provider>
  );
}

export function useDraftTableDevData(): DraftTableDevData | null {
  return useContext(DraftTableDevContext);
}
