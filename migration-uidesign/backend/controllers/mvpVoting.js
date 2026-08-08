const path = require("node:path");
const prisma = require("../config/prisma");
const { saveUploadedImage } = require("../utils/contentImageUpload");

// IMPORTANT: this object is passed to MvpCampaign.include, so the relation
// that must be included is `candidates`. The old code incorrectly put
// `votes` and `orderBy` directly at the campaign include level.
const campaignInclude = {
  candidates: {
    orderBy: { sortOrder: "asc" },
    include: {
      votes: {
        select: { id: true },
      },
    },
  },
};

function isGrandFinal(match) {
  return match && (match.type === "FINALS" || /grand\s*final/i.test(match.title || ""));
}

function serializeCampaign(campaign, includeCounts = false) {
  return {
    id: campaign.id,
    matchId: campaign.matchId,
    status: campaign.status,
    openedAt: campaign.openedAt,
    closedAt: campaign.closedAt,
    publishedAt: campaign.publishedAt,
    winnerCandidateId: campaign.winnerCandidateId,
    candidates: (campaign.candidates || []).map((candidate) => ({
      id: candidate.id,
      memberId: candidate.memberId,
      displayName: candidate.displayName,
      imageUrl: candidate.imageUrl,
      sortOrder: candidate.sortOrder,
      ...(includeCounts ? { voteCount: candidate.votes?.length || 0 } : {}),
    })),
  };
}

async function findFinishedGrandFinal() {
  const matches = await prisma.match.findMany({
    where: { status: "FINISHED" },
    orderBy: { id: "desc" },
    include: {
      teamA: { include: { members: true } },
      teamB: { include: { members: true } },
    },
  });

  return matches.find(isGrandFinal) || null;
}

async function ensureCampaign() {
  const match = await findFinishedGrandFinal();
  if (!match) return null;

  const winningTeam = match.pointsTeamA >= match.pointsTeamB ? match.teamA : match.teamB;
  const members = (winningTeam.members || []).slice(0, 5);

  if (members.length !== 5) {
    return { incomplete: true, match, winningTeam, members };
  }

  let campaign = await prisma.mvpCampaign.findUnique({
    where: { matchId: match.id },
    include: campaignInclude,
  });

  if (!campaign) {
    campaign = await prisma.mvpCampaign.create({
      data: {
        matchId: match.id,
        candidates: {
          create: members.map((member, index) => ({
            memberId: member.id,
            displayName: member.nickname,
            sortOrder: index,
          })),
        },
      },
      include: campaignInclude,
    });
  }

  return { campaign, match, winningTeam, members };
}

async function getPublic(req, res) {
  try {
    const result = await ensureCampaign();

    if (!result) {
      return res.json({ active: false, campaign: null });
    }

    if (result.incomplete) {
      return res.json({
        active: false,
        reason: "Winning roster is not ready yet.",
        campaign: null,
      });
    }

    return res.json({
      active: result.campaign.status === "OPEN" || Boolean(result.campaign.publishedAt),
      campaign: serializeCampaign(result.campaign, false),
    });
  } catch (error) {
    console.error("[mvp] Public ballot load failed:", error);
    return res.status(500).json({ message: "Could not load MVP voting." });
  }
}

async function getManage(req, res) {
  try {
    const result = await ensureCampaign();

    if (!result) {
      return res.json({ active: false, campaign: null });
    }

    if (result.incomplete) {
      return res.json({
        active: false,
        reason: "Winning roster must contain five members.",
        campaign: null,
      });
    }

    return res.json({
      active: true,
      campaign: serializeCampaign(result.campaign, true),
      match: {
        id: result.match.id,
        title: result.match.title,
        status: result.match.status,
        winningTeam: result.winningTeam.name,
      },
    });
  } catch (error) {
    console.error("[mvp] Manager load failed:", error);
    return res.status(500).json({ message: "Could not load MVP manager." });
  }
}

