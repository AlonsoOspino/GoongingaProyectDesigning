const crypto = require("crypto");
const prisma = require("../config/prisma");
const { hasManagerAccess, hasNetworkRole } = require("../utils/permissions");
const realtime = require("../services/familyFeudRealtime");

const ACTIVE_ANSWER_PHASES = new Set(["FACE_OFF_FIRST_ANSWER", "FACE_OFF_SECOND_ANSWER", "ROUND_PLAY", "STEAL", "FAST_MONEY"]);
const MANAGER_ACTIONS = new Set([
  "LOCK_TEAMS", "MOVE_PLAYER", "REMOVE_PLAYER", "SET_CAPTAIN", "START_GAME", "START_FACE_OFF", "START_EXTERNAL_FACE_OFF",
  "SET_FACE_OFF_REPRESENTATIVES", "RECORD_EXTERNAL_WINNER", "CONFIRM_EXTERNAL_WINNER", "ACCEPT_RESPONSE",
  "REJECT_RESPONSE", "REVEAL_ANSWER", "ADD_STRIKE", "REMOVE_STRIKE", "ADJUST_BANK", "ADJUST_SCORE",
  "START_STEAL", "RESOLVE_STEAL", "END_ROUND", "NEXT_ROUND", "START_FAST_MONEY", "END_GAME", "PAUSE", "RESUME",
]);

const STARTER_QUESTIONS = [
  ["Name something players do while waiting in a game queue.", "GAMING", [["Watch videos", 32], ["Check their phone", 26], ["Talk in voice chat", 18], ["Get a snack", 14], ["Practice", 10]]],
  ["Name something that can ruin a team game night.", "GAMING", [["Bad connection", 34], ["A teammate leaves", 25], ["Arguments", 18], ["A late player", 13], ["Server problems", 10]]],
  ["Name something people do when they cannot sleep.", "GENERAL", [["Check their phone", 36], ["Watch television", 24], ["Read", 17], ["Listen to music", 13], ["Get a drink", 10]]],
  ["Name something people forget when leaving home.", "GENERAL", [["Keys", 38], ["Phone", 27], ["Wallet", 18], ["Headphones", 10], ["Lunch", 7]]],
  ["Name something a competitive player blames after a loss.", "COMMUNITY", [["Teammates", 31], ["Lag", 25], ["Matchmaking", 19], ["Balance", 15], ["Their equipment", 10]]],
  ["Name something you hear during an intense match.", "COMMUNITY", [["Callouts", 35], ["Complaints", 24], ["Celebrating", 18], ["Keyboard sounds", 13], ["Silence", 10]]],
];

async function ensureStarterQuestions(memberId) {
  if (await prisma.feudQuestion.count() > 0) return;
  await prisma.$transaction(STARTER_QUESTIONS.map(([question, category, answers]) => prisma.feudQuestion.create({
    data: {
      question,
      category,
      pack: "Family Feud Starter",
      createdById: memberId,
      answers: { create: answers.map(([answer, points], index) => ({ answer, points, rank: index + 1, aliases: [] })) },
    },
  })));
}

