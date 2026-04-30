const express = require("express");
const router = express.Router();
const draftController = require("../controllers/draft");
const authMiddleware = require("../middlewares/authMiddleware");

const handle = (fn) => async (req, res) => {
	try {
		const result = await fn(req, res);
		res.json(result);
	} catch (error) {
		const message = error?.message || "Draft request failed.";
		const lower = String(message).toLowerCase();
		const status =
			lower.includes("not found")
				? 404
				: lower.includes("unauthorized") || lower.includes("forbidden")
				? 403
				: lower.includes("must") || lower.includes("invalid") || lower.includes("required")
				? 400
				: 500;
		res.status(status).json({ message });
	}
};

router.post(
	"/:matchId",
	authMiddleware,
	handle((req) => draftController.createDraft(req.params.matchId, req.user))
);
router.patch(
	"/:id/start-map-picking",
	authMiddleware,
	handle((req) => draftController.startMapPicking(req.params.id, req.user))
);
router.post(
	"/:id/pick-map",
	authMiddleware,
	handle((req) => draftController.pickMap(req.params.id, req.body, req.user))
);
router.patch(
	"/:id/start-ban",
	authMiddleware,
	handle((req) => draftController.startBan(req.params.id, req.user))
);
router.post(
	"/:id/ban-hero",
	authMiddleware,
	handle((req) => draftController.banHero(req.params.id, req.body, req.user))
);
router.patch(
	"/:id/end-map",
	authMiddleware,
	handle((req) => draftController.endMap(req.params.id, req.user))
);
		// Polling clients should use the read-only state to avoid accidental writes
			router.get("/:id/state", handle((req) => draftController.getDraftStateReadOnly(req.params.id, req)));
	router.get(
		"/by-match/:matchId",
		handle((req) => draftController.getDraftByMatchId(req.params.matchId, req))
	);

module.exports = router;
