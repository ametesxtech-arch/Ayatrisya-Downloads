import { Router, type IRouter } from "express";
import healthRouter from "./health";
import integrationsRouter from "./integrations";
import modelRouter from "./model";
import authDesktopRouter from "./auth-desktop";
import authCanvasRouter from "./auth-canvas";
import tasksRouter from "./tasks";
import privacyRouter from "./privacy";
import assessmentsRouter from "./assessments";
import interactiveEventsRouter from "./interactive-events";
import presentationsRouter from "./presentations";
import uploadsRouter from "./uploads";
import voiceRouter from "./voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(modelRouter);
router.use(authDesktopRouter);
router.use(authCanvasRouter);
router.use(tasksRouter);
router.use(privacyRouter);
router.use(assessmentsRouter);
router.use(interactiveEventsRouter);
router.use(presentationsRouter);
router.use(uploadsRouter);
router.use(voiceRouter);

export default router;
