const path = require("path");
const { saveUploadedImage } = require("../utils/contentImageUpload");
const prisma = require("../config/prisma");
const { getTemplate, normalizeCountdown } = require("../announcements/registry");

function serialize(announcement) {
  return {
    id: announcement.id,
    name: announcement.name,
    type: announcement.type,
    content: announcement.content,
    countdownAt: announcement.countdownAt,
    published: announcement.published,
    order: announcement.order,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  };
}

function serializePublic(announcement, payload) {
  return {
    id: announcement.id,
    name: announcement.name,
    type: announcement.type,
    content: announcement.content,
    countdownAt: announcement.countdownAt,
    order: announcement.order,
    payload,
  };
}

async function getState() {
  return prisma.announcementMode.upsert({
    where: { id: 1 },
    create: { id: 1, enabled: true },
    update: {},
  });
}

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function readName(value) {
  const name = String(value || "").trim();
  if (!name) throw new Error("Give this announcement a name.");
  return name.slice(0, 120);
}

async function getActive(_req, res) {
  try {
    const state = await getState();
    const mode = state.mode === "CUSTOM" ? "CUSTOM" : "TOURNAMENT";
    if (!state.enabled) return res.json({ enabled: false, mode, announcements: [] });

    // Tournament mode is computed on the client from the live tournament state,
    // so it carries no announcement rows.
    if (mode === "TOURNAMENT") return res.json({ enabled: true, mode, announcements: [] });

    // Custom mode shows the one chosen announcement, if it is still published.
    const announcements = await prisma.announcement.findMany({
      where: state.activeAnnouncementId
        ? { id: state.activeAnnouncementId, published: true }
        : { published: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    const payloads = await Promise.all(announcements.map(async (announcement) => {
      try {
        return await getTemplate(announcement.type).resolvePayload(announcement.content);
      } catch (error) {
        console.error(`Announcement ${announcement.id} payload could not be resolved:`, error);
        return null;
      }
    }));
    return res.json({
      enabled: true,
      mode,
      announcements: announcements.map((announcement, index) => serializePublic(announcement, payloads[index])),
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load active announcements." });
  }
}

async function list(_req, res) {
  try {
    const announcements = await prisma.announcement.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] });
    return res.json(announcements.map(serialize));
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load announcements." });
  }
}

async function create(req, res) {
  try {
    const template = getTemplate(req.body?.type);
    const tail = await prisma.announcement.aggregate({ _max: { order: true } });
    const created = await prisma.announcement.create({
      data: {
        name: readName(req.body?.name),
        type: template.type,
        content: template.validateContent(req.body?.content),
        countdownAt: normalizeCountdown(req.body?.countdownAt),
        published: req.body?.published === true,
        order: (tail._max.order ?? -1) + 1,
        createdById: req.networkMember.id,
        updatedById: req.networkMember.id,
      },
    });
    return res.status(201).json(serialize(created));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not create this announcement." });
  }
}

async function update(req, res) {
  try {
    const id = readId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid announcement id." });
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Announcement not found." });
    const template = getTemplate(req.body?.type ?? existing.type);
    const data = {
      type: template.type,
      content: template.validateContent(req.body?.content === undefined ? existing.content : req.body.content),
      updatedById: req.networkMember.id,
    };
    if (req.body?.name !== undefined) data.name = readName(req.body.name);
    if (req.body?.countdownAt !== undefined) data.countdownAt = normalizeCountdown(req.body.countdownAt);
    if (typeof req.body?.published === "boolean") data.published = req.body.published;
    return res.json(serialize(await prisma.announcement.update({ where: { id }, data })));
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not update this announcement." });
  }
}

async function remove(req, res) {
  try {
    const id = readId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid announcement id." });
    await prisma.announcement.delete({ where: { id } });
    return res.json({ deleted: true, id });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not delete this announcement." });
  }
}

async function reorder(req, res) {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) throw new Error("Provide announcement ids in their new order.");
    const normalized = ids.map(readId);
    if (normalized.some((id) => !id) || new Set(normalized).size !== normalized.length) {
      throw new Error("Announcement order must contain unique valid ids.");
    }
    const found = await prisma.announcement.count({ where: { id: { in: normalized } } });
    if (found !== normalized.length) return res.status(404).json({ message: "An announcement no longer exists." });
    await prisma.$transaction(normalized.map((id, order) => prisma.announcement.update({
      where: { id }, data: { order, updatedById: req.networkMember.id },
    })));
    return res.json({ ids: normalized });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not reorder announcements." });
  }
}

async function getSettings(_req, res) {
  try {
    const state = await getState();
    return res.json({ enabled: state.enabled, mode: state.mode || "TOURNAMENT", activeAnnouncementId: state.activeAnnouncementId ?? null, updatedAt: state.updatedAt });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Could not load announcement settings." });
  }
}

async function updateSettings(req, res) {
  try {
    const state = await getState();
    const data = { updatedById: req.networkMember.id };

    if (req.body?.enabled !== undefined) {
      if (typeof req.body.enabled !== "boolean") return res.status(400).json({ message: "Enabled must be true or false." });
      data.enabled = req.body.enabled;
    }
    if (req.body?.mode !== undefined) {
      const mode = String(req.body.mode).toUpperCase();
      if (mode !== "TOURNAMENT" && mode !== "CUSTOM") return res.status(400).json({ message: "mode must be TOURNAMENT or CUSTOM." });
      data.mode = mode;
    }
    if (req.body?.activeAnnouncementId !== undefined) {
      const raw = req.body.activeAnnouncementId;
      data.activeAnnouncementId = raw === null ? null : Number(raw);
    }

    const updated = await prisma.announcementMode.update({ where: { id: state.id }, data });
    return res.json({ enabled: updated.enabled, mode: updated.mode, activeAnnouncementId: updated.activeAnnouncementId ?? null, updatedAt: updated.updatedAt });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not update announcement settings." });
  }
}


/*
 * Image upload for custom announcements.
 *
 * The studio used to ask for a URL, which meant hosting the image somewhere
 * else first. Files land in the same media volume every other upload uses, so
 * they survive redeploys and are served by the existing /uploads route.
 */
const uploadImage = async (req, res) => {
  try {
    const mediaDirectory = path.resolve(
      process.env.MEDIA_DIR || path.join(__dirname, "..", "uploads"),
      "announcements"
    );
    const baseUrl = process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get("host")}`;

    const url = await saveUploadedImage({
      file: req.file,
      displayName: req.body?.name || "announcement",
      filePrefix: "announcement",
      targetDirectory: mediaDirectory,
      publicPrefix: `${baseUrl.replace(/\/$/, "")}/uploads/announcements`,
    });

    return res.status(201).json({ url });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Could not upload the image." });
  }
};

module.exports = { getActive, list, create, update, remove, reorder, getSettings, updateSettings, uploadImage };
