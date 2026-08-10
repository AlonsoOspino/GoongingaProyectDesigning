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
  const questionResults = Array.isArray(input?.questionResults)
    ? input.questionResults.slice(0, 25).map((result) => ({
        questionId: asText(result?.questionId, 100),
        memberId: result?.memberId !== null && result?.memberId !== undefined && Number.isInteger(Number(result.memberId))
          ? Number(result.memberId)
          : null,
        reward: Math.max(0, Number(result?.reward) || 0),
      })).filter((result) => result.questionId)
    : [];
  return {
    turnMemberId: input?.turnMemberId !== null && input?.turnMemberId !== undefined && Number.isInteger(Number(input.turnMemberId))
      ? Number(input.turnMemberId)
      : null,
    requestedQuestionId: asText(input?.requestedQuestionId, 100) || null,
    currentQuestionId: asText(input?.currentQuestionId, 100) || null,
    usedQuestionIds: used,
    revealed: Boolean(input?.revealed),
    responseText: asText(input?.responseText, 1000),
    answerCorrect: typeof input?.answerCorrect === "boolean" ? input.answerCorrect : null,
    respondedAt: asText(input?.respondedAt, 80) || null,
    questionResults,
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
  const results = new Map(normalizedState.questionResults.map((result) => [result.questionId, result]));

  return {
    categories: normalizedConfig.categories.map((category) => ({
      id: category.id,
      name: category.name,
      questions: category.questions.map((question) => {
        const result = results.get(question.id);
        return {
          id: question.id,
          reward: question.reward,
          used: used.has(question.id),
          selected: normalizedState.currentQuestionId === question.id,
          requested: normalizedState.requestedQuestionId === question.id,
          answeredMemberId: result?.memberId ?? null,
          unanswered: Boolean(result && result.memberId === null),
        };
      }),
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
      questionResults: state.questionResults,
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

async function deleteGame(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const game = await prisma.miniGame.findUnique({ where: { slug }, select: { id: true, slug: true, gameType: true } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    if (game.gameType !== "JEOPARDY") return res.status(400).json({ message: "Only Jeopardy games can be removed here." });
    await prisma.miniGame.delete({ where: { id: game.id } });
    return res.json({ deleted: true, slug: game.slug });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not delete this Jeopardy game." });
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
      data: { phase: "PICKING_QUESTION", state: normalizeState({}) },
      include: gameInclude,
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not start Jeopardy." });
  }
}

async function awardJeopardyQuestion(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const questionId = asText(req.body?.questionId, 100);
    const requestedMemberId = req.body?.memberId === null ? null : Number(req.body?.memberId);
    const game = await prisma.miniGame.findUnique({ where: { slug }, include: { participants: true } });
    if (!game) return res.status(404).json({ message: "Minigame not found." });
    if (game.gameType !== "JEOPARDY" || game.phase !== "PICKING_QUESTION") {
      return res.status(409).json({ message: "Jeopardy is not accepting results." });
    }
    const question = findQuestion(game.config, questionId);
    const state = normalizeState(game.state);
    if (!question || state.usedQuestionIds.includes(questionId)) {
      return res.status(400).json({ message: "That question is not available." });
    }
    if (requestedMemberId !== null && !game.participants.some((participant) => participant.memberId === requestedMemberId)) {
      return res.status(400).json({ message: "Choose a participant from this Jeopardy roster." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (requestedMemberId !== null) {
        await tx.miniGameParticipant.update({
          where: { gameId_memberId: { gameId: game.id, memberId: requestedMemberId } },
          data: { score: { increment: question.reward } },
        });
      }
      return tx.miniGame.update({
        where: { slug },
        data: {
          state: {
            ...state,
            usedQuestionIds: [...state.usedQuestionIds, questionId],
            questionResults: [...state.questionResults, { questionId, memberId: requestedMemberId, reward: question.reward }],
          },
        },
        include: gameInclude,
      });
    });
    return res.json(toManageGame(await withTurnMember(updated)));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not save this Jeopardy result." });
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
  getManageGame,
  createGame,
  updateGame,
  updateStatus,
  deleteGame,
  searchMembers,
  startJeopardy,
  awardJeopardyQuestion,
  finalizeJeopardy,
  uploadCover,
  __testables: { normalizeJeopardyConfig, normalizeState, publicBoard, JEOPARDY_PHASES },
};
