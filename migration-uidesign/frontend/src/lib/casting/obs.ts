/** Browser-only OBS WebSocket 5.x transport. Passwords remain in the handshake closure.
 * Protocol: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
 */
export type CastingOverlayView = 'waiting' | 'draft' | 'map-pool' | 'hero-bans' | 'winner';
export type CastingSceneKey = CastingOverlayView | 'overwatch';

export type ObsClientEvent =
  | { type: 'connected'; version: string }
  | { type: 'disconnected'; error?: string }
  | { type: 'event'; eventType: string; data: Record<string, unknown> };

export class ObsError extends Error {
  constructor(message: string, readonly code?: number, readonly requestType?: string) {
    super(message);
    this.name = 'ObsError';
  }
}

interface PendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ObsClientOptions {
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  /** Test seam; production uses the browser's native WebSocket. */
  socketFactory?: (url: string) => WebSocket;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected OBS error.';
}

/** Two SHA-256 passes specified by OBS; never sends the cleartext password. */
export async function createObsAuthentication(password: string, salt: string, challenge: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new ObsError('OBS authentication requires a secure browser context (HTTPS or localhost).');
  const hash = async (value: string) => {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return btoa(String.fromCharCode(...bytes));
  };
  return hash((await hash(password + salt)) + challenge);
}

export class ObsClient {
  private socket: WebSocket | null = null;
  private identified = false;
  private counter = 0;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Set<(event: ObsClientEvent) => void>();
  private cancelHandshake: ((error: Error) => void) | null = null;

  constructor(private readonly options: ObsClientOptions = {}) {}

  get connected(): boolean { return this.identified && this.socket?.readyState === 1; }

