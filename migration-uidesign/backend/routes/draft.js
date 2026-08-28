const express = require("express");
const router = express.Router();
const draftController = require("../controllers/draft");
const authMiddleware = require("../middlewares/authMiddleware");
const optionalAuth = require("../middlewares/optionalAuth");

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
	"/:id/yield-first-pick",
	authMiddleware,
	handle((req) => draftController.yieldFirstPick(req.params.id, req.user))
);
router.post(
	"/:id/pick-map-type",
	authMiddleware,
	handle((req) => draftController.pickMapType(req.params.id, req.body, req.user))
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
router.patch(
	"/:id/end-game",
	authMiddleware,
	handle((req) => draftController.endGame(req.params.id, req.user))
);
router.get(
	"/by-match/:matchId/share",
	authMiddleware,
	handle((req) => draftController.getDraftShareInfo(req.params.matchId, req.user))
);
		// Polling clients use this endpoint. With the background worker disabled,
		// it also applies elapsed draft timeouts on demand.
		router.get("/:id/state", optionalAuth, handle((req) => draftController.getDraftStateReadOnly(req.params.id, req)));
	router.get(
		"/by-match/:matchId",
		optionalAuth,
		handle((req) => draftController.getDraftByMatchId(req.params.matchId, req))
	);

module.exports = router;
