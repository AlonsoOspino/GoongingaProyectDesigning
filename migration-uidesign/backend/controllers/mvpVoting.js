const path = require("node:path");
const prisma = require("../config/prisma");
const { saveUploadedImage, deleteStoredImage } = require("../utils/contentImageUpload");

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
            imageUrl: member.profilePic,
            sortOrder: index,
          })),
        },
      },
      include: campaignInclude,
    });
  } else if (campaign.status === "DRAFT" && !campaign.publishedAt && !campaign.candidates.some((candidate) => candidate.votes.length)) {
    const winningMemberIds = new Set(members.map((member) => member.id));
    const staleCandidateIds = campaign.candidates
      .filter((candidate) => !winningMemberIds.has(candidate.memberId))
      .map((candidate) => candidate.id);

    await prisma.$transaction(async (tx) => {
      if (staleCandidateIds.length) {
        await tx.mvpCandidate.deleteMany({ where: { id: { in: staleCandidateIds } } });
      }

      // Free the unique sort-order slots before reassigning them. This makes
      // swaps in a changed winning roster safe inside the same transaction.
      for (const candidate of campaign.candidates.filter((item) => !staleCandidateIds.includes(item.id))) {
        await tx.mvpCandidate.update({
          where: { id: candidate.id },
          data: { sortOrder: -(candidate.id + 1) },
        });
      }

      for (const [index, member] of members.entries()) {
        const existing = campaign.candidates.find((candidate) => candidate.memberId === member.id);
        if (existing) {
          await tx.mvpCandidate.update({
            where: { id: existing.id },
            data: {
              displayName: member.nickname,
              sortOrder: index,
            },
          });
        } else {
          await tx.mvpCandidate.create({
            data: {
              campaignId: campaign.id,
              memberId: member.id,
              displayName: member.nickname,
              imageUrl: member.profilePic,
              sortOrder: index,
            },
          });
        }
      }
    });

    campaign = await prisma.mvpCampaign.findUnique({
      where: { id: campaign.id },
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

    // `active` still means "there is something to show the audience", but the
    // campaign is always returned so the ballot page and the landing banner can
    // render the correct phase (not open yet / open / closed / revealed) instead
    // of falling back to a generic "unavailable" screen during the handoff.
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

/**
 * Reports whether the signed-in viewer already voted.
 *
 * The ballot previously tracked this in client state only, so a refresh made an
 * already-used ballot look votable again and the user only found out via a 409.
 */
async function getMyVote(req, res) {
  try {
    const result = await ensureCampaign();

    if (!result || result.incomplete) {
      return res.json({ hasVoted: false, candidateId: null });
    }

    const vote = await prisma.mvpVote.findFirst({
      where: {
        campaignId: result.campaign.id,
        networkMemberId: req.networkMember.id,
      },
      select: { candidateId: true },
    });

    return res.json({
      hasVoted: Boolean(vote),
      candidateId: vote?.candidateId ?? null,
    });
  } catch (error) {
    console.error("[mvp] Vote lookup failed:", error);
    return res.status(500).json({ message: "Could not check your vote." });
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

    // Once the MVP has been revealed on stream the election is final. Reopening
    // it used to leave a published winner attached to a live ballot, which meant
    // the public page showed the reveal while new votes were still landing.
    if (result.campaign.publishedAt) {
      return res.status(409).json({
        message: "The MVP has already been revealed. This election is final.",
      });
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

    // Store the file in MEDIA_DIR, but persist a RELATIVE public URL.
    // This is intentional: production is served behind the /backend reverse-proxy
    // prefix, so building an absolute URL from req.protocol/req.host can incorrectly
    // produce https://host/uploads/... instead of https://host/backend/uploads/....
    // The frontend's resolveGenericBackendAsset() prepends NEXT_PUBLIC_API_BASE_URL.
    const directory = path.resolve(
      process.env.MEDIA_DIR || path.join(__dirname, "..", "uploads"),
    );

    // Normalized to a 4:5 portrait at broadcast resolution. Both the ballot card
    // and the winner reveal crop from this single consistent source, so an
    // odd-sized upload can no longer render stretched or off-center.
    const imageUrl = await saveUploadedImage({
      file: req.file,
      displayName: candidate.displayName,
      filePrefix: "mvp",
      targetDirectory: directory,
      publicPrefix: "/uploads",
      normalize: { width: 1000, height: 1250 },
    });

    const updated = await prisma.mvpCandidate.update({
      where: { id: candidateId },
      data: { imageUrl },
    });

    // Replacing a photo used to leave the previous file orphaned in MEDIA_DIR.
    if (candidate.imageUrl && candidate.imageUrl !== imageUrl) {
      await deleteStoredImage({ imgPath: candidate.imageUrl, targetDirectory: directory }).catch(
        (error) => console.error("[mvp] Could not remove replaced image:", error),
      );
    }

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

    if (result.campaign.publishedAt) {
      return res.status(409).json({ message: "The MVP winner has already been published." });
    }

    // The manager can force a specific winner. This is what makes a tie or a
    // zero-vote ballot resolvable instead of a dead end mid-broadcast.
    const forcedId = req.body?.candidateId === undefined ? null : Number(req.body.candidateId);

    if (forcedId !== null && !Number.isInteger(forcedId)) {
      return res.status(400).json({ message: "Invalid MVP candidate." });
    }

    let winnerCandidateId = forcedId;

    if (winnerCandidateId === null) {
      const tally = await prisma.mvpVote.groupBy({
        by: ["candidateId"],
        where: { campaignId: result.campaign.id },
        _count: { candidateId: true },
        orderBy: { _count: { candidateId: "desc" } },
      });

      if (!tally.length) {
        return res.status(409).json({
          message: "No votes were recorded. Pick the MVP manually to reveal a winner.",
          needsManualPick: true,
        });
      }

      const topCount = tally[0]._count.candidateId;
      const tied = tally.filter((row) => row._count.candidateId === topCount);

      // The previous code broke ties by lowest candidate id, silently crowning a
      // player who had not actually won. A tie is now surfaced to the manager.
      if (tied.length > 1) {
        return res.status(409).json({
          message: "There is a tie for the MVP. Pick the winner manually to break it.",
          needsManualPick: true,
          tiedCandidateIds: tied.map((row) => row.candidateId),
          voteCount: topCount,
        });
      }

      winnerCandidateId = tally[0].candidateId;
    }

    if (!result.campaign.candidates.some((item) => item.id === winnerCandidateId)) {
      return res.status(400).json({ message: "Choose one of the eligible MVP candidates." });
    }

    const campaign = await prisma.mvpCampaign.update({
      where: { id: result.campaign.id },
      data: {
        status: "CLOSED",
        closedAt: result.campaign.closedAt || new Date(),
        publishedAt: new Date(),
        winnerCandidateId,
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
  getMyVote,
  updateStatus,
  uploadCandidate,
  publishWinner,
};
