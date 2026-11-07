import { Router, type IRouter } from "express";
import healthRouter from "./health";
import integrationsRouter from "./integrations";
import modelRouter from "./model";
import authDesktopRouter from "./auth-desktop";
import tasksRouter from "./tasks";
import privacyRouter from "./privacy";
import assessmentsRouter from "./assessments";
import interactiveEventsRouter from "./interactive-events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(modelRouter);
router.use(authDesktopRouter);
router.use(tasksRouter);
router.use(privacyRouter);
router.use(assessmentsRouter);
router.use(interactiveEventsRouter);

export default router;