function cleanText(value, max = 160) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function normalizeAnswer(value) {
  return cleanText(value, 160).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

function answerSimilarity(left, right) {
  const a = normalizeAnswer(left);
  const b = normalizeAnswer(right);
  if (!a || !b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}

function randomToken(size = 12) {
  return crypto.randomBytes(size).toString("hex").toUpperCase();
}

function displayName(member) {
  return member?.nickname || member?.username || "Player";
}

function memberImage(member) {
  return member?.profilePic || member?.avatarUrl || null;
}

function defaultState(config = {}) {
  return {
    schemaVersion: 2,
    phase: "LOBBY",
    previousPhase: null,
    teamsLocked: false,
    currentRound: 0,
    usedQuestionIds: [],
    revealedAnswerIds: [],
    pendingExternalWinnerMemberId: null,
    pendingResponseId: null,
    activeMemberId: null,
    activeSide: null,
    playPassWinnerSide: null,
    roundWinnerSide: null,
    turnIndex: 0,
    faceOffResults: [],
    pausedRemainingMs: null,
    fastMoney: null,
    config: {
      maxPlayersPerTeam: Math.min(8, Math.max(1, Number(config.maxPlayersPerTeam) || 5)),
      answerSeconds: Math.min(90, Math.max(5, Number(config.answerSeconds) || 20)),
      roundCount: Math.min(8, Math.max(1, Number(config.roundCount) || 4)),
      fastMoneyTarget: Math.min(500, Math.max(50, Number(config.fastMoneyTarget) || 200)),
      category: cleanText(config.category || "", 48) || null,
      pack: cleanText(config.pack || "", 80) || null,
    },
  };
}

function isGameManager(game, user) {
  return Boolean(user?.accountType === "NETWORK_MEMBER" && (Number(game.managerMemberId) === Number(user.id) || user.role === "ADMIN" || hasNetworkRole(user, "ADMIN")));
}

function teamBySide(game, side) {
  return game.teams.find((team) => team.side === side) || null;
}

function otherSide(side) {
  return side === "ALPHA" ? "BETA" : "ALPHA";
}

function activeRound(game) {
  return game.rounds?.[0] || null;
}

function participantsFor(game, side) {
  const team = teamBySide(game, side);
  return game.participants.filter((participant) => participant.role === "PLAYER" && participant.teamId === team?.id);
}

function participantForMember(game, memberId) {
  return game.participants.find((participant) => Number(participant.memberId) === Number(memberId)) || null;
}

function orderedPlayers(game, side) {
  return participantsFor(game, side).sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
}

function nextPlayerMemberId(game, side, currentIndex = -1) {
  const players = orderedPlayers(game, side);
  if (!players.length) return null;
  return players[(currentIndex + 1) % players.length].memberId;
}

const gameInclude = {
  manager: { select: { id: true, username: true, nickname: true, avatarUrl: true, profilePic: true } },
  teams: { orderBy: { side: "asc" } },
  participants: {
    orderBy: { joinedAt: "asc" },
    include: { member: { select: { id: true, username: true, nickname: true, avatarUrl: true, profilePic: true } } },
  },
  rounds: {
    orderBy: { roundNumber: "desc" },
    take: 1,
    include: {
      question: { include: { answers: { orderBy: { rank: "asc" } } } },
      responses: {
        orderBy: { createdAt: "asc" },
        include: {
          member: { select: { id: true, username: true, nickname: true } },
          matchedAnswer: true,
        },
      },
      faceOff: true,
    },
  },
};

async function findGame(client, code) {
  return client.familyFeudGame.findFirst({
    where: { OR: [{ code: String(code).toUpperCase() }, { roomId: String(code) }] },
    include: gameInclude,
  });
}

function publicParticipant(participant) {
  return {
    name: displayName(participant.member),
    avatarUrl: memberImage(participant.member),
    ready: participant.ready,
    connected: Date.now() - participant.lastSeenAt.getTime() < 45000,
  };
}

function buildProjection(game, view, user) {
  const state = game.state && typeof game.state === "object" ? game.state : defaultState();
  const round = activeRound(game);
  const managerView = view === "manager" && isGameManager(game, user);
  if (["player", "manager"].includes(view) && user?.accountType !== "NETWORK_MEMBER") {
    const error = new Error("Sign in with your Network account to open this view.");
    error.status = 401;
    throw error;
  }
  const participant = user ? participantForMember(game, user.id) : null;
  const playerView = view === "player" || view === "lobby";
  if (view === "manager" && !managerView) {
    const error = new Error("Only the assigned match manager can open this control room.");
    error.status = 403;
    throw error;
  }
  if (playerView && !participant && game.status !== "LOBBY") {
    const error = new Error("Join this match before opening the player view.");
    error.status = 403;
    throw error;
  }

  const revealed = new Set(Array.isArray(state.revealedAnswerIds) ? state.revealedAnswerIds.map(Number) : []);
  const questionVisible = managerView || !["LOBBY", "ROUND_INTRO", "AWAITING_EXTERNAL_FACE_OFF"].includes(game.status);
  const fastMoney = game.status === "FAST_MONEY" ? state.fastMoney : null;
  const fastQuestion = fastMoney?.questions?.[fastMoney.questionIndex] || null;
  const sourceAnswers = fastQuestion?.answers || round?.question?.answers || [];
  const board = sourceAnswers.map((answer) => {
    const answerIsRevealed = !fastQuestion && revealed.has(answer.id);
    return {
      rank: answer.rank,
      revealed: answerIsRevealed,
      ...(managerView || answerIsRevealed ? { answer: answer.answer, points: answer.points } : {}),
      ...(managerView ? { id: answer.id, aliases: answer.aliases } : {}),
    };
  }) || [];
  const sideForParticipant = participant?.teamId ? game.teams.find((team) => team.id === participant.teamId)?.side || null : null;
  const currentParticipant = state.activeMemberId ? participantForMember(game, state.activeMemberId) : null;
  const faceOff = round?.faceOff;
  const alphaRep = faceOff ? participantForMember(game, faceOff.teamARepresentativeId) : null;
  const betaRep = faceOff ? participantForMember(game, faceOff.teamBRepresentativeId) : null;
  const externalWinner = faceOff?.externalWinnerMemberId ? participantForMember(game, faceOff.externalWinnerMemberId) : null;

  const teams = game.teams.map((team) => {
    const captain = game.participants.find((entry) => entry.memberId === team.captainMemberId);
    const players = game.participants.filter((entry) => entry.teamId === team.id && entry.role === "PLAYER");
    return {
      side: team.side,
      name: team.name,
      color: team.color,
      score: team.score,
      captainName: captain ? displayName(captain.member) : null,
      players: players.map(publicParticipant),
      ...(managerView ? {
        id: team.id,
        captainMemberId: team.captainMemberId,
        managerPlayers: players.map((entry) => ({ memberId: entry.memberId, ...publicParticipant(entry) })),
      } : {}),
    };
  });

  const pending = round?.responses.find((response) => response.id === Number(state.pendingResponseId));
  const suggestions = round?.responses.filter((response) => response.responseType === "STEAL_SUGGESTION" && !response.resolvedAt) || [];
  const base = {
    serverNow: new Date().toISOString(),
    game: {
      code: game.code || game.roomId,
      title: game.title,
      phase: game.status,
      pausedPhase: game.status === "PAUSED" ? state.previousPhase : null,
      currentRound: state.currentRound || 0,
      version: game.version,
      timerEndsAt: game.timerEndsAt?.toISOString() || null,
      manager: { name: displayName(game.manager), avatarUrl: memberImage(game.manager) },
      config: state.config || defaultState().config,
      teamsLocked: Boolean(state.teamsLocked),
      canJoin: game.status === "LOBBY" && !state.teamsLocked,
    },
    teams,
    round: round ? {
      number: round.roundNumber,
      multiplier: round.multiplier,
      question: questionVisible ? (fastQuestion?.question || round.question.question) : null,
      category: questionVisible ? (fastQuestion ? "FAST MONEY" : round.question.category) : null,
      bank: round.roundBank,
      strikes: round.strikes,
      activeSide: state.activeSide || null,
      currentPlayer: currentParticipant ? publicParticipant(currentParticipant) : null,
      answerPending: Boolean(state.pendingResponseId),
      board,
      faceOff: faceOff ? {
        alpha: alphaRep ? { name: displayName(alphaRep.member), avatarUrl: memberImage(alphaRep.member) } : null,
        beta: betaRep ? { name: displayName(betaRep.member), avatarUrl: memberImage(betaRep.member) } : null,
        externalWinner: externalWinner ? { name: displayName(externalWinner.member), side: teamBySide(game, externalWinner.teamId === teamBySide(game, "ALPHA")?.id ? "ALPHA" : "BETA")?.side } : null,
        pendingWinnerName: managerView && state.pendingExternalWinnerMemberId ? displayName(participantForMember(game, state.pendingExternalWinnerMemberId)?.member) : null,
        familyWinnerSide: state.playPassWinnerSide || null,
      } : null,
      roundWinnerSide: state.roundWinnerSide || null,
    } : null,
    me: participant ? {
      role: participant.role,
      side: sideForParticipant,
      ready: participant.ready,
      isCaptain: Boolean(participant.teamId && teamBySide(game, sideForParticipant)?.captainMemberId === participant.memberId),
      isCurrentPlayer: Number(state.activeMemberId) === participant.memberId,
    } : null,
  };

  if (fastMoney) {
    base.fastMoney = {
      questionIndex: fastMoney.questionIndex,
      questionCount: fastMoney.questions.length,
      activePlayerIndex: fastMoney.activePlayerIndex,
      total: fastMoney.total,
      target: state.config.fastMoneyTarget,
      complete: Boolean(fastMoney.complete),
      ...(managerView || fastMoney.complete ? { responses: fastMoney.responses } : {}),
    };
  }

  if (managerView) {
    base.manager = {
      captainInvites: {
        alpha: game.alphaInviteToken,
        beta: game.betaInviteToken,
      },
      participants: game.participants.map((entry) => ({
        memberId: entry.memberId,
        name: displayName(entry.member),
        avatarUrl: memberImage(entry.member),
        role: entry.role,
        teamSide: entry.teamId ? game.teams.find((team) => team.id === entry.teamId)?.side || null : null,
        ready: entry.ready,
        connected: Date.now() - entry.lastSeenAt.getTime() < 45000,
      })),
      pendingResponse: pending ? {
        id: pending.id,
        text: pending.text,
        playerName: displayName(pending.member),
        suggestedAnswerIds: round.question.answers.filter((answer) => {
          const guess = normalizeAnswer(pending.text);
          return [answer.answer, ...answer.aliases].some((value) => {
            const candidate = normalizeAnswer(value);
            return candidate === guess || candidate.includes(guess) || guess.includes(candidate) || answerSimilarity(candidate, guess) >= 0.72;
          });
        }).map((answer) => answer.id),
      } : null,
      rawState: {
        pendingExternalWinnerMemberId: state.pendingExternalWinnerMemberId || null,
        activeMemberId: state.activeMemberId || null,
        playPassWinnerSide: state.playPassWinnerSide || null,
        revealedAnswerIds: [...revealed],
      },
    };
  } else if (playerView && sideForParticipant) {
    base.teamPrivate = {
      suggestions: game.status === "STEAL" && state.activeSide === sideForParticipant
        ? suggestions.map((response) => ({ text: response.text, playerName: displayName(response.member) }))
        : [],
    };
  }

  return base;
}

async function uniqueGameCode(client) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = `FF-${crypto.randomInt(1000, 10000)}`;
    if (!await client.familyFeudGame.findFirst({ where: { OR: [{ code }, { roomId: code }] }, select: { id: true } })) return code;
  }
  throw new Error("A unique game code could not be generated. Please try again.");
}

