const prisma = require("../config/prisma");

/**
 * Bracket (playoff) matches are identified by playoffRound when available.
 * Legacy rows can still be identified by type/title so old Finals matches keep
 * the current BO7 rules even if they were created before playoffRound existed.
 */
const GRAND_FINAL_ROUND = 3;
const normalizeMatchType = (type) => String(type || "").trim().toUpperCase();
const isBracketMatch = (match) =>
  Number.isInteger(match?.playoffRound) ||
  ["PLAYOFFS", "FINALS"].includes(normalizeMatchType(match?.type));
const isGrandFinal = (match) =>
  match?.playoffRound === GRAND_FINAL_ROUND ||
  normalizeMatchType(match?.type) === "FINALS" ||
  /grand\s*final/i.test(match?.title || "");
const getSeriesBestOf = (match) => {
  if (isGrandFinal(match)) return 7;
  return Number.isInteger(match?.bestOf) && match.bestOf > 0 ? match.bestOf : 5;
};
const getRequiredWins = (match) => Math.ceil(getSeriesBestOf(match) / 2);

const findById = (id) =>
  prisma.match.findUnique({
    where: { id },
    include: {
      draft: {
        include: {
          actions: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });
const findAll = (args) => prisma.match.findMany(args);
const create = (data) => prisma.match.create({ data });
const update = (id, data) => prisma.match.update({ where: { id }, data });
const remove = async (id) => {
  const draftTable = await prisma.draftTable.findUnique({ where: { matchId: id } });
  if (draftTable) {
    await prisma.draftAction.deleteMany({ where: { draftId: draftTable.id } });
    await prisma.draftTable.delete({ where: { id: draftTable.id } });
  }
  try {
    await prisma.playerStat.deleteMany({ where: { matchId: id } });
  } catch (e) {
    // Ignore if PlayerStat does not have matchId
  }
  return prisma.match.delete({ where: { id } });
};

/**
 * Round robin generation using the "circle method" (polygon rotation algorithm).
 * This guarantees that NO team plays more than ONCE per round/week.
 *
 * With N teams (N even):  N-1 rounds, each round has N/2 matches.
 * With N teams (N odd):   N rounds, each round has floor(N/2) matches (one team has a bye each round).
 */
const generateRoundRobin = async (tournamentId) => {
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    orderBy: { id: "asc" },
  });

  if (teams.length < 2) {
    throw new Error("At least 2 teams are required for round robin generation.");
  }

  return prisma.$transaction(async (tx) => {
    const existingRoundRobin = await tx.match.findFirst({
      where: {
        tournamentId,
        type: "ROUNDROBIN",
      },
      select: { id: true },
    });

    if (existingRoundRobin) {
      throw new Error(
        "This tournament already has round robin matches. Delete existing round robin matches before generating again."
      );
    }

    const maps = await tx.map.findMany({ select: { id: true } });

    const participants = [...teams];
    if (participants.length % 2 !== 0) {
      participants.push(null); // null = bye
    }

    const totalParticipants = participants.length;
    const totalRounds = totalParticipants - 1;
    const matchesPerRound = totalParticipants / 2;
    const expectedPairings = (teams.length * (teams.length - 1)) / 2;

    let rotation = [...participants];
    const created = [];
    const pairingKeys = new Set();

    for (let round = 0; round < totalRounds; round++) {
      const week = round + 1;
      const teamsScheduledThisWeek = new Set();

      for (let i = 0; i < matchesPerRound; i++) {
        let home = rotation[i];
        let away = rotation[totalParticipants - 1 - i];

        // Skip bye pairings for odd team counts.
        if (home === null || away === null) {
          continue;
        }

        // Small home/away balance tweak for the fixed slot.
        if (i === 0 && round % 2 === 1) {
          [home, away] = [away, home];
        }

        if (teamsScheduledThisWeek.has(home.id) || teamsScheduledThisWeek.has(away.id)) {
          throw new Error(`Round robin generation error: team repeated in week ${week}.`);
        }

        teamsScheduledThisWeek.add(home.id);
        teamsScheduledThisWeek.add(away.id);

        const pairKey = home.id < away.id ? `${home.id}-${away.id}` : `${away.id}-${home.id}`;
        if (pairingKeys.has(pairKey)) {
          throw new Error("Round robin generation error: duplicate team pairing detected.");
        }
        pairingKeys.add(pairKey);

        const createdMatch = await tx.match.create({
          data: {
            type: "ROUNDROBIN",
            title: `Week ${week}`,
            semanas: week,
            bestOf: 5,
            status: "SCHEDULED",
            tournamentId,
            teamAId: home.id,
            teamBId: away.id,
            allowedMaps: {
              connect: maps.map((m) => ({ id: m.id })),
            },
          },
        });
        created.push(createdMatch);
      }

      const fixed = rotation[0];
      const moving = rotation.slice(1);
      moving.unshift(moving.pop());
      rotation = [fixed, ...moving];
    }

    if (pairingKeys.size !== expectedPairings) {
      throw new Error(
        `Round robin generation error: expected ${expectedPairings} unique pairings, generated ${pairingKeys.size}.`
      );
    }

    return created;
  });
};

const submitResult = async (id, winnerTeamId) => {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    const hasWinner = winnerTeamId !== null && winnerTeamId !== undefined;

    if (hasWinner && winnerTeamId !== match.teamAId && winnerTeamId !== match.teamBId) {
      throw new Error("winnerTeamId must be one of the match teams.");
    }

    // gameNumber starts at 0, increments AFTER each game. So current game being played is gameNumber+1.
    // But after createDraft, gameNumber is 0, meaning game 1 is about to start.
    // After submitResult for game 1, gameNumber becomes 1.
    // The "current game being reported" is match.gameNumber + 1 (1-indexed).
    const currentGameBeingReported = match.gameNumber + 1;
    const seriesBestOf = getSeriesBestOf(match);
    const requiredWins = getRequiredWins(match);

    const nextMapWinsA =
      hasWinner && winnerTeamId === match.teamAId
        ? match.mapWinsTeamA + 1
        : match.mapWinsTeamA;
    const nextMapWinsB =
      hasWinner && winnerTeamId === match.teamBId
        ? match.mapWinsTeamB + 1
        : match.mapWinsTeamB;

    // Match is finished when someone reaches required wins OR we've played all bestOf games
    const isFinished =
      nextMapWinsA >= requiredWins ||
      nextMapWinsB >= requiredWins;

    // For the next draft, the loser chooses the map type and then the map.
    // On a draw, the team that did not pick the current map receives that turn.
    const pickForCurrentGame = match.draft?.actions?.find(
      (a) => a.action === "PICK" && a.gameNumber === currentGameBeingReported
    );
    const pickerTeamId = pickForCurrentGame?.teamId;

    let nextTurnTeamId;
    if (hasWinner) {
      nextTurnTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    } else {
      // Draw: team that didn't pick this map picks next
      nextTurnTeamId =
        pickerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    }

    const mapResults = Array.isArray(match.mapResults) ? match.mapResults : [];
    const mapId = match.draft?.currentMapId || null;
    const nextMapResults = [
      ...mapResults,
      {
        gameNumber: currentGameBeingReported,
        mapId,
        winnerTeamId: hasWinner ? winnerTeamId : null,
        isDraw: !hasWinner,
      },
    ];

    if (hasWinner) {
      const losingTeamId =
        winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
      await tx.team.update({
        where: { id: winnerTeamId },
        data: { mapWins: { increment: 1 } },
      });
      await tx.team.update({
        where: { id: losingTeamId },
        data: { mapLoses: { increment: 1 } },
      });
    }

    const matchWinnerTeamId =
      nextMapWinsA > nextMapWinsB
        ? match.teamAId
        : nextMapWinsB > nextMapWinsA
        ? match.teamBId
        : null;

    if (isFinished && matchWinnerTeamId && !isBracketMatch(match)) {
      const losingTeamId =
        matchWinnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
      await tx.team.update({
        where: { id: matchWinnerTeamId },
        data: { victories: { increment: 1 } },
      });
      await tx.team.update({
        where: { id: losingTeamId },
        data: { defeats: { increment: 1 } },
      });
    }

    const updatedMatch = await tx.match.update({
      where: { id: match.id },
      data: {
        mapWinsTeamA: nextMapWinsA,
        mapWinsTeamB: nextMapWinsB,
        bestOf: seriesBestOf,
        gameNumber: currentGameBeingReported, // store the game just played
        teamAready: 0,
        teamBready: 0,
        mapResults: nextMapResults,
        status: isFinished ? "FINISHED" : "ACTIVE",
      },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (match.draft) {
      await tx.draftTable.update({
        where: { id: match.draft.id },
        data: {
          phase: isFinished ? "FINISHED" : "STARTING",
          currentMapId: null,
          selectedMapType: null,
          currentTurnTeamId: isFinished ? null : nextTurnTeamId,
        },
      });
    }

    if (isFinished && isBracketMatch(match)) {
      await finalizeBracketMatch(tx, {
        ...match,
        mapWinsTeamA: nextMapWinsA,
        mapWinsTeamB: nextMapWinsB,
        status: "FINISHED",
      });
    }

    return updatedMatch;
  });
};

const undoLastResult = async (id) => {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    if (match.status === "FINISHED") {
      throw new Error("Cannot undo results for a finished match.");
    }

    const mapResults = Array.isArray(match.mapResults) ? match.mapResults : [];
    if (mapResults.length === 0) {
      throw new Error("No results to undo.");
    }

    if (!match.draft) {
      throw new Error("Draft table not found for this match.");
    }

    if (!["STARTING", "FINISHED"].includes(match.draft.phase)) {
      throw new Error("Can only undo before map picking starts.");
    }

    const lastResult = mapResults[mapResults.length - 1];
    const nextMapResults = mapResults.slice(0, -1);
    const hasWinner = !!lastResult.winnerTeamId;

    const matchWinnerTeamId =
      match.mapWinsTeamA > match.mapWinsTeamB
        ? match.teamAId
        : match.mapWinsTeamB > match.mapWinsTeamA
        ? match.teamBId
        : null;

    let nextMapWinsA = match.mapWinsTeamA;
    let nextMapWinsB = match.mapWinsTeamB;

    if (hasWinner) {
      if (lastResult.winnerTeamId === match.teamAId) {
        nextMapWinsA = Math.max(0, nextMapWinsA - 1);
      } else if (lastResult.winnerTeamId === match.teamBId) {
        nextMapWinsB = Math.max(0, nextMapWinsB - 1);
      }

      const losingTeamId =
        lastResult.winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;

      await tx.team.update({
        where: { id: lastResult.winnerTeamId },
        data: { mapWins: { decrement: 1 } },
      });
      await tx.team.update({
        where: { id: losingTeamId },
        data: { mapLoses: { decrement: 1 } },
      });
    }

    const nextGameNumber = Math.max(0, (match.gameNumber || 0) - 1);

    const updatedMatch = await tx.match.update({
      where: { id: match.id },
      data: {
        mapWinsTeamA: nextMapWinsA,
        mapWinsTeamB: nextMapWinsB,
        gameNumber: nextGameNumber,
        teamAready: 0,
        teamBready: 0,
        mapResults: nextMapResults,
        status: "ACTIVE",
      },
      include: {
        draft: {
          include: {
            actions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    await tx.draftTable.update({
      where: { id: match.draft.id },
      data: {
        phase: "ENDMAP",
        phaseStartedAt: new Date(),
        currentMapId: lastResult.mapId,
        selectedMapType: null,
        currentTurnTeamId: null,
      },
    });

    return updatedMatch;
  });
};

const findSoonest = () => {
  return prisma.match.findFirst({
    orderBy: { startDate: "asc" },
    where: { status: "SCHEDULED", startDate: { not: null } },
  });
};

const getMatchWinnerTeamId = (match) => {
  if (match.mapWinsTeamA > match.mapWinsTeamB) return match.teamAId;
  if (match.mapWinsTeamB > match.mapWinsTeamA) return match.teamBId;
  return null;
};

const playoffPairKey = (teamAId, teamBId) =>
  teamAId < teamBId ? `${teamAId}-${teamBId}` : `${teamBId}-${teamAId}`;

const enumerateOutcomes = (winnerOptions, index = 0, current = [], outcomes = []) => {
  if (index === winnerOptions.length) {
    outcomes.push([...current]);
    return outcomes;
  }

  for (const teamId of winnerOptions[index]) {
    current.push(teamId);
    enumerateOutcomes(winnerOptions, index + 1, current, outcomes);
    current.pop();
  }
  return outcomes;
};

const createGuaranteedNextRoundMatches = async (tx, tournamentId, currentRound) => {
  const expectedMatchCount = currentRound === 1 ? 4 : currentRound === 2 ? 2 : 0;
  if (!expectedMatchCount) return;

  const sourceMatches = await tx.match.findMany({
    where: { tournamentId, playoffRound: currentRound },
    orderBy: { playoffSlot: "asc" },
  });
  if (sourceMatches.length !== expectedMatchCount) return;

  const winnerOptions = sourceMatches.map((match) => {
    if (match.status === "FINISHED") {
      const winnerTeamId = getMatchWinnerTeamId(match);
      if (!winnerTeamId) throw new Error("A finished playoff match must have a winner.");
      return [winnerTeamId];
    }
    return [match.teamAId, match.teamBId];
  });

  const participantIds = [...new Set(winnerOptions.flat())];
  const teams = await tx.team.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, playoffSeed: true },
  });
  const seeds = new Map(teams.map((team) => [team.id, team.playoffSeed]));
  if (teams.some((team) => !Number.isInteger(team.playoffSeed))) {
    throw new Error("Every playoff team must have a seed.");
  }

  const outcomePairSets = enumerateOutcomes(winnerOptions).map((outcome) => {
    const sorted = [...outcome].sort((a, b) => seeds.get(a) - seeds.get(b));
    const pairs = new Set();
    for (let index = 0; index < sorted.length / 2; index += 1) {
      pairs.add(playoffPairKey(sorted[index], sorted[sorted.length - 1 - index]));
    }
    return pairs;
  });

  const guaranteedPairKeys = [...outcomePairSets[0]].filter((key) =>
    outcomePairSets.every((pairSet) => pairSet.has(key))
  );
  if (!guaranteedPairKeys.length) return;

  const nextRound = currentRound + 1;
  const existingMatches = await tx.match.findMany({
    where: { tournamentId, playoffRound: nextRound },
    select: { teamAId: true, teamBId: true },
  });
  const existingPairKeys = new Set(
    existingMatches.map((match) => playoffPairKey(match.teamAId, match.teamBId))
  );

  const rows = guaranteedPairKeys
    .filter((key) => !existingPairKeys.has(key))
    .map((key) => {
      const [firstId, secondId] = key.split("-").map(Number);
      const [teamAId, teamBId] = [firstId, secondId].sort(
        (a, b) => seeds.get(a) - seeds.get(b)
      );
      const isFinalRound = nextRound === GRAND_FINAL_ROUND;
      return {
        // The Grand Final must be type FINALS: the tournament sits in the FINALS
        // state by then, and validateMatchRules only allows FINALS matches there.
        type: isFinalRound ? "FINALS" : "PLAYOFFS",
        title: isFinalRound ? "Grand Final" : "Semifinal",
        playoffRound: nextRound,
        playoffSlot: seeds.get(teamAId),
        // Grand Final is best of 7 (first to 4); earlier rounds are best of 5.
        bestOf: isFinalRound ? 7 : 5,
        status: "SCHEDULED",
        tournamentId,
        teamAId,
        teamBId,
      };
    });

  if (rows.length) {
    await tx.match.createMany({ data: rows, skipDuplicates: true });
  }
};

const finalizeBracketMatch = async (tx, match) => {
  const winnerTeamId = getMatchWinnerTeamId(match);
  if (!winnerTeamId) {
    throw new Error("A playoff match cannot finish without a winner.");
  }

  const loserTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
  await tx.team.update({ where: { id: loserTeamId }, data: { state: "ELIMINATED" } });

  if (isGrandFinal(match)) {
    await tx.team.update({ where: { id: winnerTeamId }, data: { state: "ACTIVE" } });
    await tx.tournament.update({
      where: { id: match.tournamentId },
      data: { state: "FINISHED" },
    });
    return;
  }

  await createGuaranteedNextRoundMatches(tx, match.tournamentId, match.playoffRound);
};

/**
 * Hard reset of a match back to its initial SCHEDULED state.
 *
 * Wipes the draft, the scoreboard, the timers, the readiness flags and the
 * uploaded player stats, and rolls back every side effect the match caused on
 * the standings (team map wins/loses, victories/defeats, eliminations and the
 * tournament state). Intended for reruns/tests of a match from scratch.
 */
const resetMatchToSchedule = async (id) => {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id },
      include: { draft: true },
    });
    if (!match) {
      throw new Error("Match not found.");
    }

    const mapResults = Array.isArray(match.mapResults) ? match.mapResults : [];

    // 1. Roll back per-map team counters accumulated by this match.
    const mapWinsByTeam = new Map();
    const mapLosesByTeam = new Map();
    for (const result of mapResults) {
      const winnerTeamId = result?.winnerTeamId;
      if (!winnerTeamId) continue; // draws never incremented anything
      const loserTeamId =
        winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
      mapWinsByTeam.set(winnerTeamId, (mapWinsByTeam.get(winnerTeamId) || 0) + 1);
      mapLosesByTeam.set(loserTeamId, (mapLosesByTeam.get(loserTeamId) || 0) + 1);
    }

    for (const [teamId, amount] of mapWinsByTeam) {
      await tx.team.update({
        where: { id: teamId },
        data: { mapWins: { decrement: amount } },
      });
    }
    for (const [teamId, amount] of mapLosesByTeam) {
      await tx.team.update({
        where: { id: teamId },
        data: { mapLoses: { decrement: amount } },
      });
    }

    // 2. Roll back the match-level record. Bracket matches never award these.
    const matchWinnerTeamId = getMatchWinnerTeamId(match);
    const awardedMatchRecord =
      match.status === "FINISHED" &&
      matchWinnerTeamId &&
      !isBracketMatch(match);

    if (awardedMatchRecord) {
      const loserTeamId =
        matchWinnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
      await tx.team.update({
        where: { id: matchWinnerTeamId },
        data: { victories: { decrement: 1 } },
      });
      await tx.team.update({
        where: { id: loserTeamId },
        data: { defeats: { decrement: 1 } },
      });
    }

    // 3. Un-eliminate the loser of a finished bracket match and rewind the
    //    tournament state if this Grand Final had closed it.
    if (isBracketMatch(match) && match.status === "FINISHED" && matchWinnerTeamId) {
      const loserTeamId =
        matchWinnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
      await tx.team.update({
        where: { id: loserTeamId },
        data: { state: "ACTIVE" },
      });

      if (isGrandFinal(match)) {
        await tx.tournament.update({
          where: { id: match.tournamentId },
          data: { state: "FINALS" },
        });
      }
    }

    // 4. Drop bracket matches this one seeded, as long as they are untouched.
    if (isBracketMatch(match)) {
      const laterMatches = await tx.match.findMany({
        where: {
          tournamentId: match.tournamentId,
          playoffRound: { gt: match.playoffRound },
          status: "SCHEDULED",
        },
        select: { id: true, mapResults: true, draft: { select: { id: true } } },
      });

      const removableIds = laterMatches
        .filter((later) => {
          const results = Array.isArray(later.mapResults) ? later.mapResults : [];
          return results.length === 0 && !later.draft;
        })
        .map((later) => later.id);

      if (removableIds.length) {
        await tx.playerStat.deleteMany({ where: { matchId: { in: removableIds } } });
        await tx.match.deleteMany({ where: { id: { in: removableIds } } });
      }
    }

    // 5. Wipe the draft and the uploaded stats for this match.
    if (match.draft) {
      await tx.draftAction.deleteMany({ where: { draftId: match.draft.id } });
      await tx.draftTable.delete({ where: { id: match.draft.id } });
    }
    await tx.playerStat.deleteMany({ where: { matchId: match.id } });

    // 6. Back to square one: the schedule screen.
    return tx.match.update({
      where: { id: match.id },
      data: {
        status: "SCHEDULED",
        startDate: null,
        teamAready: 0,
        teamBready: 0,
        pointsTeamA: 0,
        pointsTeamB: 0,
        mapWinsTeamA: 0,
        mapWinsTeamB: 0,
        gameNumber: 0,
        mapResults: null,
        mapStartedAt: null,
        mapTimerPaused: false,
        mapTimerPausedAt: null,
        pauseRequestedAt: null,
        pauseRequestedBy: null,
      },
    });
  });
};

module.exports = {
  findById,
  findAll,
  create,
  update,
  remove,
  generateRoundRobin,
  submitResult,
  undoLastResult,
  findSoonest,
  resetMatchToSchedule,
  isBracketMatch,
  isGrandFinal,
  getSeriesBestOf,
  getRequiredWins,
  GRAND_FINAL_ROUND,
};
