import { useEffect, useRef, useState } from "react";
import { obsManager } from "@/lib/obs/websocket";

interface UseHeroVideoSwitcherOptions {
  enabled: boolean;
  heroVideoFolderPath?: string;
}

/**
 * Hook that manages double-buffered OBS hero video switching.
 * Prevents black screen flashes by alternating between two media sources (A and B).
 * 
 * How it works:
 * - Two OBS media sources: "HeroVideoA" and "HeroVideoB"
 * - When switching to a new video, the hidden source is updated with the new file
 * - Then visibility is toggled, so the pre-loaded video starts playing immediately
 * - No black screen, perfectly smooth transitions
 */
export function useHeroVideoSwitcher({ enabled, heroVideoFolderPath }: UseHeroVideoSwitcherOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeSourceRef, setActiveSource] = useState<"A" | "B">("A");
  const pendingVideoRef = useRef<string | null>(null);

  // Monitor OBS connection status
  useEffect(() => {
    if (!enabled) return;

    // Check connection status periodically
    const checkInterval = setInterval(() => {
      setIsConnected(obsManager.isConnectedToOBS());
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [enabled]);

  /**
   * Switch to a new video with double buffering.
   * This is called when the phase transitions (STARTING -> BAN, etc.)
   */
  const switchToVideo = async (videoFileName: string) => {
    if (!enabled || !heroVideoFolderPath || !videoFileName) {
      console.log("[v0] Video switch skipped:", { enabled, heroVideoFolderPath, videoFileName });
      return;
    }

    console.log("[v0] Hero video switch initiated:", videoFileName);

    // Determine which source to update (the inactive one)
    const inactiveSource = activeSourceRef === "A" ? "HeroVideoB" : "HeroVideoA";
    const activeSource = activeSourceRef === "A" ? "HeroVideoA" : "HeroVideoB";

    // Build full path to the video file
    const videoPath = `${heroVideoFolderPath}/${videoFileName}`;

    try {
      // Step 1: Update the inactive source with the new video file
      console.log(`[v0] Loading ${videoFileName} into ${inactiveSource}`);
      const updateSuccess = await obsManager.setMediaSourceFile(inactiveSource, videoPath);

      if (!updateSuccess) {
        console.warn("[v0] Failed to update media source, but proceeding with visibility toggle");
      }

      // Small delay to ensure OBS has loaded the file
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 2: Hide the currently active source
      console.log(`[v0] Hiding ${activeSource}`);
      await obsManager.setSourceVisibility(activeSource, false);

      // Step 3: Show the newly loaded source
      console.log(`[v0] Showing ${inactiveSource}`);
      await obsManager.setSourceVisibility(inactiveSource, true);

      // Update our tracking
      setActiveSource(activeSourceRef === "A" ? "B" : "A");

      console.log("[v0] Hero video switched successfully to:", videoFileName);
      return true;
    } catch (error) {
      console.error("[v0] Failed to switch hero video:", error);
      return false;
    }
  };

  /**
   * Set a pending video to be played at the next phase transition.
   * Allows the manager to queue up the next video without triggering playback immediately.
   */
  const setPendingVideo = (videoFileName: string) => {
    pendingVideoRef.current = videoFileName;
    console.log("[v0] Pending video set:", videoFileName);
  };

  /**
   * Get and clear the pending video.
   */
  const getPendingVideo = () => {
    const video = pendingVideoRef.current;
    pendingVideoRef.current = null;
    return video;
  };

  return {
    isConnected,
    switchToVideo,
    setPendingVideo,
    getPendingVideo,
    activeSource: activeSourceRef,
  };
}