async function vote(req, res) {
  const candidateId = Number(req.body?.candidateId);

  if (!Number.isInteger(candidateId)) {
    return res.status(400).json({ message: "Choose a valid MVP candidate." });
  }

  try {
    const result = await ensureCampaign();

    if (!result || result.incomplete || result.campaign.status !== "OPEN") {
      return res.status(409).json({ message: "MVP voting is not open." });
    }

    const candidate = result.campaign.candidates.find((item) => item.id === candidateId);
    if (!candidate) {
      return res.status(400).json({ message: "Choose one of the eligible MVP candidates." });
    }

    await prisma.mvpVote.create({
      data: {
        campaignId: result.campaign.id,
        candidateId,
        networkMemberId: req.networkMember.id,
      },
    });

    return res.status(201).json({ ok: true });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "You have already voted in this MVP election." });
    }

    console.error("[mvp] Vote failed:", error);
    return res.status(500).json({ message: "Could not record your vote." });
  }
}

async function updateStatus(req, res) {
  const status = String(req.body?.status || "").toUpperCase();

  if (!["OPEN", "CLOSED"].includes(status)) {
    return res.status(400).json({ message: "Invalid MVP status." });
  }

  try {
    const result = await ensureCampaign();

    if (!result || result.incomplete) {
      return res.status(409).json({ message: "The finished winning roster is not ready." });
    }

    const data = status === "OPEN"
      ? { status, openedAt: new Date(), closedAt: null }
      : { status, closedAt: new Date() };

    const campaign = await prisma.mvpCampaign.update({
      where: { id: result.campaign.id },
      data,
      include: campaignInclude,
    });

    return res.json({ campaign: serializeCampaign(campaign, true) });
  } catch (error) {
    console.error("[mvp] Status update failed:", error);
    return res.status(500).json({ message: "Could not update MVP voting." });
  }
}

async function uploadCandidate(req, res) {
  const candidateId = Number(req.params.candidateId);

  if (!Number.isInteger(candidateId)) {
    return res.status(400).json({ message: "Invalid MVP candidate." });
  }

  if (!req.file) {
    return res.status(400).json({ message: "An image is required." });
  }

  try {
    const result = await ensureCampaign();
    const candidate = result?.campaign?.candidates?.find((item) => item.id === candidateId);

    if (!candidate) {
      return res.status(404).json({ message: "MVP candidate not found." });
    }

    const directory = path.resolve(
      process.env.MEDIA_DIR || path.join(__dirname, "..", "uploads"),
      "mvp",
    );
    const baseUrl = process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get("host")}`;

    const imageUrl = await saveUploadedImage({
      file: req.file,
      displayName: candidate.displayName,
      filePrefix: "mvp",
      targetDirectory: directory,
      publicPrefix: `${baseUrl.replace(/\/$/, "")}/uploads/mvp`,
    });

    const updated = await prisma.mvpCandidate.update({
      where: { id: candidateId },
      data: { imageUrl },
    });

    return res.status(201).json({ candidate: updated });
  } catch (error) {
    console.error("[mvp] Candidate image upload failed:", error);
    return res.status(500).json({ message: "Could not upload MVP image." });
  }
}

async function publishWinner(req, res) {
  try {
    const result = await ensureCampaign();

    if (!result || result.incomplete) {
      return res.status(409).json({ message: "The winning roster is not ready." });
    }

    const winner = await prisma.mvpVote.groupBy({
      by: ["candidateId"],
      where: { campaignId: result.campaign.id },
      _count: { candidateId: true },
      orderBy: [
        { _count: { candidateId: "desc" } },
        { candidateId: "asc" },
      ],
      take: 1,
    });

    if (!winner[0]) {
      return res.status(409).json({ message: "No votes have been recorded." });
    }

    const campaign = await prisma.mvpCampaign.update({
      where: { id: result.campaign.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        publishedAt: new Date(),
        winnerCandidateId: winner[0].candidateId,
      },
      include: campaignInclude,
    });

    return res.json({ campaign: serializeCampaign(campaign, true) });
  } catch (error) {
    console.error("[mvp] Winner publish failed:", error);
    return res.status(500).json({ message: "Could not publish MVP winner." });
  }
}

module.exports = {
  getPublic,
  getManage,
  vote,
  updateStatus,
  uploadCandidate,
  publishWinner,
};
