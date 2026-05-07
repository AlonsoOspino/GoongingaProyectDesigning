import OBSWebSocket from 'obs-websocket-js';

export interface OBSConfig {
  url: string;
  password: string;
}

export class OBSConnectionError extends Error {
  code?: number;
  hint?: string;
  constructor(message: string, options?: { code?: number; hint?: string; cause?: unknown }) {
    super(message);
    this.name = 'OBSConnectionError';
    this.code = options?.code;
    this.hint = options?.hint;
    if (options?.cause) (this as any).cause = options.cause;
  }
}

/**
 * Normalize the URL the user typed in the dashboard into a proper
 * obs-websocket v5 URL: `ws://host:port` or `wss://host:port`.
 *
 * Rules:
 *  - If the user typed `http(s)://...`, swap protocol to `ws(s)://`.
 *  - If no protocol, default to `ws://`.
 *  - If no port, default to `:4455` (OBS WebSocket v5 default).
 *  - Strip trailing slashes / paths because OBS WS expects a bare host:port.
 */
export function normalizeObsUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';

  // Protocol normalization
  if (url.startsWith('http://')) url = 'ws://' + url.slice('http://'.length);
  else if (url.startsWith('https://')) url = 'wss://' + url.slice('https://'.length);
  else if (!url.startsWith('ws://') && !url.startsWith('wss://')) url = 'ws://' + url;

  // Strip path (OBS WS doesn't use paths, and obs-websocket-js dislikes them)
  try {
    const u = new URL(url);
    // Default port policy:
    // - ws:// defaults to 4455 (OBS local default)
    // - wss:// keeps implicit 443 unless user explicitly typed a port
    if (!u.port && u.protocol === 'ws:') {
      u.port = '4455';
    }

    // Bare host[:port] — drop pathname/search/hash
    return u.port ? `${u.protocol}//${u.hostname}:${u.port}` : `${u.protocol}//${u.hostname}`;
  } catch {
    // Fallback: if URL parsing fails, append OBS default port only for ws://
    const hasPort = /:\d+$/.test(url.replace(/^wss?:\/\//, ''));
    if (hasPort || url.startsWith('wss://')) return url;
    return `${url}:4455`;
  }
}

/**
 * Detect the mixed-content scenario: page is HTTPS but trying to open ws://.
 * Browsers silently block this. We detect it so we can show a useful message
 * instead of a vague "could not connect".
 */
export function isMixedContent(normalizedUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'https:') return false;
  return normalizedUrl.startsWith('ws://');
}

class OBSWebSocketManager {
  private obs: any = null;
  private isConnected = false;

  async connect(config: OBSConfig): Promise<void> {
    if (this.isConnected && this.obs) {
      console.log('[v0] OBS WebSocket already connected');
      return;
    }

    const normalizedUrl = normalizeObsUrl(config.url);
    if (!normalizedUrl) {
      throw new OBSConnectionError('OBS WebSocket URL is empty', {
        hint: 'Set the OBS WebSocket URL in the Manager Dashboard (e.g. ws://localhost:4455).',
      });
    }

    if (isMixedContent(normalizedUrl)) {
      throw new OBSConnectionError(
        'Mixed content blocked: this page is HTTPS but the OBS URL is ws:// (insecure).',
        {
          hint:
            'Browsers block ws:// from https:// pages. Open this overlay over plain http:// (e.g. http://localhost:3000/...) or expose OBS over wss:// through a tunnel.',
        }
      );
    }

    try {
      this.obs = new OBSWebSocket();
      console.log('[v0] Connecting to OBS WebSocket at', normalizedUrl);
      await this.obs.connect(normalizedUrl, config.password);
      this.isConnected = true;
      console.log('[v0] OBS WebSocket connected successfully');
    } catch (error: any) {
      this.isConnected = false;
      this.obs = null;

      const code: number | undefined = error?.code;
      let hint: string | undefined;
      let message = error?.message || 'Failed to connect to OBS WebSocket';

      // obs-websocket-js v5 error codes
      // 4009 = AuthenticationFailed, 4008 = MissingDataField (wrong password format), etc.
      if (code === 4009 || /authentic/i.test(message)) {
        hint =
          'OBS rejected the password. Open OBS → Tools → WebSocket Server Settings, click "Show Connect Info", and copy the password exactly.';
      } else if (/refused|ECONNREFUSED|failed to connect|websocket is closed before/i.test(message)) {
        hint =
          'OBS did not accept the connection. Check: (1) OBS is running, (2) Tools → WebSocket Server Settings → "Enable WebSocket server" is checked, (3) the IP/port match (default 4455), (4) firewall allows the port.';
      } else if (/timeout/i.test(message)) {
        hint =
          'Connection timed out. The host or port is unreachable from this browser. Verify the IP and that the port (default 4455) is open.';
      }

      console.error('[v0] Failed to connect to OBS WebSocket:', { message, code, hint });
      throw new OBSConnectionError(message, { code, hint, cause: error });
    }
  }

