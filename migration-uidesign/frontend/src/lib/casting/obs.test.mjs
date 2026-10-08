// Run: node --experimental-transform-types --test src/lib/casting/obs.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ObsClient, buildCastingOverlayUrl, createObsAuthentication, ensureCastingScenes, switchCastingScene } from './obs.ts';

class FakeSocket {
  readyState = 1;
  onmessage = null;
  onclose = null;
  onerror = null;
  sent = [];
  constructor(handleRequest = () => ({}), authenticated = false) {
    this.handleRequest = handleRequest;
    queueMicrotask(() => this.receive({ op: 0, d: { rpcVersion: 1, obsWebSocketVersion: '5.6.3',
      ...(authenticated ? { authentication: { salt: 'salt', challenge: 'challenge' } } : {}),
    } }));
  }
  receive(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
  send(raw) {
    const message = JSON.parse(raw);
    this.sent.push(message);
    if (message.op === 1) queueMicrotask(() => this.receive({ op: 2, d: { negotiatedRpcVersion: 1 } }));
    else if (message.op === 6) queueMicrotask(async () => {
      try {
        const responseData = await this.handleRequest(message.d.requestType, message.d.requestData);
        if (responseData === null) return;
        this.receive({ op: 7, d: { requestId: message.d.requestId, requestType: message.d.requestType, requestStatus: { result: true, code: 100 }, responseData } });
      } catch (error) {
        this.receive({ op: 7, d: { requestId: message.d.requestId, requestType: message.d.requestType, requestStatus: { result: false, code: 500, comment: error.message } } });
      }
    });
  }
  close() { this.readyState = 3; }
}

test('OBS authentication follows the documented two SHA-256 passes and never sends a cleartext password', async () => {
  const sha = value => createHash('sha256').update(value).digest('base64');
  assert.equal(await createObsAuthentication('secret', 'salt', 'challenge'), sha(sha('secretsalt') + 'challenge'));
  const socket = new FakeSocket(undefined, true);
  const client = new ObsClient({ socketFactory: () => socket });
  await client.connect({ password: 'secret' });
  assert.equal(socket.sent[0].op, 1);
  assert.equal(socket.sent[0].d.authentication, sha(sha('secretsalt') + 'challenge'));
  assert.ok(!JSON.stringify(socket.sent).includes('secret'));
  client.disconnect();
});

test('rejects invalid credentials, times out requests, and clears pending requests on disconnect', async () => {
  const client = new ObsClient({ socketFactory: () => new FakeSocket(() => null), requestTimeoutMs: 15 });
  await assert.rejects(client.connect({ url: 'https://localhost:4455' }), /ws:\/\//);
  await assert.rejects(client.connect({ url: 'ws://user:secret@localhost:4455' }), /credentials/);
  await client.connect();
  await assert.rejects(client.request('GetStats'), /timed out/);
  const pending = client.request('GetSceneList');
  client.disconnect();
  await assert.rejects(pending, /disconnected/);
  assert.equal(client.connected, false);
  await assert.rejects(client.request('GetStats'), /Connect to OBS/);
});

test('rejects missing password, and preserves the authentication-specific close message', async () => {
  const noPassword = new ObsClient({ socketFactory: () => new FakeSocket(undefined, true) });
  await assert.rejects(noPassword.connect(), /requires a WebSocket password/);
  const socket = new FakeSocket();
  socket.send = () => queueMicrotask(() => socket.onclose?.({ code: 4009, reason: '' }));
  const badPassword = new ObsClient({ socketFactory: () => socket });
  await assert.rejects(badPassword.connect({ password: 'incorrect' }), /authentication failed/);
});

function makeObs({ capture = true, failDraftOnce = false } = {}) {
  const matchId = 'match-123';
  const origin = 'https://goonginga.example';
  const current = { value: 'Overwatch' };
  const inputs = new Map([
    ['Foreign winner browser', { inputName: 'Foreign winner browser', inputKind: 'browser_source', settings: { url: `${origin}/overlay/casting/other-match?view=winner`, width: 1920, height: 1080 } }],
    ['Our map pool', { inputName: 'Our map pool', inputKind: 'browser_source', settings: { url: buildCastingOverlayUrl(origin, matchId, 'map-pool', 'old-key'), width: 800, height: 600 } }],
    ...(capture ? [['Overwatch capture', { inputName: 'Overwatch capture', inputKind: 'game_capture', settings: { window: 'Overwatch:TankWindowClass:Overwatch.exe', capture_mode: 'window' } }]] : []),
  ]);
  const scenes = new Map([
    ['Winner Cards', [{ sceneItemId: 1, sourceName: 'Foreign winner browser', sceneItemEnabled: true }]],
    ['Map Pool', [{ sceneItemId: 2, sourceName: 'Our map pool', sceneItemEnabled: true }]],
    ['Overwatch', capture ? [{ sceneItemId: 3, sourceName: 'Overwatch capture', sceneItemEnabled: true }] : []],
  ]);
  const mutations = [];
  let id = 3;
  let failed = false;
  const required = ['CreateScene', 'CreateInput', 'GetInputSettings', 'SetInputSettings', 'CreateSceneItem', 'GetSceneItemList', 'GetSceneItemTransform', 'SetSceneItemTransform', 'GetSceneItemEnabled', 'SetSceneItemEnabled', 'GetCurrentProgramScene', 'GetSourceScreenshot', 'SetCurrentProgramScene'];
  const socket = new FakeSocket((type, data) => {
    if (type.startsWith('Set') || type.startsWith('Create')) mutations.push({ type, data: structuredClone(data) });
    switch (type) {
      case 'GetVersion': return { availableRequests: required };
      case 'GetSceneList': return { scenes: [...scenes.keys()].map(sceneName => ({ sceneName })), currentProgramSceneName: current.value };
      case 'GetInputList': return { inputs: [...inputs.values()].map(({ settings, ...input }) => input) };
      case 'GetVideoSettings': return { baseWidth: 1920, baseHeight: 1080 };
      case 'GetInputKindList': return { inputKinds: ['browser_source', 'game_capture'] };
      case 'GetInputSettings': return { inputSettings: inputs.get(data.inputName).settings };
      case 'GetSceneItemList': return { sceneItems: scenes.get(data.sceneName) };
      case 'CreateScene':
        assert.ok(!scenes.has(data.sceneName));
        scenes.set(data.sceneName, []);
        return {};
      case 'CreateInput': {
        if (failDraftOnce && !failed && data.inputName.includes('Draft table')) { failed = true; throw new Error('Temporary browser creation error'); }
        assert.ok(!inputs.has(data.inputName));
        inputs.set(data.inputName, { inputName: data.inputName, inputKind: data.inputKind, settings: data.inputSettings });
        scenes.get(data.sceneName).push({ sceneItemId: ++id, sourceName: data.inputName, sceneItemEnabled: data.sceneItemEnabled });
        return { sceneItemId: id };
      }
      case 'CreateSceneItem':
        scenes.get(data.sceneName).push({ sceneItemId: ++id, sourceName: data.sourceName, sceneItemEnabled: data.sceneItemEnabled });
        return { sceneItemId: id };
      case 'SetInputSettings':
        inputs.get(data.inputName).settings = { ...inputs.get(data.inputName).settings, ...data.inputSettings };
        return {};
      case 'SetSceneItemTransform': scenes.get(data.sceneName).find(item => item.sceneItemId === data.sceneItemId).transform = data.sceneItemTransform; return {};
      case 'GetSceneItemTransform': return { sceneItemTransform: { ...scenes.get(data.sceneName).find(item => item.sceneItemId === data.sceneItemId).transform, sourceWidth: 1920, sourceHeight: 1080 } };
      case 'SetSceneItemEnabled': scenes.get(data.sceneName).find(item => item.sceneItemId === data.sceneItemId).sceneItemEnabled = data.sceneItemEnabled; return {};
      case 'GetSceneItemEnabled': return { sceneItemEnabled: scenes.get(data.sceneName).find(item => item.sceneItemId === data.sceneItemId).sceneItemEnabled };
      case 'SetCurrentProgramScene': current.value = data.sceneName; return {};
      case 'GetCurrentProgramScene': return { currentProgramSceneName: current.value };
      case 'GetSourceScreenshot': return { imageData: 'data:image/jpeg;base64,AA==' };
      default: throw new Error(`Unexpected request ${type}`);
    }
  });
  const client = new ObsClient({ socketFactory: () => socket });
  return { client, scenes, inputs, mutations, matchId, origin };
}

test('provisions only this match, reuses its map pool alias, preserves foreign sources, and resumes temporary failures', async () => {
  const obs = makeObs({ failDraftOnce: true });
  await obs.client.connect();
  const foreignBefore = structuredClone(obs.inputs.get('Foreign winner browser'));
  const snapshots = [];
  const setup = await ensureCastingScenes(obs.client, { matchId: obs.matchId, origin: obs.origin, key: 'viewer-key', maxAttempts: 2, onProgress: value => snapshots.push(value) });
  assert.equal(setup.ready, true);
  assert.equal(setup.attempts, 2);
  assert.equal(setup.needsVisualCheck, true);
  assert.ok(snapshots.some(value => value.scenes.draft.error?.includes('Temporary')));
  assert.equal(setup.scenes['map-pool'].sceneName, 'Map Pool');
  assert.equal(obs.inputs.get('Our map pool').settings.url, buildCastingOverlayUrl(obs.origin, obs.matchId, 'map-pool', 'viewer-key'));
  assert.deepEqual(obs.inputs.get('Foreign winner browser'), foreignBefore);
  assert.ok(setup.scenes.winner.sceneName.startsWith('GG Casting | match-123 | '));
  assert.ok(setup.scenes.overwatch.sceneName.startsWith('GG Casting | match-123 | '));
  assert.equal(setup.scenes.overwatch.captureSourceName, 'Overwatch capture');
  assert.equal(obs.mutations.filter(value => value.type === 'CreateScene' && value.data.sceneName.includes('Draft table')).length, 1);
  assert.equal(obs.mutations.filter(value => value.type === 'SetCurrentProgramScene').length, 0);
  const counts = { scenes: obs.scenes.size, inputs: obs.inputs.size };
  await ensureCastingScenes(obs.client, { matchId: obs.matchId, origin: obs.origin, maxAttempts: 1 });
  assert.equal(obs.scenes.size, counts.scenes);
  assert.equal(obs.inputs.size, counts.inputs);
  await switchCastingScene(obs.client, setup, 'winner');
  assert.equal((await obs.client.getProgramScreenshot()).sceneName, setup.scenes.winner.sceneName);
  obs.client.disconnect();
});

test('missing capture stays incomplete while completing all browser roles; later manual resume succeeds', async () => {
  const obs = makeObs({ capture: false });
  await obs.client.connect();
  const setup = await ensureCastingScenes(obs.client, { matchId: obs.matchId, origin: obs.origin, maxAttempts: 1 });
  assert.equal(setup.ready, false);
  assert.equal(setup.scenes.overwatch.ready, false);
  assert.match(setup.scenes.overwatch.error, /Game Capture/);
  for (const key of ['waiting', 'draft', 'map-pool', 'hero-bans', 'winner']) assert.equal(setup.scenes[key].ready, true);
  await assert.rejects(switchCastingScene(obs.client, setup, 'overwatch'), /not ready/);
  obs.inputs.set('Configured capture', { inputName: 'Configured capture', inputKind: 'game_capture', settings: { window: 'Overwatch:TankWindowClass:Overwatch.exe', capture_mode: 'window' } });
  const resumed = await ensureCastingScenes(obs.client, { matchId: obs.matchId, origin: obs.origin, maxAttempts: 1 });
  assert.equal(resumed.ready, true);
  obs.client.disconnect();
});

test('overlay URLs encode share credentials and reject missing or ambiguous match identities', () => {
  const url = new URL(buildCastingOverlayUrl('https://goonginga.example/ignored', 'match / 123', 'winner', 'viewer+/key='));
  assert.equal(url.pathname, '/overlay/casting/match%20%2F%20123');
  assert.equal(url.searchParams.get('key'), 'viewer+/key=');
  assert.equal(url.searchParams.get('view'), 'winner');
  assert.throws(() => buildCastingOverlayUrl('https://example.org', '', 'waiting'), /match ID/);
  assert.throws(() => buildCastingOverlayUrl('https://example.org', 'match | other', 'waiting'), /match ID/);
});
