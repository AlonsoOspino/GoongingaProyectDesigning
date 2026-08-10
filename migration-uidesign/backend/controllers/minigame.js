const path = require("node:path");
const prisma = require("../config/prisma");
const { saveUploadedImage } = require("../utils/contentImageUpload");

const GAME_TYPES = new Set(["JEOPARDY", "FAMILY_FEUD", "CUSTOM"]);
const GAME_STATUSES = new Set(["LIVE", "UNDER_DEVELOPMENT"]);
const JEOPARDY_PHASES = new Set(["CREATED", "PICKING_MEMBER", "PICKING_QUESTION", "RESPONDING", "RESPONDED", "FINALIZED"]);
const memberSelect = { id: true, username: true, avatarUrl: true };
const gameInclude = {
  createdBy: { select: memberSelect },
  underDevelopmentBy: { select: memberSelect },
  participants: {
    include: { member: { select: memberSelect } },
    orderBy: [{ score: "desc" }, { id: "asc" }],
  },
};

function asText(value, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function slugify(value) {
  return asText(value, 100)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function id(value, prefix) {
  const source = asText(value, 80).replace(/[^a-zA-Z0-9_-]/g, "");
  return source || `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultJeopardyConfig() {
  const preset = [
    ["Whose line is it?", [
      ["I'm putting a rock in this one!", "Who is Mei", 100],
      ["Nous sommes ravis de vous avoir parmi nous.", "Who is Luna (the omnic in the Paris attacker first-point spawn)", 200],
      ["Get ready for a shock!", "Who is Sombra", 300],
      ["Bone-a sera, signora... can I-a getchu-a somethin' to drink?", "Who is Cassidy", 400],
      ["Two Amaris foiled at once!", "Who is Doomfist", 500],
    ]],
    ["Overwatch Geoguesser", [
      ["Name the playable map location shown by the host.", "What is King's Row Winter", 100],
      ["Name the playable map location shown by the host.", "What is Watchpoint: Gibraltar", 200],
      ["Name the playable map location shown by the host.", "What is Powder Keg Mine (Stadium)", 300],
      ["Name the playable map location shown by the host.", "What is Busan Sanctuary", 400],
      ["Name the playable map location shown by the host.", "What is Paris", 500],
    ]],
    ["Throwback Season", [
      ["Who were the two recipients of the Tank Rolestar accolade in Season 7?", "Who are Deathoof and Arterrat", 100],
      ["AddieBC1 has won Rolestar for Support every posted season except which season?", "What is Season 6", 200],
      ["Who was the Season 3 MVP?", "Who is Sheppy", 300],
      ["What two teams have the worst W/L records in GGL history?", "Who are the Oracles (0-7) and Team Pete (0-7)", 400],
      ["What is Team AFN's all-time W/L record, not counting finals?", "What is 25-13", 500],
    ]],
    ["In-Game Mechanics", [
      ["How much healing does Mercy do per second? Bonus: how much during her ultimate?", "55 heals per second. Bonus: 65 heals per second.", 100],
      ["On release, how much armor did Torbjorn's armor packs give?", "What is 75 armor", 200],
      ["How much damage reduction does Vendetta receive when using Warding Stance?", "What is 75%", 300],
      ["How many characters have multiple quick-melee animations?", "What is 7: D.Va, Junker Queen, Shion, Mercy, Moira, Ramattra, and Emre", 400],
      ["How much damage would a Nano'd, full-HP Reinhardt take from a clip of Tracer headshots?", "Idk either", 500],
    ]],
    ["MiracleMax", [
      ["Gay Baby Jail", "What is Panopticon", 100],
      ["Grippy Sock Vacation", "What is Lifegrip", 200],
      ["Stomp-Tech", "What is Overrun", 300],
      ["That's a lot of Japanese", "What is Kitsune Rush", 400],
      ["BALLS", "What is Charged Volley (Orb of Destruction Alt-Fire)", 500],
    ]],
  ];

  return { categories: preset.map(([name, questions], categoryIndex) => ({
    id: `category-${categoryIndex + 1}`,
    name,
    questions: questions.map(([question, answer, reward], questionIndex) => ({
      id: `question-${categoryIndex + 1}-${questionIndex + 1}`,
      question,
      answer,
      reward,
    })),
  })) };
}

function normalizeJeopardyConfig(input) {
  const rawCategories = Array.isArray(input?.categories) ? input.categories.slice(0, 5) : [];
  const categories = rawCategories.map((category, categoryIndex) => ({
    id: id(category?.id, `category-${categoryIndex + 1}`),
    name: asText(category?.name, 80) || `Category ${categoryIndex + 1}`,
    questions: (Array.isArray(category?.questions) ? category.questions : []).slice(0, 5).map((question, questionIndex) => ({
      id: id(question?.id, `question-${categoryIndex + 1}-${questionIndex + 1}`),
      question: asText(question?.question, 1000),
      answer: asText(question?.answer, 1000),
      reward: Math.min(Math.max(Number(question?.reward) || 100, 1), 1000000),
    })).filter((question) => question.question && question.answer),
  }));

  return { categories: categories.length ? categories : defaultJeopardyConfig().categories };
}

function normalizeState(input) {
  const used = Array.isArray(input?.usedQuestionIds)
    ? [...new Set(input.usedQuestionIds.map((value) => asText(value, 100)).filter(Boolean))].slice(0, 25)
    : [];
  return {
    turnMemberId: Number.isInteger(Number(input?.turnMemberId)) ? Number(input.turnMemberId) : null,
    requestedQuestionId: asText(input?.requestedQuestionId, 100) || null,
    currentQuestionId: asText(input?.currentQuestionId, 100) || null,
    usedQuestionIds: used,
    revealed: Boolean(input?.revealed),
    responseText: asText(input?.responseText, 1000),
    answerCorrect: typeof input?.answerCorrect === "boolean" ? input.answerCorrect : null,
    respondedAt: asText(input?.respondedAt, 80) || null,
  };
}

function allQuestions(config) {
  return normalizeJeopardyConfig(config).categories.flatMap((category) =>
    category.questions.map((question) => ({ ...question, categoryId: category.id, categoryName: category.name })),
  );
}

function findQuestion(config, questionId) {
  return allQuestions(config).find((question) => question.id === questionId) || null;
}

async function withTurnMember(game) {
  const state = normalizeState(game.state);
  const currentPlayer = state.turnMemberId
    ? await prisma.networkMember.findUnique({ where: { id: state.turnMemberId }, select: memberSelect })
    : null;
  return { ...game, state, currentPlayer };
}

function participantPayload(participant) {
  return {
    id: participant.id,
    memberId: participant.memberId,
    score: participant.score,
    joinedAt: participant.joinedAt,
    member: participant.member,
  };
}

function publicBoard(config, state) {
  const normalizedConfig = normalizeJeopardyConfig(config);
  const normalizedState = normalizeState(state);
  const used = new Set(normalizedState.usedQuestionIds);

  return {
    categories: normalizedConfig.categories.map((category) => ({
      id: category.id,
      name: category.name,
      questions: category.questions.map((question) => ({
        id: question.id,
        reward: question.reward,
        used: used.has(question.id),
        selected: normalizedState.currentQuestionId === question.id,
        requested: normalizedState.requestedQuestionId === question.id,
      })),
    })),
  };
}

function toPublicGame(game) {
  const state = normalizeState(game.state);
  const currentQuestion = state.currentQuestionId ? findQuestion(game.config, state.currentQuestionId) : null;
  const showResponse = game.phase === "RESPONDED" || game.phase === "FINALIZED";
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    description: game.description,
    coverImageUrl: game.coverImageUrl,
    gameType: game.gameType,
    status: game.status,
    phase: game.phase,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    createdBy: game.createdBy,
    underDevelopmentBy: game.underDevelopmentBy,
    currentPlayer: game.currentPlayer || null,
    participants: (game.participants || []).map(participantPayload),
    board: game.gameType === "JEOPARDY" ? publicBoard(game.config, state) : null,
    gameState: {
      turnMemberId: state.turnMemberId,
      requestedQuestionId: state.requestedQuestionId,
      currentQuestionId: state.currentQuestionId,
      revealed: state.revealed,
      responseText: showResponse ? state.responseText : "",
      answerCorrect: showResponse ? state.answerCorrect : null,
      currentQuestion: currentQuestion ? {
        id: currentQuestion.id,
        categoryName: currentQuestion.categoryName,
        reward: currentQuestion.reward,
        question: currentQuestion.question,
      } : null,
    },
  };
}

function toManageGame(game) {
  const state = normalizeState(game.state);
  const currentQuestion = state.currentQuestionId ? findQuestion(game.config, state.currentQuestionId) : null;
  return {
    ...toPublicGame(game),
    config: game.gameType === "JEOPARDY" ? normalizeJeopardyConfig(game.config) : game.config,
    state,
    currentQuestion: currentQuestion ? { ...currentQuestion } : null,
  };
}

async function findGame(slug) {
  const game = await prisma.miniGame.findUnique({ where: { slug }, include: gameInclude });
  return game ? withTurnMember(game) : null;
}

async function findActiveJeopardy() {
  const game = await prisma.miniGame.findFirst({
    where: { gameType: "JEOPARDY", status: "LIVE" },
    include: gameInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  return game ? withTurnMember(game) : null;
}

function playerPayload(game, memberId) {
  const publicGame = toPublicGame(game);
  const state = normalizeState(game.state);
  const participant = (game.participants || []).find((entry) => entry.memberId === memberId) || null;
  const isTurn = state.turnMemberId === memberId;
  const currentQuestion = isTurn && state.currentQuestionId ? findQuestion(game.config, state.currentQuestionId) : null;
  return {
    ...publicGame,
    player: {
      isParticipant: Boolean(participant),
      joined: Boolean(participant?.joinedAt),
      isTurn,
      score: participant?.score || 0,
      requestedQuestionId: state.requestedQuestionId,
      responseText: isTurn ? state.responseText : "",
      currentQuestion: currentQuestion ? {
        id: currentQuestion.id,
        categoryName: currentQuestion.categoryName,
        reward: currentQuestion.reward,
        question: currentQuestion.question,
      } : null,
    },
  };
}

async function listGames(_req, res) {
  try {
    const games = await prisma.miniGame.findMany({
      where: { status: { in: ["LIVE", "UNDER_DEVELOPMENT"] } },
      include: gameInclude,
      orderBy: { updatedAt: "desc" },
    });
    const payload = await Promise.all(games.map(withTurnMember));
    return res.json(payload.map(toPublicGame));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load Minigames." });
  }
}

async function getFamilyFeudStatus(_req, res) {
  try {
    const developer = await prisma.networkMember.findFirst({
      where: { status: "ACTIVE", roles: { has: "DEVELOPER" } },
      select: memberSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return res.json({
      slug: "family-feud",
      title: "Family Feud",
      description: "The Goonginga Family Feud experience is getting its next big upgrade.",
      coverImageUrl: "/family-feud-stage.png",
      status: "UNDER_DEVELOPMENT",
      underDevelopmentBy: developer,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load Family Feud status." });
  }
}

async function getPublicGame(req, res) {
  try {
    const game = await findGame(slugify(req.params.slug));
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    return res.json(toPublicGame(game));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load this Minigame." });
  }
}

async function getActiveJeopardy(_req, res) {
  try {
    const game = await findActiveJeopardy();
    if (!game) return res.status(404).json({ message: "No Jeopardy game is currently available." });
    return res.json(toPublicGame(game));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load Jeopardy." });
  }
}

async function getActiveJeopardyPlayer(req, res) {
  try {
    const game = await findActiveJeopardy();
    if (!game) return res.status(404).json({ message: "No Jeopardy game is currently available." });
    return res.json(playerPayload(game, req.networkMember.id));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load the Jeopardy player view." });
  }
}

async function getPlayerGame(req, res) {
  try {
    const game = await findGame(slugify(req.params.slug));
    if (!game) return res.status(404).json({ message: "Minigame not found." });

    return res.json(playerPayload(game, req.networkMember.id));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load player view." });
  }
}

async function getManageGame(req, res) {
  try {
    const game = await findGame(slugify(req.params.slug));
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    return res.json(toManageGame(game));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load manager view." });
  }
}

async function createGame(req, res) {
  try {
    const title = asText(req.body?.title, 120);
    const slug = slugify(req.body?.slug || title);
    const gameType = asText(req.body?.gameType, 30).toUpperCase() || "JEOPARDY";
    if (!title) return res.status(400).json({ message: "A title is required." });
    if (!slug) return res.status(400).json({ message: "Enter a valid route, for example /quiz-night." });
    if (!GAME_TYPES.has(gameType)) return res.status(400).json({ message: "Unknown game type." });

    const participantIds = Array.isArray(req.body?.participantIds)
      ? [...new Set(req.body.participantIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))].slice(0, 100)
      : [];
    if (gameType === "JEOPARDY" && !participantIds.length) {
      return res.status(400).json({ message: "Select at least one Network Member for this Jeopardy game." });
    }

    if (participantIds.length) {
      const validMembers = await prisma.networkMember.count({ where: { id: { in: participantIds }, status: "ACTIVE" } });
      if (validMembers !== participantIds.length) return res.status(400).json({ message: "One or more selected members are unavailable." });
    }

    const game = await prisma.miniGame.create({
      data: {
        title,
        slug,
        description: asText(req.body?.description, 1500),
        coverImageUrl: asText(req.body?.coverImageUrl, 2048) || null,
        gameType,
        phase: "CREATED",
        config: gameType === "JEOPARDY" ? normalizeJeopardyConfig(req.body?.config) : {},
        state: normalizeState({}),
        createdById: req.networkMember.id,
        participants: participantIds.length ? {
          create: participantIds.map((memberId) => ({ memberId })),
        } : undefined,
      },
      include: gameInclude,
    });
    return res.status(201).json(toManageGame(await withTurnMember(game)));
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ message: "That route is already in use." });
    return res.status(400).json({ message: error?.message || "Could not create Minigame." });
  }
}

async function updateGame(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const existing = await prisma.miniGame.findUnique({ where: { slug } });
    if (!existing) return res.status(404).json({ message: "Minigame not found." });

    const nextTitle = req.body?.title === undefined ? existing.title : asText(req.body.title, 120);
    if (!nextTitle) return res.status(400).json({ message: "A title is required." });
    const nextSlug = req.body?.slug === undefined ? existing.slug : slugify(req.body.slug);
    if (!nextSlug) return res.status(400).json({ message: "Enter a valid route." });

    const participantIds = req.body?.participantIds === undefined
      ? null
      : [...new Set((Array.isArray(req.body.participantIds) ? req.body.participantIds : []).map(Number).filter((value) => Number.isInteger(value) && value > 0))].slice(0, 100);
    if (participantIds && existing.phase !== "CREATED") {
      return res.status(409).json({ message: "Participants can only be changed before the game starts." });
    }

    const game = await prisma.$transaction(async (tx) => {
      if (participantIds) {
        if (!participantIds.length) throw new Error("Select at least one Network Member.");
        const validMembers = await tx.networkMember.count({ where: { id: { in: participantIds }, status: "ACTIVE" } });
        if (validMembers !== participantIds.length) throw new Error("One or more selected members are unavailable.");
        await tx.miniGameParticipant.deleteMany({ where: { gameId: existing.id } });
        await tx.miniGameParticipant.createMany({ data: participantIds.map((memberId) => ({ gameId: existing.id, memberId })) });
      }
      return tx.miniGame.update({
      where: { slug },
      data: {
        title: nextTitle,
        slug: nextSlug,
        description: req.body?.description === undefined ? existing.description : asText(req.body.description, 1500),
        coverImageUrl: req.body?.coverImageUrl === undefined ? existing.coverImageUrl : (asText(req.body.coverImageUrl, 2048) || null),
        config: req.body?.config === undefined || existing.gameType !== "JEOPARDY"
          ? existing.config
          : normalizeJeopardyConfig(req.body.config),
      },
      include: gameInclude,
      });
    });
    return res.json(toManageGame(await withTurnMember(game)));
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ message: "That route is already in use." });
    return res.status(400).json({ message: error?.message || "Could not update Minigame." });
  }
}

async function updateStatus(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const status = asText(req.body?.status, 40).toUpperCase();
    if (!GAME_STATUSES.has(status)) return res.status(400).json({ message: "Unknown game status." });
    const game = await prisma.miniGame.update({
      where: { slug },
      data: {
        status,
        underDevelopmentById: status === "UNDER_DEVELOPMENT" ? req.networkMember.id : null,
      },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(game)));
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Minigame not found." });
    return res.status(400).json({ message: error?.message || "Could not update game status." });
  }
}

async function searchMembers(req, res) {
  try {
    const search = asText(req.query.search, 80);
    const members = await prisma.networkMember.findMany({
      where: {
        status: "ACTIVE",
        ...(search ? { username: { contains: search, mode: "insensitive" } } : {}),
      },
      select: memberSelect,
      orderBy: { username: "asc" },
      take: 12,
    });
    return res.json(members);
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not search Network Users." });
  }
}

async function joinGame(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    const participant = await prisma.miniGameParticipant.findUnique({
      where: { gameId_memberId: { gameId: game.id, memberId: req.networkMember.id } },
    });
    if (!participant) return res.status(403).json({ message: "You are not on this Jeopardy roster." });
    await prisma.miniGameParticipant.update({
      where: { id: participant.id },
      data: { joinedAt: participant.joinedAt || new Date() },
    });
    const updated = await findGame(slug);
    return res.json(playerPayload(updated, req.networkMember.id));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not join this Jeopardy game." });
  }
}

async function startJeopardy(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug }, include: { participants: true } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    if (game.gameType !== "JEOPARDY") return res.status(400).json({ message: "This is not a Jeopardy game." });
    if (!game.participants.length) return res.status(409).json({ message: "Add participants before starting." });
    if (game.phase !== "CREATED") return res.status(409).json({ message: "This game has already started." });
    const updated = await prisma.miniGame.update({
      where: { slug },
      data: { phase: "PICKING_MEMBER", state: normalizeState({}) },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not start Jeopardy." });
  }
}

async function setTurn(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    if (game.gameType !== "JEOPARDY") return res.status(400).json({ message: "Turns are only configured for Jeopardy games." });
    if (game.phase !== "PICKING_MEMBER") return res.status(409).json({ message: "Jeopardy is not waiting for a member." });

    const memberId = Number(req.body?.memberId);
    const member = Number.isInteger(memberId) && memberId > 0
      ? await prisma.networkMember.findFirst({ where: { id: memberId, status: "ACTIVE" }, select: memberSelect })
      : null;
    if (!member) return res.status(400).json({ message: "Choose an active Network User." });
    const participant = await prisma.miniGameParticipant.findUnique({
      where: { gameId_memberId: { gameId: game.id, memberId: member.id } },
    });
    if (!participant) return res.status(400).json({ message: "Choose a member from this Jeopardy roster." });

    const state = normalizeState(game.state);
    const updated = await prisma.miniGame.update({
      where: { slug },
      data: {
        phase: "PICKING_QUESTION",
        state: { ...state, turnMemberId: member.id, requestedQuestionId: null, currentQuestionId: null, revealed: false, responseText: "", answerCorrect: null, respondedAt: null },
      },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not change turn." });
  }
}

async function requestQuestion(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const questionId = asText(req.body?.questionId, 100);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });

    const state = normalizeState(game.state);
    if (game.gameType !== "JEOPARDY" || state.turnMemberId !== req.networkMember.id) {
      return res.status(403).json({ message: "It is not your turn." });
    }
    if (game.phase !== "PICKING_QUESTION") return res.status(409).json({ message: "The board is not accepting a question pick." });
    if (state.currentQuestionId) return res.status(409).json({ message: "The host has already selected a question." });
    if (state.usedQuestionIds.includes(questionId) || !findQuestion(game.config, questionId)) {
      return res.status(400).json({ message: "That question is not available." });
    }

    const updated = await prisma.miniGame.update({
      where: { slug },
      data: { state: { ...state, requestedQuestionId: questionId } },
      include: gameInclude,
    });
    return res.json(toPublicGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not request question." });
  }
}

async function selectQuestion(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const questionId = asText(req.body?.questionId, 100);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    const state = normalizeState(game.state);
    if (game.gameType !== "JEOPARDY") return res.status(400).json({ message: "This is not a Jeopardy game." });
    if (game.phase !== "PICKING_QUESTION") return res.status(409).json({ message: "Jeopardy is not waiting for a question." });
    if (!state.turnMemberId) return res.status(409).json({ message: "Choose whose turn it is first." });
    if (state.usedQuestionIds.includes(questionId) || !findQuestion(game.config, questionId)) {
      return res.status(400).json({ message: "That question is not available." });
    }
    if (state.requestedQuestionId && state.requestedQuestionId !== questionId) {
      return res.status(409).json({ message: "Select the question highlighted by the player." });
    }

    const updated = await prisma.miniGame.update({
      where: { slug },
      data: {
        phase: "RESPONDING",
        state: { ...state, currentQuestionId: questionId, requestedQuestionId: null, revealed: false, responseText: "", answerCorrect: null, respondedAt: null },
      },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not select question." });
  }
}

async function submitResponse(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    const state = normalizeState(game.state);
    if (game.phase !== "RESPONDING" || state.turnMemberId !== req.networkMember.id) {
      return res.status(403).json({ message: "You are not the responding player." });
    }
    const updated = await prisma.miniGame.update({
      where: { slug },
      data: { state: { ...state, responseText: asText(req.body?.responseText, 1000) } },
      include: gameInclude,
    });
    return res.json(playerPayload(await withTurnMember(updated), req.networkMember.id));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not submit the response." });
  }
}

async function resolveQuestion(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    const state = normalizeState(game.state);
    if (!state.currentQuestionId) return res.status(409).json({ message: "No question is selected." });
    if (game.phase !== "RESPONDING") return res.status(409).json({ message: "Jeopardy is not waiting for a result." });
    if (typeof req.body?.correct !== "boolean") return res.status(400).json({ message: "Mark the response as correct or incorrect." });
    const question = findQuestion(game.config, state.currentQuestionId);
    if (!question || !state.turnMemberId) return res.status(409).json({ message: "The active turn is incomplete." });
    const responseText = req.body?.responseText === undefined ? state.responseText : asText(req.body.responseText, 1000);

    const updated = await prisma.$transaction(async (tx) => {
      if (req.body.correct) {
        await tx.miniGameParticipant.update({
          where: { gameId_memberId: { gameId: game.id, memberId: state.turnMemberId } },
          data: { score: { increment: question.reward } },
        });
      }
      return tx.miniGame.update({
        where: { slug },
        data: {
          phase: "RESPONDED",
          state: {
            ...state,
            responseText,
            answerCorrect: req.body.correct,
            respondedAt: new Date().toISOString(),
            revealed: true,
            usedQuestionIds: [...new Set([...state.usedQuestionIds, state.currentQuestionId])],
          },
        },
        include: gameInclude,
      });
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not resolve question." });
  }
}

async function advanceJeopardy(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    if (game.phase !== "RESPONDED") return res.status(409).json({ message: "Resolve the current question first." });
    const state = normalizeState(game.state);
    const updated = await prisma.miniGame.update({
      where: { slug },
      data: {
        phase: "PICKING_MEMBER",
        state: { ...state, turnMemberId: null, requestedQuestionId: null, currentQuestionId: null, revealed: false, responseText: "", answerCorrect: null, respondedAt: null },
      },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not continue Jeopardy." });
  }
}

async function finalizeJeopardy(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    if (game.gameType !== "JEOPARDY" || game.phase === "CREATED") return res.status(409).json({ message: "Start Jeopardy before finalizing it." });
    const updated = await prisma.miniGame.update({ where: { slug }, data: { phase: "FINALIZED" }, include: gameInclude });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not finalize Jeopardy." });
  }
}

async function uploadCover(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    const mediaDirectory = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, "..", "uploads"), "minigames");
    const baseUrl = process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const url = await saveUploadedImage({
      file: req.file,
      displayName: game.slug,
      filePrefix: "minigame-cover",
      targetDirectory: mediaDirectory,
      publicPrefix: `${baseUrl.replace(/\/$/, "")}/uploads/minigames`,
    });
    const updated = await prisma.miniGame.update({ where: { slug }, data: { coverImageUrl: url }, include: gameInclude });
    return res.status(201).json({ url, game: toManageGame(await withTurnMember(updated)) });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not upload cover image." });
  }
}

module.exports = {
  listGames,
  getFamilyFeudStatus,
  getPublicGame,
  getActiveJeopardy,
  getActiveJeopardyPlayer,
  getPlayerGame,
  getManageGame,
  createGame,
  updateGame,
  updateStatus,
  searchMembers,
  joinGame,
  startJeopardy,
  setTurn,
  requestQuestion,
  selectQuestion,
  submitResponse,
  resolveQuestion,
  advanceJeopardy,
  finalizeJeopardy,
  uploadCover,
  __testables: { normalizeJeopardyConfig, normalizeState, publicBoard, JEOPARDY_PHASES },
};