  async disconnect(): Promise<void> {
    if (this.obs) {
      try {
        await this.obs.disconnect();
      } catch (error) {
        console.error('[v0] Error disconnecting from OBS:', error);
      } finally {
        this.isConnected = false;
        this.obs = null;
      }
    }
  }

  async updateTextSource(sourceName: string, text: string): Promise<boolean> {
    if (!this.isConnected || !this.obs) {
      console.warn('[v0] OBS WebSocket not connected, cannot update text source');
      return false;
    }

    try {
      await this.obs.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: { text },
      });
      console.log(`[v0] Updated OBS input source "${sourceName}" to "${text}"`);
      return true;
    } catch (firstError) {
      // Fallback: try a "Text" filter on the source
      try {
        await this.obs.call('SetSourceFilterSettings', {
          sourceName,
          filterName: 'Text',
          filterSettings: { text },
        });
        console.log(`[v0] Updated OBS filter on "${sourceName}" to "${text}"`);
        return true;
      } catch (secondError) {
        console.error(`[v0] Failed to update text source "${sourceName}":`, secondError);
        return false;
      }
    }
  }

  isConnectedToOBS(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const obsManager = new OBSWebSocketManager();

/**
 * One-shot connectivity test. Connects with a fresh client, disconnects, and
 * returns a structured result. Does NOT touch the singleton `obsManager` so it
 * is safe to call from the dashboard while an overlay is also connected.
 */
export async function testObsConnection(config: OBSConfig): Promise<
  | { ok: true; url: string }
  | { ok: false; url: string; message: string; hint?: string; code?: number }
> {
  const normalizedUrl = normalizeObsUrl(config.url);
  if (!normalizedUrl) {
    return {
      ok: false,
      url: '',
      message: 'OBS WebSocket URL is empty.',
      hint: 'Enter something like ws://localhost:4455.',
    };
  }
  if (isMixedContent(normalizedUrl)) {
    return {
      ok: false,
      url: normalizedUrl,
      message: 'Mixed content blocked: this page is HTTPS but the OBS URL is ws:// (insecure).',
      hint:
        'Open the overlay over http:// (e.g. http://localhost:3000/...) or expose OBS through a wss:// tunnel.',
    };
  }

  const probe = new OBSWebSocket();
  try {
    await probe.connect(normalizedUrl, config.password);
    try {
      await probe.disconnect();
    } catch {
      /* ignore */
    }
    return { ok: true, url: normalizedUrl };
  } catch (error: any) {
    const code: number | undefined = error?.code;
    const message: string = error?.message || 'Failed to connect to OBS WebSocket';
    let hint: string | undefined;

    if (code === 4009 || /authentic/i.test(message)) {
      hint =
        'OBS rejected the password. Open OBS → Tools → WebSocket Server Settings → Show Connect Info and copy it exactly.';
    } else if (/refused|ECONNREFUSED|failed to connect|websocket is closed before/i.test(message)) {
      hint =
        'OBS did not accept the connection. Check: OBS running, "Enable WebSocket server" ON, IP/port correct, firewall open.';
    } else if (/timeout/i.test(message)) {
      hint = 'Connection timed out. Host/port unreachable from this browser.';
    }
    return { ok: false, url: normalizedUrl, message, hint, code };
  }
}