  subscribe(listener: (event: ObsClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(event: ObsClientEvent): void {
    this.listeners.forEach(listener => { try { listener(event); } catch { /* Subscribers cannot break transport cleanup. */ } });
  }

  async connect({ url = 'ws://127.0.0.1:4455', password = '' }: { url?: string; password?: string } = {}): Promise<void> {
    this.disconnect();
    let endpoint: URL;
    try { endpoint = new URL(url); } catch { throw new ObsError('Enter a valid OBS WebSocket URL.'); }
    if (!['ws:', 'wss:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
      throw new ObsError('OBS URL must use ws:// or wss:// and must not contain credentials.');
    }
    let socket: WebSocket;
    try { socket = this.options.socketFactory?.(endpoint.href) ?? new WebSocket(endpoint.href); }
    catch { throw new ObsError('The browser could not open OBS. Enable OBS WebSocket and check the address and browser local-network permissions.'); }
    this.socket = socket;

    return new Promise<void>((resolve, reject) => {
      let done = false;
      let helloReceived = false;
      let version = '';
      const timer = setTimeout(() => fail(new ObsError('OBS connection timed out. Check WebSocket settings, address, and browser local-network permissions.')), this.options.connectTimeoutMs ?? 10_000);
      const finish = (error?: Error) => {
        if (done) return;
        done = true;
        password = '';
        clearTimeout(timer);
        this.cancelHandshake = null;
        if (error) reject(error); else resolve();
      };
      const fail = (error: Error) => {
        finish(error);
        if (this.socket === socket) this.closeSocket(socket, error.message);
      };
      this.cancelHandshake = finish;

      socket.onmessage = event => {
        if (this.socket !== socket) return;
        let message: Record<string, unknown>;
        try {
          if (typeof event.data !== 'string') throw new Error('OBS sent a non-JSON message.');
          message = asRecord(JSON.parse(event.data));
        } catch { fail(new ObsError('OBS sent an invalid protocol message. Use OBS WebSocket version 5.')); return; }
        const data = asRecord(message.d);
        if (message.op === 0) {
          if (helloReceived || this.identified) { fail(new ObsError('OBS sent a duplicate handshake.')); return; }
          helloReceived = true;
          version = String(data.obsWebSocketVersion ?? '5');
          if (typeof data.rpcVersion !== 'number' || data.rpcVersion < 1) {
            fail(new ObsError('This OBS WebSocket protocol is not supported. Version 5 is required.'));
            return;
          }
          void (async () => {
            const auth = asRecord(data.authentication);
            const identify: Record<string, unknown> = { rpcVersion: 1, eventSubscriptions: 1 | 4 | 8 | 64 | 128 };
            if (data.authentication) {
              if (!password) throw new ObsError('OBS requires a WebSocket password.');
              if (typeof auth.salt !== 'string' || typeof auth.challenge !== 'string') throw new ObsError('OBS sent an invalid authentication challenge.');
              identify.authentication = await createObsAuthentication(password, auth.salt, auth.challenge);
            }
            password = '';
            if (!done && this.socket === socket && socket.readyState === 1) socket.send(JSON.stringify({ op: 1, d: identify }));
          })().catch(error => fail(new ObsError(errorMessage(error))));
        } else if (message.op === 2) {
          if (!helloReceived || data.negotiatedRpcVersion !== 1) { fail(new ObsError('OBS did not negotiate the supported protocol.')); return; }
          this.identified = true;
          finish();
          this.emit({ type: 'connected', version });
        } else if (message.op === 7 && this.identified) {
          const request = this.pending.get(String(data.requestId));
          if (!request) return;
          clearTimeout(request.timer);
          this.pending.delete(String(data.requestId));
          const status = asRecord(data.requestStatus);
          if (status.result === true) request.resolve(asRecord(data.responseData));
          else request.reject(new ObsError(typeof status.comment === 'string' ? status.comment : `OBS rejected ${String(data.requestType)}.`, Number(status.code), String(data.requestType)));
        } else if (message.op === 5 && this.identified && typeof data.eventType === 'string') {
          this.emit({ type: 'event', eventType: data.eventType, data: asRecord(data.eventData) });
        }
      };
      socket.onerror = () => fail(new ObsError('Unable to reach OBS. Check that WebSocket is enabled and the browser permits this local connection.'));
      socket.onclose = event => {
        if (this.socket !== socket) return;
        const message = event.code === 4009
          ? 'OBS authentication failed. Check the WebSocket password.'
          : event.code === 1000 ? 'OBS disconnected.' : `OBS disconnected (${event.code}). ${event.reason || 'Check the connection and reconnect.'}`;
        finish(new ObsError(message, event.code));
        this.closeSocket(socket, message);
      };
    });
  }

  private closeSocket(socket: WebSocket, error?: string): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.identified = false;
    this.cancelHandshake?.(new ObsError(error || 'OBS disconnected.'));
    this.cancelHandshake = null;
    this.pending.forEach(request => { clearTimeout(request.timer); request.reject(new ObsError(error || 'OBS disconnected.')); });
    this.pending.clear();
    socket.onmessage = socket.onclose = socket.onerror = null;
    if (socket.readyState < 2) socket.close(1000);
    this.emit({ type: 'disconnected', error });
  }

  disconnect(): void { if (this.socket) this.closeSocket(this.socket); }

  request<T = Record<string, unknown>>(requestType: string, requestData: Record<string, unknown> = {}): Promise<T> {
    const socket = this.socket;
    if (!this.connected || !socket) return Promise.reject(new ObsError('Connect to OBS before sending requests.'));
    const requestId = `casting-${++this.counter}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new ObsError(`OBS timed out while processing ${requestType}. Retry setup to verify whether it completed.`, undefined, requestType));
      }, this.options.requestTimeoutMs ?? 8_000);
      this.pending.set(requestId, { resolve: data => resolve(data as T), reject, timer });
      try { socket.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } })); }
      catch { clearTimeout(timer); this.pending.delete(requestId); reject(new ObsError('OBS connection closed while sending the request.')); }
    });
  }

  /** The actual OBS program composition, including game capture and manual scene changes. */
  async getProgramScreenshot(imageWidth = 960): Promise<{ sceneName: string; imageData: string }> {
    const scene = await this.request<{ sceneName?: string; currentProgramSceneName?: string }>('GetCurrentProgramScene');
    const sceneName = scene.sceneName || scene.currentProgramSceneName;
    if (!sceneName) throw new ObsError('OBS has no current program scene.');
    const result = await this.request<{ imageData: string }>('GetSourceScreenshot', {
      sourceName: sceneName, imageFormat: 'jpeg', imageWidth: Math.min(1920, Math.max(320, imageWidth)), imageCompressionQuality: 75,
    });
    if (!/^data:image\/(?:jpeg|jpg|png);base64,/.test(result.imageData)) throw new ObsError('OBS did not return a valid program preview.');
    return { sceneName, imageData: result.imageData };
  }
}

export function buildCastingOverlayUrl(origin: string, matchId: string, view: CastingOverlayView, key?: string): string {
  if (!matchId.trim() || matchId.length > 128 || /[\r\n|]/.test(matchId)) throw new ObsError('A valid match ID is required for OBS setup.');
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol)) throw new ObsError('Overlay origin must use HTTP or HTTPS.');
  const url = new URL(`/overlay/casting/${encodeURIComponent(matchId)}`, base.origin);
  url.searchParams.set('view', view);
  if (key) url.searchParams.set('key', key);
  return url.href;
}

export interface CastingSceneStatus {
  key: CastingSceneKey;
  label: string;
  sceneName: string;
  browserSourceName?: string;
  captureSourceName?: string;
  url?: string;
  ready: boolean;
  error?: string;
  reused: boolean;
}

export interface CastingSceneSetup {
  matchId: string;
  ready: boolean;
  attempts: number;
  scenes: Record<CastingSceneKey, CastingSceneStatus>;
  issues: string[];
  discoveredSceneNames: Partial<Record<CastingSceneKey, string[]>>;
  /** Readback verifies configuration. The operator must also check the program preview. */
  needsVisualCheck: true;
}

export interface CastingSceneSetupOptions {
  matchId: string;
  origin: string;
  /** Broadcast share key, never the user's login token or OBS password. */
  key?: string;
  captureInputName?: string;
  maxAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (setup: CastingSceneSetup) => void;
}

interface ObsInput { inputName: string; inputKind: string; unversionedInputKind?: string }
interface ObsScene { sceneName: string }
interface ObsSceneItem { sceneItemId: number; sourceName: string; sceneItemEnabled: boolean }
interface InspectedInput extends ObsInput { settings: Record<string, unknown> }
interface Inventory {
  scenes: ObsScene[];
  inputs: InspectedInput[];
  baseWidth: number;
  baseHeight: number;
  browserKind: string;
}

const labels: Record<CastingSceneKey, string> = {
  waiting: 'Waiting for captains', draft: 'Draft table', 'map-pool': 'Map pool',
  'hero-bans': 'Hero bans', winner: 'Winner cards', overwatch: 'Overwatch',
};
const overlayKeys: CastingOverlayView[] = ['waiting', 'draft', 'map-pool', 'hero-bans', 'winner'];
const allKeys: CastingSceneKey[] = [...overlayKeys, 'overwatch'];
const sceneAliases: Record<CastingSceneKey, RegExp> = {
  waiting: /waiting|captains/i, draft: /draft|map[ _-]*pick/i, 'map-pool': /map[ _-]*pool/i,
  'hero-bans': /hero[ _-]*bans?|bans?/i, winner: /winner[ _-]*cards?|winners?|results?/i, overwatch: /overwatch|game[ _-]*play/i,
};
const setupManifests = new WeakMap<ObsClient, Map<string, Partial<Record<CastingSceneKey, string>>>>();
const runningSetups = new WeakSet<ObsClient>();

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ObsError('OBS scene setup was cancelled.');
}

function snapshot(setup: CastingSceneSetup): CastingSceneSetup {
  return { ...setup, scenes: Object.fromEntries(allKeys.map(key => [key, { ...setup.scenes[key] }])) as CastingSceneSetup['scenes'], issues: [...setup.issues] };
}

function matchingOverlay(input: InspectedInput, expectedUrl: string): boolean {
  if (!/^browser_source(?:_v\d+)?$/.test(input.unversionedInputKind || input.inputKind) || typeof input.settings.url !== 'string') return false;
  try {
    const actual = new URL(input.settings.url);
    const expected = new URL(expectedUrl);
    return actual.origin === expected.origin && actual.pathname === expected.pathname && actual.searchParams.get('view') === expected.searchParams.get('view');
  } catch { return false; }
}

function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let count = 2;
  while (existing.includes(`${base} (${count})`)) count++;
  return `${base} (${count})`;
}

async function inspectInventory(client: ObsClient, signal?: AbortSignal): Promise<Inventory> {
  checkCancelled(signal);
  const [sceneList, inputList, video, kinds, version] = await Promise.all([
    client.request<{ scenes: ObsScene[] }>('GetSceneList'),
    client.request<{ inputs: ObsInput[] }>('GetInputList'),
    client.request<{ baseWidth: number; baseHeight: number }>('GetVideoSettings'),
    client.request<{ inputKinds: string[] }>('GetInputKindList', { unversioned: true }),
    client.request<{ availableRequests: string[] }>('GetVersion'),
  ]);
  const required = ['CreateScene', 'CreateInput', 'GetInputSettings', 'SetInputSettings', 'CreateSceneItem', 'GetSceneItemList', 'GetSceneItemTransform', 'SetSceneItemTransform', 'GetSceneItemEnabled', 'SetSceneItemEnabled', 'GetCurrentProgramScene', 'GetSourceScreenshot', 'SetCurrentProgramScene'];
  const missing = required.filter(request => !version.availableRequests.includes(request));
  if (missing.length) throw new ObsError(`This OBS instance does not support: ${missing.join(', ')}.`);
  const inputs: InspectedInput[] = [];
  for (const input of inputList.inputs) {
    checkCancelled(signal);
    const kind = input.unversionedInputKind || input.inputKind;
    if (!/^(?:browser_source|game_capture)(?:_v\d+)?$/.test(kind)) continue;
    const details = await client.request<{ inputSettings: Record<string, unknown> }>('GetInputSettings', { inputName: input.inputName });
    inputs.push({ ...input, settings: details.inputSettings });
  }
  const browserKind = kinds.inputKinds.find(kind => /^browser_source(?:_v\d+)?$/.test(kind));
  if (!browserKind) throw new ObsError('OBS Browser Source is unavailable. Install or enable the OBS browser component.');
  if (!(video.baseWidth > 0 && video.baseHeight > 0)) throw new ObsError('OBS canvas dimensions are unavailable.');
  // Keep all names to avoid collisions with sources outside the inspected kinds.
  for (const input of inputList.inputs) {
    if (!inputs.some(inspected => inspected.inputName === input.inputName)) inputs.push({ ...input, settings: {} });
  }
  return { scenes: sceneList.scenes, inputs, baseWidth: video.baseWidth, baseHeight: video.baseHeight, browserKind };
}

async function getSceneItems(client: ObsClient, sceneName: string): Promise<ObsSceneItem[]> {
  return (await client.request<{ sceneItems: ObsSceneItem[] }>('GetSceneItemList', { sceneName })).sceneItems;
}

async function findOrCreateScene(client: ObsClient, inventory: Inventory, status: CastingSceneStatus, manifests: Partial<Record<CastingSceneKey, string>>, scopePrefix: string, sourceName?: string): Promise<string> {
  const remembered = manifests[status.key];
  if (remembered && inventory.scenes.some(scene => scene.sceneName === remembered)) {
    const items = await getSceneItems(client, remembered);
    // If an operator repurposes a previously created scene, do not alter that scene.
    if (items.every(item => item.sourceName === sourceName)) return remembered;
  }
  // A generic alias only becomes reusable after its source proves that it belongs to this match.
  if (sourceName) {
    const candidates = inventory.scenes.filter(scene => scene.sceneName === status.sceneName || sceneAliases[status.key].test(scene.sceneName));
    for (const candidate of candidates) {
      const items = await getSceneItems(client, candidate.sceneName);
      if (!items.some(item => item.sourceName === sourceName)) continue;
      // Game capture is global. Its presence in an unrelated scene does not establish match ownership.
      if (status.key === 'overwatch' && !candidate.sceneName.startsWith(scopePrefix)) continue;
      manifests[status.key] = candidate.sceneName;
      status.reused = true;
      return candidate.sceneName;
    }
  }
  const sceneName = uniqueName(status.sceneName, [...inventory.scenes.map(scene => scene.sceneName), ...inventory.inputs.map(input => input.inputName)]);
  await client.request('CreateScene', { sceneName });
  inventory.scenes.push({ sceneName });
  manifests[status.key] = sceneName;
  return sceneName;
}

async function fitAndEnable(client: ObsClient, inventory: Inventory, sceneName: string, sceneItemId: number): Promise<Record<string, unknown>> {
  await client.request('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: {
    positionX: 0, positionY: 0, rotation: 0, alignment: 5,
    boundsType: 'OBS_BOUNDS_STRETCH', boundsAlignment: 0, boundsWidth: inventory.baseWidth, boundsHeight: inventory.baseHeight,
    cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
  } });
  await client.request('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: true });
  const enabled = await client.request<{ sceneItemEnabled: boolean }>('GetSceneItemEnabled', { sceneName, sceneItemId });
  if (!enabled.sceneItemEnabled) throw new ObsError('The scene source is still disabled. Resume setup.');
  const { sceneItemTransform } = await client.request<{ sceneItemTransform: Record<string, unknown> }>('GetSceneItemTransform', { sceneName, sceneItemId });
  if (sceneItemTransform.boundsType !== 'OBS_BOUNDS_STRETCH' || sceneItemTransform.boundsWidth !== inventory.baseWidth || sceneItemTransform.boundsHeight !== inventory.baseHeight || sceneItemTransform.positionX !== 0 || sceneItemTransform.positionY !== 0) {
    throw new ObsError('OBS did not confirm the source canvas placement. Resume setup.');
  }
  return sceneItemTransform;
}

async function ensureOverlay(client: ObsClient, inventory: Inventory, status: CastingSceneStatus, manifests: Partial<Record<CastingSceneKey, string>>, scopePrefix: string, signal?: AbortSignal): Promise<void> {
  checkCancelled(signal);
  const url = status.url!;
  let input = inventory.inputs.find(input => matchingOverlay(input, url));
  status.sceneName = await findOrCreateScene(client, inventory, status, manifests, scopePrefix, input?.inputName);
  checkCancelled(signal);
  const items = await getSceneItems(client, status.sceneName);
  let sceneItemId: number;
  const settings = { url, width: inventory.baseWidth, height: inventory.baseHeight, shutdown: false, restart_when_active: false };
  if (input) {
    status.reused = true;
    // Only exact-match URLs qualify; generic browser sources are never retargeted.
    await client.request('SetInputSettings', { inputName: input.inputName, inputSettings: settings, overlay: true });
    const item = items.find(item => item.sourceName === input!.inputName);
    sceneItemId = item?.sceneItemId ?? (await client.request<{ sceneItemId: number }>('CreateSceneItem', { sceneName: status.sceneName, sourceName: input.inputName, sceneItemEnabled: true })).sceneItemId;
  } else {
    const inputName = uniqueName(`${scopePrefix}${status.label} Browser`, [...inventory.inputs.map(input => input.inputName), ...inventory.scenes.map(scene => scene.sceneName)]);
    const created = await client.request<{ sceneItemId: number }>('CreateInput', { sceneName: status.sceneName, inputName, inputKind: inventory.browserKind, inputSettings: settings, sceneItemEnabled: true });
    sceneItemId = created.sceneItemId;
    input = { inputName, inputKind: inventory.browserKind, settings };
    inventory.inputs.push(input);
  }
  status.browserSourceName = input.inputName;
  checkCancelled(signal);
  await fitAndEnable(client, inventory, status.sceneName, sceneItemId);
  const readback = await client.request<{ inputSettings: Record<string, unknown> }>('GetInputSettings', { inputName: input.inputName });
  if (!matchingOverlay({ ...input, settings: readback.inputSettings }, url) || readback.inputSettings.url !== url || readback.inputSettings.width !== inventory.baseWidth || readback.inputSettings.height !== inventory.baseHeight) {
    throw new ObsError('OBS browser source settings did not match this match. Resume setup.');
  }
  status.ready = true;
  status.error = undefined;
}

async function ensureCapture(client: ObsClient, inventory: Inventory, status: CastingSceneStatus, manifests: Partial<Record<CastingSceneKey, string>>, options: CastingSceneSetupOptions): Promise<void> {
  checkCancelled(options.signal);
  const capture = inventory.inputs.find(input => {
    if (!/^game_capture(?:_v\d+)?$/.test(input.unversionedInputKind || input.inputKind)) return false;
    const window = typeof input.settings.window === 'string' ? input.settings.window : '';
    if (options.captureInputName) return input.inputName === options.captureInputName && (Boolean(window) || input.settings.capture_mode === 'any_fullscreen');
    return /overwatch(?:\.exe)?/i.test(window);
  });
  if (!capture) throw new ObsError('Add a Game Capture source in OBS targeting the Overwatch window, then resume setup. An empty or unrelated capture cannot be marked ready.');
  status.sceneName = await findOrCreateScene(client, inventory, status, manifests, `GG Casting | ${options.matchId} | `, capture.inputName);
  const items = await getSceneItems(client, status.sceneName);
  const existing = items.find(item => item.sourceName === capture.inputName);
  const sceneItemId = existing?.sceneItemId ?? (await client.request<{ sceneItemId: number }>('CreateSceneItem', { sceneName: status.sceneName, sourceName: capture.inputName, sceneItemEnabled: true })).sceneItemId;
  // Only the item in the match scene changes; the shared game-capture input is never reconfigured.
  const transform = await fitAndEnable(client, inventory, status.sceneName, sceneItemId);
  if (!(Number(transform.sourceWidth) > 0 && Number(transform.sourceHeight) > 0)) {
    throw new ObsError('Overwatch capture has no image dimensions yet. Open Overwatch and verify its Game Capture source, then resume setup.');
  }
  status.captureSourceName = capture.inputName;
  status.ready = true;
  status.error = undefined;
}

async function retryDelay(signal?: AbortSignal): Promise<void> {
  checkCancelled(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(new ObsError('OBS scene setup was cancelled.')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, 500);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Bounded, resumable provisioning; no streaming starts and no program scene changes here.
 * Every attempt re-inspects OBS and verifies every role. Missing capture or failed readback
 * returns ready=false; onProgress gives the operator the incomplete roles and a resume path.
 */
export async function ensureCastingScenes(client: ObsClient, options: CastingSceneSetupOptions): Promise<CastingSceneSetup> {
  if (runningSetups.has(client)) throw new ObsError('OBS setup is already running. Wait for it to finish before resuming.');
  const baseUrl = buildCastingOverlayUrl(options.origin, options.matchId, 'waiting', options.key);
  const prefix = `GG Casting | ${options.matchId} | `;
  const setup: CastingSceneSetup = {
    matchId: options.matchId, ready: false, attempts: 0, issues: [], discoveredSceneNames: {}, needsVisualCheck: true,
    scenes: Object.fromEntries(allKeys.map(key => [key, {
      key, label: labels[key], sceneName: prefix + labels[key], ready: false, reused: false,
      ...(key === 'overwatch' ? {} : { url: buildCastingOverlayUrl(new URL(baseUrl).origin, options.matchId, key, options.key) }),
    }])) as CastingSceneSetup['scenes'],
  };
  let byMatch = setupManifests.get(client);
  if (!byMatch) { byMatch = new Map(); setupManifests.set(client, byMatch); }
  const manifestKey = `${new URL(baseUrl).origin}|${options.matchId}`;
  const manifests = byMatch.get(manifestKey) ?? {};
  byMatch.set(manifestKey, manifests);
  runningSetups.add(client);
  const publish = () => { setup.ready = allKeys.every(key => setup.scenes[key].ready); options.onProgress?.(snapshot(setup)); };
  try {
    const maxAttempts = Math.min(5, Math.max(1, Math.floor(options.maxAttempts ?? 3)));
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      checkCancelled(options.signal);
      setup.attempts = attempt;
      setup.issues = [];
      allKeys.forEach(key => { setup.scenes[key].ready = false; setup.scenes[key].error = undefined; });
      publish();
      let inventory: Inventory;
      try { inventory = await inspectInventory(client, options.signal); }
      catch (error) {
        checkCancelled(options.signal);
        setup.issues.push(errorMessage(error));
        allKeys.forEach(key => { setup.scenes[key].error = errorMessage(error); });
        publish();
        if (!client.connected || attempt === maxAttempts) break;
        await retryDelay(options.signal);
        continue;
      }
      for (const key of allKeys) setup.discoveredSceneNames[key] = inventory.scenes.filter(scene => sceneAliases[key].test(scene.sceneName)).map(scene => scene.sceneName);
      for (const key of allKeys) {
        checkCancelled(options.signal);
        const status = setup.scenes[key];
        try {
          if (key === 'overwatch') await ensureCapture(client, inventory, status, manifests, options);
          else await ensureOverlay(client, inventory, status, manifests, prefix, options.signal);
        } catch (error) {
          checkCancelled(options.signal);
          status.ready = false;
          status.error = errorMessage(error);
          setup.issues.push(`${status.label}: ${status.error}`);
        }
        publish();
      }
      if (setup.ready || !client.connected || attempt === maxAttempts) break;
      await retryDelay(options.signal);
    }
    return snapshot(setup);
  } finally { runningSetups.delete(client); }
}

/** Manual and automatic transitions share the same guard and confirmation readback. */
export async function switchCastingScene(client: ObsClient, setup: CastingSceneSetup, key: CastingSceneKey): Promise<void> {
  const scene = setup.scenes[key];
  if (!scene.ready) throw new ObsError(`${scene.label} is not ready. Resume OBS setup before switching scenes.`);
  await client.request('SetCurrentProgramScene', { sceneName: scene.sceneName });
  const current = await client.request<{ sceneName?: string; currentProgramSceneName?: string }>('GetCurrentProgramScene');
  if ((current.sceneName || current.currentProgramSceneName) !== scene.sceneName) throw new ObsError('OBS did not confirm the requested program scene. Check OBS and retry.');
}