async function createGame(req, res) {
  try {
    await ensureStarterQuestions(Number(req.user.id));
    const code = await uniqueGameCode(prisma);
    const state = defaultState(req.body?.config || {});
    const title = cleanText(req.body?.title, 80) || "Family Feud";
    const game = await prisma.familyFeudGame.create({
      data: {
        code,
        roomId: code,
        alphaInviteToken: randomToken(),
        betaInviteToken: randomToken(),
        title,
        status: "LOBBY",
        phase: "LOBBY",
        state,
        managerMemberId: Number(req.user.id),
        participants: { create: { memberId: Number(req.user.id), role: "MANAGER", ready: true } },
        teams: {
          create: [
            { side: "ALPHA", name: cleanText(req.body?.teamAlphaName, 48) || "Team Nova", color: "#28C7FA" },
            { side: "BETA", name: cleanText(req.body?.teamBetaName, 48) || "Team Pulse", color: "#FF4D8D" },
          ],
        },
      },
      include: gameInclude,
    });
    return res.status(201).json(buildProjection(game, "manager", req.user));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Failed to create Family Feud game." });
  }
}

async function getGame(req, res) {
  try {
    const game = await findGame(prisma, req.params.gameCode);
    if (!game) return res.status(404).json({ message: "Family Feud game not found." });
    return res.json(buildProjection(game, String(req.query.view || "spectator"), req.user));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error?.message || "Failed to load Family Feud game." });
  }
}

async function getGameByCode(req, res) {
  return getGame(req, res);
}

async function joinGame(req, res) {
  try {
    const inviteToken = cleanText(req.body?.inviteToken, 80).toUpperCase();
    const role = inviteToken ? "PLAYER" : (String(req.body?.role || "PLAYER").toUpperCase() === "SPECTATOR" ? "SPECTATOR" : "PLAYER");
    const updated = await prisma.$transaction(async (tx) => {
      const game = await findGame(tx, req.params.gameCode);
      if (!game) throw Object.assign(new Error("Family Feud game not found."), { status: 404 });
      if (game.status !== "LOBBY" || game.state?.teamsLocked) throw Object.assign(new Error("Teams are locked for this match."), { status: 409 });
      if (Number(game.managerMemberId) === Number(req.user.id)) throw Object.assign(new Error("The manager controls the game and cannot occupy a captain seat."), { status: 409 });
      let side = String(req.body?.side || "ALPHA").toUpperCase() === "BETA" ? "BETA" : "ALPHA";
      if (inviteToken) {
        if (inviteToken === String(game.alphaInviteToken).toUpperCase()) side = "ALPHA";
        else if (inviteToken === String(game.betaInviteToken).toUpperCase()) side = "BETA";
        else throw Object.assign(new Error("This captain invitation is invalid."), { status: 403 });
      }
      const team = role === "PLAYER" ? teamBySide(game, side) : null;
      const existing = participantForMember(game, req.user.id);
      const otherTeam = game.teams.find((item) => item.side !== side);
      if (inviteToken && Number(otherTeam?.captainMemberId) === Number(req.user.id)) {
        throw Object.assign(new Error("You are already the captain of the other team."), { status: 409 });
      }
      if (inviteToken && team.captainMemberId && Number(team.captainMemberId) !== Number(req.user.id)) {
        throw Object.assign(new Error(`${team.name} already has a captain.`), { status: 409 });
      }
      if (role === "PLAYER" && existing?.teamId !== team.id && participantsFor(game, side).length >= Number(game.state?.config?.maxPlayersPerTeam || 5)) {
        throw Object.assign(new Error(`${team.name} is full.`), { status: 409 });
      }
      await tx.feudParticipant.upsert({
        where: { gameId_memberId: { gameId: game.id, memberId: Number(req.user.id) } },
        create: { gameId: game.id, teamId: team?.id || null, memberId: Number(req.user.id), role, ready: Boolean(inviteToken) },
        update: { teamId: team?.id || null, role, ready: Boolean(inviteToken), lastSeenAt: new Date() },
      });
      if (inviteToken) await tx.feudTeam.update({ where: { id: team.id }, data: { captainMemberId: Number(req.user.id) } });
      return tx.familyFeudGame.update({ where: { id: game.id }, data: { version: { increment: 1 } }, include: gameInclude });
    }, { isolationLevel: "Serializable" });
    realtime.publish(updated.code || updated.roomId, updated.version);
    return res.json(buildProjection(updated, "lobby", req.user));
  } catch (error) {
    return res.status(error.status || (error.code === "P2034" ? 409 : 400)).json({ message: error.code === "P2034" ? "The lobby changed while you were joining. Please try once more." : error?.message || "Failed to join Family Feud." });
  }
}

