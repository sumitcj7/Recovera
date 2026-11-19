const router = require("express").Router();
const authenticate = require("../middlewares/authenticate");
const validateQuery = require("../middlewares/validateQuery");
const query = require("../validators/reportQueryValidator");
const controller = require("../controllers/reportController");
router.use(authenticate);
router.get("/", validateQuery(query), controller.list);
router.get("/:id", controller.get);
module.exports = router;
