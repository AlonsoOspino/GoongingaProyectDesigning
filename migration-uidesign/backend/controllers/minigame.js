const path = require("node:path");
const prisma = require("../config/prisma");
const { saveUploadedImage } = require("../utils/contentImageUpload");

const GAME_TYPES = new Set(["JEOPARDY", "FAMILY_FEUD", "CUSTOM"]);
const GAME_STATUSES = new Set(["LIVE", "UNDER_DEVELOPMENT"]);
const memberSelect = { id: true, username: true, avatarUrl: true };
const gameInclude = {
  createdBy: { select: memberSelect },
  underDevelopmentBy: { select: memberSelect },
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
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    description: game.description,
    coverImageUrl: game.coverImageUrl,
    gameType: game.gameType,
    status: game.status,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    createdBy: game.createdBy,
    underDevelopmentBy: game.underDevelopmentBy,
    currentPlayer: game.currentPlayer || null,
    board: game.gameType === "JEOPARDY" ? publicBoard(game.config, state) : null,
    gameState: {
      turnMemberId: state.turnMemberId,
      requestedQuestionId: state.requestedQuestionId,
      currentQuestionId: state.currentQuestionId,
      revealed: state.revealed,
    },
  };
}

function toManageGame(game) {
  return {
    ...toPublicGame(game),
    config: game.gameType === "JEOPARDY" ? normalizeJeopardyConfig(game.config) : game.config,
    state: normalizeState(game.state),
  };
}

async function findGame(slug) {
  const game = await prisma.miniGame.findUnique({ where: { slug }, include: gameInclude });
  return game ? withTurnMember(game) : null;
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

async function getPlayerGame(req, res) {
  try {
    const game = await findGame(slugify(req.params.slug));
    if (!game) return res.status(404).json({ message: "Minigame not found." });

    const publicGame = toPublicGame(game);
    const state = normalizeState(game.state);
    const isTurn = state.turnMemberId === req.networkMember.id;
    const currentQuestion = isTurn && state.currentQuestionId ? findQuestion(game.config, state.currentQuestionId) : null;

    return res.json({
      ...publicGame,
      player: {
        isTurn,
        requestedQuestionId: state.requestedQuestionId,
        currentQuestion: currentQuestion ? {
          id: currentQuestion.id,
          categoryName: currentQuestion.categoryName,
          reward: currentQuestion.reward,
          question: currentQuestion.question,
          revealed: state.revealed,
        } : null,
      },
    });
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

    const game = await prisma.miniGame.create({
      data: {
        title,
        slug,
        description: asText(req.body?.description, 1500),
        coverImageUrl: asText(req.body?.coverImageUrl, 2048) || null,
        gameType,
        config: gameType === "JEOPARDY" ? normalizeJeopardyConfig(req.body?.config) : {},
        state: normalizeState({}),
        createdById: req.networkMember.id,
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

    const game = await prisma.miniGame.update({
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

async function setTurn(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    if (game.gameType !== "JEOPARDY") return res.status(400).json({ message: "Turns are only configured for Jeopardy games." });

    const memberId = Number(req.body?.memberId);
    const member = Number.isInteger(memberId) && memberId > 0
      ? await prisma.networkMember.findFirst({ where: { id: memberId, status: "ACTIVE" }, select: memberSelect })
      : null;
    if (!member) return res.status(400).json({ message: "Choose an active Network User." });

    const state = normalizeState(game.state);
    const updated = await prisma.miniGame.update({
      where: { slug },
      data: { state: { ...state, turnMemberId: member.id, requestedQuestionId: null, currentQuestionId: null, revealed: false } },
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
    if (!state.turnMemberId) return res.status(409).json({ message: "Choose whose turn it is first." });
    if (state.usedQuestionIds.includes(questionId) || !findQuestion(game.config, questionId)) {
      return res.status(400).json({ message: "That question is not available." });
    }

    const updated = await prisma.miniGame.update({
      where: { slug },
      data: { state: { ...state, currentQuestionId: questionId, requestedQuestionId: null, revealed: false } },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not select question." });
  }
}

async function resolveQuestion(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    const state = normalizeState(game.state);
    if (!state.currentQuestionId) return res.status(409).json({ message: "No question is selected." });

    const action = asText(req.body?.action, 20).toLowerCase();
    if (action === "reveal") {
      const updated = await prisma.miniGame.update({
        where: { slug }, data: { state: { ...state, revealed: true } }, include: gameInclude,
      });
      return res.json(toManageGame(await withTurnMember(updated)));
    }

    if (action !== "complete") return res.status(400).json({ message: "Unknown question action." });
    const updated = await prisma.miniGame.update({
      where: { slug },
      data: {
        state: {
          ...state,
          currentQuestionId: null,
          requestedQuestionId: null,
          revealed: false,
          usedQuestionIds: [...new Set([...state.usedQuestionIds, state.currentQuestionId])],
        },
      },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not resolve question." });
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
  getPlayerGame,
  getManageGame,
  createGame,
  updateGame,
  updateStatus,
  searchMembers,
  setTurn,
  requestQuestion,
  selectQuestion,
  resolveQuestion,
  uploadCover,
};