async function heartbeat(req, res) {
  const game = await findGame(prisma, req.params.gameCode);
  if (!game) return res.status(404).json({ message: "Family Feud game not found." });
  await prisma.feudParticipant.updateMany({ where: { gameId: game.id, memberId: Number(req.user.id) }, data: { lastSeenAt: new Date() } });
  return res.status(204).send();
}

async function chooseQuestion(tx, game) {
  const state = game.state;
  const where = { active: true };
  if (state.config?.category) where.category = state.config.category;
  if (state.config?.pack) where.pack = state.config.pack;
  const available = await tx.feudQuestion.findMany({ where, include: { answers: true }, orderBy: { id: "asc" } });
  const unused = available.filter((question) => !state.usedQuestionIds.includes(question.id) && question.answers.length > 0);
  if (!unused.length) throw new Error("There are no unused active questions in the selected question pack.");
  return unused[crypto.randomInt(0, unused.length)];
}

async function startRound(tx, game, state) {
  const question = await chooseQuestion(tx, { ...game, state });
  const roundNumber = Number(state.currentRound || 0) + 1;
  const multiplier = roundNumber >= 4 ? 3 : roundNumber >= 3 ? 2 : 1;
  const round = await tx.feudRound.create({
    data: { gameId: game.id, questionId: question.id, roundNumber, multiplier, status: "ROUND_INTRO" },
  });
  return {
    round,
    state: {
      ...state,
      phase: "ROUND_INTRO",
      currentRound: roundNumber,
      usedQuestionIds: [...state.usedQuestionIds, question.id],
      revealedAnswerIds: [],
      pendingExternalWinnerMemberId: null,
      pendingResponseId: null,
      activeMemberId: null,
      activeSide: null,
      playPassWinnerSide: null,
      roundWinnerSide: null,
      turnIndex: -1,
      faceOffResults: [],
    },
  };
}

function ensureManager(game, req) {
  if (!isGameManager(game, req.user)) {
    const error = new Error("Only the assigned match manager can perform this action.");
    error.status = 403;
    throw error;
  }
}

function ensurePhase(game, ...phases) {
  if (!phases.includes(game.status)) {
    const error = new Error(`This action is not available during ${game.status.replaceAll("_", " ")}.`);
    error.status = 409;
    throw error;
  }
}

async function advanceFaceOff(tx, game, state, round, resolvedResponse, matchedAnswer) {
  const faceOff = round.faceOff;
  const firstMemberId = faceOff.externalWinnerMemberId;
  const secondMemberId = firstMemberId === faceOff.teamARepresentativeId ? faceOff.teamBRepresentativeId : faceOff.teamARepresentativeId;
  const results = [...(state.faceOffResults || []), { memberId: resolvedResponse.memberId, rank: matchedAnswer?.rank || null }];
  if (game.status === "FACE_OFF_FIRST_ANSWER") {
    return {
      state: { ...state, phase: "FACE_OFF_SECOND_ANSWER", pendingResponseId: null, activeMemberId: secondMemberId, faceOffResults: results },
      status: "FACE_OFF_SECOND_ANSWER",
      timerEndsAt: new Date(Date.now() + Number(state.config.answerSeconds) * 1000),
    };
  }
  const first = results.find((result) => result.memberId === firstMemberId);
  const second = results.find((result) => result.memberId === secondMemberId);
  let winnerMemberId = firstMemberId;
  if (first?.rank == null && second?.rank != null) winnerMemberId = secondMemberId;
  else if (first?.rank != null && second?.rank != null && second.rank < first.rank) winnerMemberId = secondMemberId;
  const winnerParticipant = participantForMember(game, winnerMemberId);
  const winnerSide = game.teams.find((team) => team.id === winnerParticipant.teamId).side;
  await tx.feudFaceOff.update({ where: { roundId: round.id }, data: { familyWinnerTeamId: winnerParticipant.teamId, resolvedAt: new Date() } });
  return {
    state: { ...state, phase: "PLAY_PASS", pendingResponseId: null, activeMemberId: winnerMemberId, playPassWinnerSide: winnerSide, faceOffResults: results },
    status: "PLAY_PASS",
    timerEndsAt: null,
  };
}

