const router = require("express").Router();
const controller = require("../controllers/applicationController");
const validate = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const schemas = require("../validators/applicationValidator");
router.post("/register", validate(schemas.register), controller.register);
router.get("/me", authenticate, controller.me);
router.patch(
  "/me",
  authenticate,
  validate(schemas.update),
  controller.updateMe,
);
router.get(
  "/me/statistics",
  authenticate,
  require("../controllers/reportController").statistics,
);
module.exports = router;
