import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import DraftTablePage from "../draft-table/[matchId]/page";
import { DraftTableDevProvider } from "./DraftTableDevContext";
import { parseDraftTableDevData } from "./demo-data";

export const dynamic = "force-dynamic";

const FIXTURE_FILE = ".draft-table-dev-data.json";

export default async function DraftTableDevPage() {
  const enabled =
    process.env.NODE_ENV === "development" ||
    process.env.ENABLE_DRAFT_TABLE_DEV === "true";

  if (!enabled) notFound();

  const fixturePath = path.join(process.cwd(), FIXTURE_FILE);

  try {
    const source = await readFile(fixturePath, "utf8");
    const data = parseDraftTableDevData(JSON.parse(source));
    return (
      <DraftTableDevProvider data={data}>
        <DraftTablePage />
      </DraftTableDevProvider>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fixture error.";
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-2xl rounded-xl border border-danger/40 bg-surface p-8 shadow-2xl shadow-black/30">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-danger">Local fixture error</p>
          <h1 className="mt-2 text-3xl font-black">Draft table dev data could not be loaded</h1>
          <p className="mt-5 text-sm text-muted">{message}</p>
          <code className="mt-4 block overflow-x-auto rounded-md bg-background px-4 py-3 text-xs text-foreground">{fixturePath}</code>
          <p className="mt-4 text-sm text-muted">
            Restore the ignored local fixture, then reload this page. Production draft data was not touched.
          </p>
        </div>
      </main>
    );
  }
}