async function resolveRoundResponse(tx, game, state, round, correct, answerId) {
  const pending = round.responses.find((response) => response.id === Number(state.pendingResponseId));
  if (!pending || pending.resolvedAt) throw new Error("There is no unanswered submission to resolve.");
  const answerPool = game.status === "FAST_MONEY"
    ? state.fastMoney.questions[state.fastMoney.questionIndex].answers
    : round.question.answers;
  const answer = answerId ? answerPool.find((item) => item.id === Number(answerId)) : null;
  if (correct && !answer) throw new Error("Select a valid survey answer.");
  const resolved = await tx.feudResponse.update({
    where: { id: pending.id },
    data: { matchedAnswerId: answer?.id || null, correct, points: correct ? answer.points * (game.status === "FAST_MONEY" ? 1 : round.multiplier) : 0, resolvedAt: new Date() },
  });
  if (game.status === "FACE_OFF_FIRST_ANSWER" || game.status === "FACE_OFF_SECOND_ANSWER") {
    const reveal = correct && answer ? [...new Set([...(state.revealedAnswerIds || []), answer.id])] : state.revealedAnswerIds;
    const advanced = await advanceFaceOff(tx, game, { ...state, revealedAnswerIds: reveal }, round, resolved, correct ? answer : null);
    if (correct && answer) await tx.feudRound.update({ where: { id: round.id }, data: { roundBank: { increment: answer.points * round.multiplier } } });
    return advanced;
  }
  if (game.status === "ROUND_PLAY") {
    if (correct && answer) {
      const alreadyRevealed = (state.revealedAnswerIds || []).includes(answer.id);
      if (alreadyRevealed) throw new Error("That survey answer is already on the board.");
      await tx.feudRound.update({ where: { id: round.id }, data: { roundBank: { increment: answer.points * round.multiplier } } });
      return {
        state: {
          ...state,
          pendingResponseId: null,
          revealedAnswerIds: [...state.revealedAnswerIds, answer.id],
          turnIndex: state.turnIndex + 1,
          activeMemberId: nextPlayerMemberId(game, state.activeSide, state.turnIndex),
        },
        status: "ROUND_PLAY",
        timerEndsAt: new Date(Date.now() + Number(state.config.answerSeconds) * 1000),
      };
    }
    const nextStrikes = round.strikes + 1;
    await tx.feudRound.update({ where: { id: round.id }, data: { strikes: nextStrikes } });
    if (nextStrikes >= 3) {
      const stealSide = otherSide(state.activeSide);
      const stealTeam = teamBySide(game, stealSide);
      return {
        state: { ...state, phase: "STEAL", pendingResponseId: null, activeSide: stealSide, activeMemberId: stealTeam.captainMemberId || nextPlayerMemberId(game, stealSide), turnIndex: -1 },
        status: "STEAL",
        timerEndsAt: new Date(Date.now() + Number(state.config.answerSeconds) * 1000),
      };
    }
    return {
      state: { ...state, pendingResponseId: null, turnIndex: state.turnIndex + 1, activeMemberId: nextPlayerMemberId(game, state.activeSide, state.turnIndex) },
      status: "ROUND_PLAY",
      timerEndsAt: new Date(Date.now() + Number(state.config.answerSeconds) * 1000),
    };
  }
  if (game.status === "STEAL") {
    const winnerSide = correct ? state.activeSide : otherSide(state.activeSide);
    const winnerTeam = teamBySide(game, winnerSide);
    const refreshedRound = await tx.feudRound.findUnique({ where: { id: round.id } });
    if (correct && answer && !(state.revealedAnswerIds || []).includes(answer.id)) {
      await tx.feudRound.update({ where: { id: round.id }, data: { roundBank: { increment: answer.points * round.multiplier } } });
      state.revealedAnswerIds = [...state.revealedAnswerIds, answer.id];
    }
    const award = refreshedRound.roundBank + (correct && answer ? answer.points * round.multiplier : 0);
    await tx.feudTeam.update({ where: { id: winnerTeam.id }, data: { score: { increment: award } } });
    await tx.feudRound.update({ where: { id: round.id }, data: { status: "ROUND_RESULTS", finishedAt: new Date() } });
    return { state: { ...state, phase: "ROUND_RESULTS", pendingResponseId: null, roundWinnerSide: winnerSide, activeMemberId: null }, status: "ROUND_RESULTS", timerEndsAt: null };
  }
  if (game.status === "FAST_MONEY") {
    const fast = { ...state.fastMoney, responses: [...(state.fastMoney?.responses || [])] };
    const question = fast.questions[fast.questionIndex];
    const selected = question.answers.find((item) => item.id === Number(answerId));
    if (correct && !selected) throw new Error("Select a valid Fast Money survey answer.");
    const duplicate = correct && fast.activePlayerIndex === 1 && fast.responses.some((entry) => entry.playerIndex === 0 && entry.questionIndex === fast.questionIndex && entry.answerId === selected.id);
    if (duplicate) throw Object.assign(new Error("DUPLICATE ANSWER — ask the player for another response."), { status: 409 });
    fast.responses.push({ playerIndex: fast.activePlayerIndex, questionIndex: fast.questionIndex, text: pending.text, answerId: selected?.id || null, answer: selected?.answer || null, points: correct ? selected.points : 0 });
    fast.total += correct ? selected.points : 0;
    if (!correct) {
      return { state: { ...state, pendingResponseId: null, fastMoney: fast }, status: "FAST_MONEY", timerEndsAt: new Date(Date.now() + 10000) };
    }
    if (fast.questionIndex < fast.questions.length - 1) {
      fast.questionIndex += 1;
      return { state: { ...state, pendingResponseId: null, fastMoney: fast }, status: "FAST_MONEY", timerEndsAt: new Date(Date.now() + (fast.activePlayerIndex === 0 ? 20000 : 25000)) };
    }
    if (fast.activePlayerIndex === 0) {
      fast.activePlayerIndex = 1;
      fast.questionIndex = 0;
      return { state: { ...state, pendingResponseId: null, activeMemberId: fast.playerIds[1], fastMoney: fast }, status: "FAST_MONEY", timerEndsAt: new Date(Date.now() + 25000) };
    }
    fast.complete = true;
    return { state: { ...state, pendingResponseId: null, activeMemberId: null, fastMoney: fast }, status: "FAST_MONEY", timerEndsAt: null };
  }
  throw new Error("The pending answer cannot be resolved in this phase.");
}

