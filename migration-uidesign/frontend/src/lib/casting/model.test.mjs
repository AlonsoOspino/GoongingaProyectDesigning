import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticView, belongsToCurrentMap, currentMapNumber, heroVideo, mapPoolIds } from './model.ts';

const draft = (phase = 'PLAYING', number = 1, mapId = 81) => ({
  id: 100, matchId: 8, phase, currentMapId: mapId,
  match: { id:8, gameNumber:phase === 'STARTING' ? number : number - 1 },
  actions: [{ action:'PICK', gameNumber:number, value:mapId, order:1 }],
  allMaps: [{id:81,description:"King's Row"}, {id:82,description:'Dorado'}]
});
const live = {matchId:8,gameNumber:1,mapName:"King’s Row"};

test('queued game start selects Overwatch only for its current map and round', () => {
  assert.equal(automaticView(draft(),live),'overwatch');
  assert.equal(automaticView(draft('PLAYING',2),live),'hero-bans');
  assert.equal(automaticView(draft('PLAYING',1,82),live),'hero-bans');
  assert.equal(automaticView(draft(),{...live,matchId:9}),'hero-bans');
  assert.equal(belongsToCurrentMap(draft(),live),true);
});
test('winner cards hold until the operator starts the next round', () => {
  assert.equal(automaticView(draft('STARTING',1,null),live),'winner');
  assert.equal(automaticView(draft('STARTING',0,null)),'waiting');
  assert.equal(automaticView(draft('MAPPICKING',2)),'draft');
  assert.equal(currentMapNumber(draft('ENDMAP',2)),2);
});
test('video manifest accepts named or ID HTTPS clips and rejects unsafe URLs', () => {
  const hero = { id:1,name:'Ana' };
  assert.deepEqual(heroVideo({ana:'https://cdn.example/ana.webm'},hero),{url:'https://cdn.example/ana.webm',objectPosition:'50% 50%'});
  assert.equal(heroVideo({'1':{url:'https://cdn.example/ana.webm',objectPosition:'55% 50%'}},hero).objectPosition,'55% 50%');
  for (const url of ['javascript:alert(1)','file:///ana.webm','http://cdn.example/ana.webm','invalid']) assert.equal(heroVideo({ana:url},hero),null);
});
test('map pool IDs are unique positive integers', () => {
  assert.deepEqual(mapPoolIds({mapsAllowedByRound:{1:[1,2,1],2:[2,3,0,-1,2.5]}}),[1,2,3]);
});
