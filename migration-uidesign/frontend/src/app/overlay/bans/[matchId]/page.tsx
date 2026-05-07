'use client';

import { Suspense } from 'react';
import ObsBansOverlay from '@/components/obs/ObsBansOverlay';

export default function ObsBansOverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-black text-white">
          Loading...
        </div>
      }
    >
      <ObsBansOverlayContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ObsBansOverlayContent({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const matchId = parseInt(resolvedParams.matchId, 10);
  const obsHost = (resolvedSearchParams.obsHost as string) || 'localhost';
  const obsPort = parseInt((resolvedSearchParams.obsPort as string) || '4455', 10);
  const obsPassword = (resolvedSearchParams.obsPassword as string) || '';

  if (isNaN(matchId)) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-500">
        Invalid match ID
      </div>
    );
  }

  return (
    <ObsBansOverlay
      matchId={matchId}
      obsHost={obsHost}
      obsPort={obsPort}
      obsPassword={obsPassword}
    />
  );
}