async function performAction(tx, game, req, action, payload) {
  let state = game.state && typeof game.state === "object" ? { ...game.state } : defaultState();
  let status = game.status;
  let timerEndsAt = game.timerEndsAt;
  let startedAt = game.startedAt;
  let finishedAt = game.finishedAt;
  let winningTeamId = game.winningTeamId;
  const participant = participantForMember(game, req.user.id);
  const round = activeRound(game);

  if (MANAGER_ACTIONS.has(action)) ensureManager(game, req);
  if (game.status === "PAUSED" && action !== "RESUME") throw Object.assign(new Error("Resume the match before performing another action."), { status: 409 });

  if (action === "SET_READY") {
    ensurePhase(game, "LOBBY");
    if (!participant || participant.role !== "PLAYER") throw new Error("Join a team before marking yourself ready.");
    await tx.feudParticipant.update({ where: { id: participant.id }, data: { ready: Boolean(payload.ready), lastSeenAt: new Date() } });
  } else if (action === "LOCK_TEAMS") {
    ensurePhase(game, "LOBBY");
    state.teamsLocked = Boolean(payload.locked);
  } else if (action === "MOVE_PLAYER") {
    ensurePhase(game, "LOBBY");
    const target = participantForMember(game, payload.memberId);
    const team = teamBySide(game, String(payload.side).toUpperCase());
    if (!target || !team || target.role !== "PLAYER") throw new Error("Select an active player and team.");
    if (target.teamId !== team.id && participantsFor(game, team.side).length >= Number(state.config.maxPlayersPerTeam || 5)) throw new Error(`${team.name} is full.`);
    await tx.feudParticipant.update({ where: { id: target.id }, data: { teamId: team.id, ready: false } });
  } else if (action === "REMOVE_PLAYER") {
    ensurePhase(game, "LOBBY");
    const target = participantForMember(game, payload.memberId);
    if (!target || target.role === "MANAGER") throw new Error("Select a removable participant.");
    await tx.feudParticipant.delete({ where: { id: target.id } });
  } else if (action === "SET_CAPTAIN") {
    ensurePhase(game, "LOBBY");
    const target = participantForMember(game, payload.memberId);
    const team = target && game.teams.find((item) => item.id === target.teamId);
    if (!target || !team) throw new Error("The captain must be an active team player.");
    await tx.feudTeam.update({ where: { id: team.id }, data: { captainMemberId: target.memberId } });
  } else if (action === "START_GAME") {
    ensurePhase(game, "LOBBY");
    if (["ALPHA", "BETA"].some((side) => participantsFor(game, side).length === 0)) throw new Error("Both teams need at least one player.");
    const unready = game.participants.filter((entry) => entry.role === "PLAYER" && !entry.ready);
    if (unready.length) throw new Error("Every player must be ready before the match starts.");
    for (const side of ["ALPHA", "BETA"]) {
      const team = teamBySide(game, side);
      if (!team.captainMemberId) await tx.feudTeam.update({ where: { id: team.id }, data: { captainMemberId: orderedPlayers(game, side)[0].memberId } });
    }
    state.teamsLocked = true;
    const started = await startRound(tx, game, state);
    state = started.state;
    status = "ROUND_INTRO";
    startedAt = new Date();
  } else if (action === "SET_FACE_OFF_REPRESENTATIVES") {
    ensurePhase(game, "ROUND_INTRO");
    const alpha = participantForMember(game, payload.alphaMemberId);
    const beta = participantForMember(game, payload.betaMemberId);
    if (!alpha || alpha.teamId !== teamBySide(game, "ALPHA").id || !beta || beta.teamId !== teamBySide(game, "BETA").id) throw new Error("Choose one active representative from each team.");
    await tx.feudFaceOff.upsert({
      where: { roundId: round.id },
      create: { roundId: round.id, teamARepresentativeId: alpha.memberId, teamBRepresentativeId: beta.memberId },
      update: { teamARepresentativeId: alpha.memberId, teamBRepresentativeId: beta.memberId, externalWinnerMemberId: null, familyWinnerTeamId: null, resolvedAt: null },
    });
  } else if (action === "START_FACE_OFF") {
    ensurePhase(game, "ROUND_INTRO");
    const requestedSide = String(payload.side || "").toUpperCase();
    if (!["ALPHA", "BETA"].includes(requestedSide)) throw new Error("Choose which captain answers first.");
    const alphaTeam = teamBySide(game, "ALPHA");
    const betaTeam = teamBySide(game, "BETA");
    if (!alphaTeam.captainMemberId || !betaTeam.captainMemberId) throw new Error("Both captains must join before the face-off starts.");
    const firstMemberId = requestedSide === "ALPHA" ? alphaTeam.captainMemberId : betaTeam.captainMemberId;
    await tx.feudFaceOff.upsert({
      where: { roundId: round.id },
      create: { roundId: round.id, teamARepresentativeId: alphaTeam.captainMemberId, teamBRepresentativeId: betaTeam.captainMemberId, externalWinnerMemberId: firstMemberId },
      update: { teamARepresentativeId: alphaTeam.captainMemberId, teamBRepresentativeId: betaTeam.captainMemberId, externalWinnerMemberId: firstMemberId, familyWinnerTeamId: null, resolvedAt: null },
    });
    state = { ...state, phase: "FACE_OFF_FIRST_ANSWER", activeMemberId: firstMemberId, pendingExternalWinnerMemberId: null, faceOffResults: [] };
    status = "FACE_OFF_FIRST_ANSWER";
    timerEndsAt = new Date(Date.now() + Number(state.config.answerSeconds) * 1000);
  } else if (action === "START_EXTERNAL_FACE_OFF") {
    ensurePhase(game, "ROUND_INTRO");
    if (!round.faceOff) throw new Error("Select both face-off representatives first.");
    status = "AWAITING_EXTERNAL_FACE_OFF";
    state.phase = status;
    await tx.feudRound.update({ where: { id: round.id }, data: { status } });
  } else if (action === "RECORD_EXTERNAL_WINNER") {
    ensurePhase(game, "AWAITING_EXTERNAL_FACE_OFF");
    if (![round.faceOff.teamARepresentativeId, round.faceOff.teamBRepresentativeId].includes(Number(payload.memberId))) throw new Error("The external winner must be one of the selected representatives.");
    state.pendingExternalWinnerMemberId = Number(payload.memberId);
  } else if (action === "CONFIRM_EXTERNAL_WINNER") {
    ensurePhase(game, "AWAITING_EXTERNAL_FACE_OFF");
    const winnerId = Number(state.pendingExternalWinnerMemberId);
    if (!winnerId) throw new Error("Choose which captain answers first.");
    await tx.feudFaceOff.update({ where: { roundId: round.id }, data: { externalWinnerMemberId: winnerId } });
    status = "FACE_OFF_FIRST_ANSWER";
    state = { ...state, phase: status, pendingExternalWinnerMemberId: null, activeMemberId: winnerId, pendingResponseId: null };
    timerEndsAt = new Date(Date.now() + Number(state.config.answerSeconds) * 1000);
    await tx.feudRound.update({ where: { id: round.id }, data: { status: "FACE_OFF" } });
  } else if (action === "SUBMIT_ANSWER") {
    if (!ACTIVE_ANSWER_PHASES.has(game.status)) throw Object.assign(new Error("Answers are closed right now."), { status: 409 });
    if (!participant || participant.role !== "PLAYER") throw Object.assign(new Error("Only an active player can answer."), { status: 403 });
    if (Number(state.activeMemberId) !== participant.memberId) throw Object.assign(new Error("It is not your turn."), { status: 409 });
    if (state.pendingResponseId) throw Object.assign(new Error("Your previous answer is awaiting the manager."), { status: 409 });
    if (timerEndsAt && timerEndsAt.getTime() < Date.now()) throw Object.assign(new Error("The answer timer has expired."), { status: 409 });
    const text = cleanText(payload.text, 120);
    if (!text) throw new Error("Enter an answer before submitting.");
    const type = game.status.startsWith("FACE_OFF") ? "FACE_OFF" : game.status === "STEAL" ? "STEAL_FINAL" : game.status === "FAST_MONEY" ? "FAST_MONEY" : "ROUND";
    const response = await tx.feudResponse.create({ data: { roundId: round.id, participantId: participant.id, memberId: participant.memberId, text, responseType: type } });
    state.pendingResponseId = response.id;
    timerEndsAt = null;
  } else if (action === "SUBMIT_STEAL_SUGGESTION") {
    ensurePhase(game, "STEAL");
    const side = participant?.teamId ? game.teams.find((team) => team.id === participant.teamId)?.side : null;
    if (!participant || side !== state.activeSide) throw Object.assign(new Error("Only the stealing team can discuss answers."), { status: 403 });
    const text = cleanText(payload.text, 120);
    if (!text) throw new Error("Enter a suggestion.");
    await tx.feudResponse.create({ data: { roundId: round.id, participantId: participant.id, memberId: participant.memberId, text, responseType: "STEAL_SUGGESTION" } });
  } else if (action === "ACCEPT_RESPONSE" || action === "REJECT_RESPONSE") {
    if (!round) throw new Error("There is no active round.");
    const result = await resolveRoundResponse(tx, game, state, round, action === "ACCEPT_RESPONSE", payload.answerId);
    state = result.state;
    status = result.status;
    timerEndsAt = result.timerEndsAt;
  } else if (action === "SELECT_PLAY_PASS") {
    ensurePhase(game, "PLAY_PASS");
    const side = participant?.teamId ? game.teams.find((team) => team.id === participant.teamId)?.side : null;
    if (!isGameManager(game, req.user) && side !== state.playPassWinnerSide) throw Object.assign(new Error("Only the face-off winning team can choose play or pass."), { status: 403 });
    const choice = String(payload.choice).toUpperCase();
    if (!["PLAY", "PASS"].includes(choice)) throw new Error("Choose PLAY or PASS.");
    const activeSide = choice === "PLAY" ? state.playPassWinnerSide : otherSide(state.playPassWinnerSide);
    status = "ROUND_PLAY";
    state = { ...state, phase: status, activeSide, turnIndex: 0, activeMemberId: nextPlayerMemberId(game, activeSide), pendingResponseId: null };
    timerEndsAt = new Date(Date.now() + Number(state.config.answerSeconds) * 1000);
    await tx.feudRound.update({ where: { id: round.id }, data: { status, activeTeamId: teamBySide(game, activeSide).id } });
  } else if (action === "REVEAL_ANSWER") {
    if (!round.question.answers.some((answer) => answer.id === Number(payload.answerId))) throw new Error("Select a valid survey answer.");
    state.revealedAnswerIds = [...new Set([...(state.revealedAnswerIds || []), Number(payload.answerId)])];
  } else if (action === "ADD_STRIKE" || action === "REMOVE_STRIKE") {
    ensurePhase(game, "ROUND_PLAY", "STEAL");
    const strikes = Math.max(0, Math.min(3, round.strikes + (action === "ADD_STRIKE" ? 1 : -1)));
    await tx.feudRound.update({ where: { id: round.id }, data: { strikes } });
    if (strikes >= 3 && game.status === "ROUND_PLAY") {
      status = "STEAL";
      const activeSide = otherSide(state.activeSide);
      const team = teamBySide(game, activeSide);
      state = { ...state, phase: status, activeSide, activeMemberId: team.captainMemberId || nextPlayerMemberId(game, activeSide), pendingResponseId: null };
      timerEndsAt = new Date(Date.now() + Number(state.config.answerSeconds) * 1000);
    }
  } else if (action === "ADJUST_BANK") {
    if (!round) throw new Error("There is no active round.");
    await tx.feudRound.update({ where: { id: round.id }, data: { roundBank: Math.max(0, Number(payload.value) || 0) } });
  } else if (action === "ADJUST_SCORE") {
    const team = teamBySide(game, String(payload.side).toUpperCase());
    if (!team) throw new Error("Select a valid team.");
    await tx.feudTeam.update({ where: { id: team.id }, data: { score: Math.max(0, Number(payload.value) || 0) } });
  } else if (action === "START_STEAL") {
    ensurePhase(game, "ROUND_PLAY");
    status = "STEAL";
    const activeSide = otherSide(state.activeSide);
    const team = teamBySide(game, activeSide);
    state = { ...state, phase: status, activeSide, activeMemberId: team.captainMemberId || nextPlayerMemberId(game, activeSide), pendingResponseId: null };
    timerEndsAt = new Date(Date.now() + Number(state.config.answerSeconds) * 1000);
  } else if (action === "RESOLVE_STEAL") {
    ensurePhase(game, "STEAL");
    if (!state.pendingResponseId) throw new Error("The captain must submit a final steal answer first.");
    const result = await resolveRoundResponse(tx, game, state, round, Boolean(payload.correct), payload.answerId);
    state = result.state;
    status = result.status;
    timerEndsAt = result.timerEndsAt;
  } else if (action === "END_ROUND") {
    if (!["ROUND_PLAY", "STEAL", "ROUND_RESULTS"].includes(game.status)) throw new Error("The current round cannot be ended yet.");
    const winnerSide = String(payload.winnerSide || state.roundWinnerSide || state.activeSide).toUpperCase();
    const team = teamBySide(game, winnerSide);
    if (!team) throw new Error("Select the round winner.");
    if (game.status !== "ROUND_RESULTS") await tx.feudTeam.update({ where: { id: team.id }, data: { score: { increment: round.roundBank } } });
    await tx.feudRound.update({ where: { id: round.id }, data: { status: "ROUND_RESULTS", finishedAt: new Date() } });
    status = "ROUND_RESULTS";
    timerEndsAt = null;
    state = { ...state, phase: status, roundWinnerSide: winnerSide, activeMemberId: null, pendingResponseId: null };
  } else if (action === "NEXT_ROUND") {
    ensurePhase(game, "ROUND_RESULTS");
    if (state.currentRound >= Number(state.config.roundCount)) throw new Error("All rounds are complete. Finish the game.");
    const started = await startRound(tx, game, state);
    state = started.state;
    status = "ROUND_INTRO";
    timerEndsAt = null;
  } else if (action === "START_FAST_MONEY") {
    ensurePhase(game, "ROUND_RESULTS");
    const scores = [...game.teams].sort((a, b) => b.score - a.score);
    const winner = scores[0];
    const selected = Array.isArray(payload.memberIds) ? payload.memberIds.map(Number).slice(0, 2) : [];
    const valid = selected.length === 2 && selected.every((id) => participantForMember(game, id)?.teamId === winner.id) && selected[0] !== selected[1];
    if (!valid) throw new Error("Select two different players from the leading team.");
    const questionRecords = await tx.feudQuestion.findMany({ where: { active: true }, include: { answers: { orderBy: { rank: "asc" } } }, orderBy: { id: "asc" }, take: 5 });
    if (questionRecords.length < 5) throw new Error("Fast Money needs at least five active questions.");
    status = "FAST_MONEY";
    state = { ...state, phase: status, activeSide: winner.side, activeMemberId: selected[0], pendingResponseId: null, fastMoney: { playerIds: selected, activePlayerIndex: 0, questionIndex: 0, total: 0, responses: [], complete: false, questions: questionRecords.map((question) => ({ id: question.id, question: question.question, answers: question.answers })) } };
    timerEndsAt = new Date(Date.now() + 20000);
  } else if (action === "END_GAME") {
    const winner = [...game.teams].sort((a, b) => b.score - a.score)[0];
    status = "FINISHED";
    state = { ...state, phase: status, activeMemberId: null, activeSide: null };
    timerEndsAt = null;
    finishedAt = new Date();
    winningTeamId = winner?.id || null;
  } else if (action === "PAUSE") {
    if (["LOBBY", "FINISHED", "PAUSED"].includes(game.status)) throw new Error("This match cannot be paused right now.");
    state = { ...state, previousPhase: game.status, pausedRemainingMs: timerEndsAt ? Math.max(0, timerEndsAt.getTime() - Date.now()) : null };
    status = "PAUSED";
    timerEndsAt = null;
  } else if (action === "RESUME") {
    ensurePhase(game, "PAUSED");
    status = state.previousPhase || "ROUND_INTRO";
    timerEndsAt = state.pausedRemainingMs == null ? null : new Date(Date.now() + Number(state.pausedRemainingMs));
    state = { ...state, previousPhase: null, pausedRemainingMs: null, phase: status };
  } else {
    throw new Error("Unknown Family Feud action.");
  }

  state.phase = status;
  const updated = await tx.familyFeudGame.updateMany({
    where: { id: game.id, version: game.version },
    data: { state, status, phase: status, round: state.currentRound || null, timerEndsAt, startedAt, finishedAt, winningTeamId, version: { increment: 1 } },
  });
  if (updated.count !== 1) throw Object.assign(new Error("The match changed in another session. Please retry your action."), { status: 409 });
}

