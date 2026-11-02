import { Router, type IRouter } from "express";
import healthRouter from "./health";
import integrationsRouter from "./integrations";
import modelRouter from "./model";
import authDesktopRouter from "./auth-desktop";
import tasksRouter from "./tasks";
import privacyRouter from "./privacy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(modelRouter);
router.use(authDesktopRouter);
router.use(tasksRouter);
router.use(privacyRouter);

export default router;
