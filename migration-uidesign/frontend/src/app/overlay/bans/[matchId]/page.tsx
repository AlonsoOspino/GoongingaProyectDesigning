'use client';

import { useEffect, useState, Suspense } from 'react';
import ObsBansOverlay from '@/components/obs/ObsBansOverlay';
import { useSession } from '@/features/session/SessionProvider';
import { getMemberProfileById } from '@/lib/api/auth';

export default function ObsBansOverlayPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const [matchId, setMatchId] = useState<number | null>(null);

  useEffect(() => {
    params.then((resolvedParams) => {
      const id = parseInt(resolvedParams.matchId, 10);
      if (!isNaN(id)) setMatchId(id);
    });
  }, [params]);

  if (matchId === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-black text-white">
          Loading...
        </div>
      }
    >
      <ObsBansOverlayContent matchId={matchId} />
    </Suspense>
  );
}

function ObsBansOverlayContent({ matchId }: { matchId: number }) {
  const { user, token, isHydrated } = useSession();
  const [obsWebsocketUrl, setObsWebsocketUrl] = useState<string>('');
  const [obsWebsocketPassword, setObsWebsocketPassword] = useState<string>('');
  const [heroVideoFolderPath, setHeroVideoFolderPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!isHydrated || !user || !token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await getMemberProfileById(user.id, token);
        setObsWebsocketUrl(profile.obsWebsocketUrl || '');
        setObsWebsocketPassword(profile.obsWebsocketPassword || '');
        setHeroVideoFolderPath(profile.heroVideoFolderPath || '');
      } catch (err) {
        console.error('[v0] Failed to load OBS settings:', err);
        setError('Failed to load OBS settings from profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user, token, isHydrated]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        Loading settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (!obsWebsocketUrl || !obsWebsocketPassword) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-yellow-500">
        <p>OBS WebSocket settings not configured. Please configure in Manager Dashboard.</p>
      </div>
    );
  }

  return (
    <ObsBansOverlay
      matchId={matchId}
      obsWebsocketUrl={obsWebsocketUrl}
      obsWebsocketPassword={obsWebsocketPassword}
      heroVideoFolderPath={heroVideoFolderPath}
    />
  );
}