async function gameAction(req, res) {
  try {
    const action = String(req.body?.action || "").trim().toUpperCase();
    const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {};
    const game = await prisma.$transaction(async (tx) => {
      const current = await findGame(tx, req.params.gameCode);
      if (!current) throw Object.assign(new Error("Family Feud game not found."), { status: 404 });
      await performAction(tx, current, req, action, payload);
      return findGame(tx, req.params.gameCode);
    });
    realtime.publish(game.code || game.roomId, game.version);
    const view = isGameManager(game, req.user) ? "manager" : "player";
    return res.json(buildProjection(game, view, req.user));
  } catch (error) {
    return res.status(error.status || 400).json({ message: error?.message || "Family Feud action failed." });
  }
}

async function events(req, res) {
  try {
    const game = await findGame(prisma, req.params.gameCode);
    if (!game) return res.status(404).end();
    const view = String(req.query.view || "spectator");
    buildProjection(game, view, req.user);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ version: game.version })}\n\n`);
    const unsubscribe = realtime.subscribe(game.code || game.roomId, res);
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 20000);
    req.on("close", () => { clearInterval(keepAlive); unsubscribe(); });
  } catch {
    return res.status(403).end();
  }
}

async function listQuestions(req, res) {
  const manager = hasManagerAccess(req.user);
  const questions = await prisma.feudQuestion.findMany({
    where: manager ? {} : { active: true },
    include: { answers: { orderBy: { rank: "asc" } } },
    orderBy: [{ pack: "asc" }, { category: "asc" }, { id: "desc" }],
  });
  return res.json(questions);
}

function questionData(body, memberId) {
  const question = cleanText(body?.question, 240);
  const category = cleanText(body?.category, 48).toUpperCase() || "GENERAL";
  const pack = cleanText(body?.pack, 80) || "Core Set";
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (!question) throw new Error("Question text is required.");
  if (answers.length < 2 || answers.length > 10) throw new Error("Add between 2 and 10 survey answers.");
  const normalizedAnswers = answers.map((answer, index) => ({
    answer: cleanText(answer.answer, 120),
    points: Math.max(0, Math.min(100, Number(answer.points) || 0)),
    rank: index + 1,
    aliases: Array.isArray(answer.aliases) ? answer.aliases.map((alias) => cleanText(alias, 80)).filter(Boolean).slice(0, 20) : [],
  }));
  if (normalizedAnswers.some((answer) => !answer.answer)) throw new Error("Every survey answer needs text.");
  return { question, category, pack, active: body?.active !== false, createdById: memberId, answers: normalizedAnswers };
}

async function createQuestion(req, res) {
  try {
    const data = questionData(req.body, Number(req.user.id));
    const question = await prisma.feudQuestion.create({ data: { ...data, answers: { create: data.answers } }, include: { answers: { orderBy: { rank: "asc" } } } });
    return res.status(201).json(question);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function importQuestions(req, res) {
  try {
    const source = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (source.length < 1 || source.length > 50) throw new Error("Import between 1 and 50 questions at a time.");
    const memberId = Number(req.user.id);
    const fallbackPack = cleanText(req.body?.pack, 80) || "Imported questions";
    const fallbackCategory = cleanText(req.body?.category, 48).toUpperCase() || "GENERAL";
    const rows = source.map((item) => questionData({ ...item, pack: item?.pack || fallbackPack, category: item?.category || fallbackCategory }, memberId));
    const questions = await prisma.$transaction(rows.map((data) => prisma.feudQuestion.create({
      data: { ...data, answers: { create: data.answers } },
      include: { answers: { orderBy: { rank: "asc" } } },
    })));
    return res.status(201).json({ count: questions.length, questions });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function updateQuestion(req, res) {
  try {
    const data = questionData(req.body, Number(req.user.id));
    const question = await prisma.$transaction(async (tx) => {
      await tx.feudAnswer.deleteMany({ where: { questionId: Number(req.params.questionId) } });
      return tx.feudQuestion.update({
        where: { id: Number(req.params.questionId) },
        data: { question: data.question, category: data.category, pack: data.pack, active: data.active, answers: { create: data.answers } },
        include: { answers: { orderBy: { rank: "asc" } } },
      });
    });
    return res.json(question);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function deleteQuestion(req, res) {
  try {
    const question = await prisma.feudQuestion.update({ where: { id: Number(req.params.questionId) }, data: { active: false } });
    return res.json(question);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function deleteGame(req, res) {
  try {
    const game = await findGame(prisma, req.params.gameCode);
    if (!game) return res.status(404).json({ message: "Family Feud game not found." });
    ensureManager(game, req);
    await prisma.familyFeudGame.delete({ where: { id: game.id } });
    realtime.publish(game.code || game.roomId, game.version + 1);
    return res.status(204).send();
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
}

module.exports = {
  createGame,
  getGame,
  getGameByCode,
  joinGame,
  heartbeat,
  gameAction,
  events,
  listQuestions,
  createQuestion,
  importQuestions,
  updateQuestion,
  deleteQuestion,
  deleteGame,
  __testables: { normalizeAnswer, answerSimilarity, defaultState, buildProjection },
};
