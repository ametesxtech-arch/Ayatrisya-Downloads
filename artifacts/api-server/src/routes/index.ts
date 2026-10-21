import { Router, type IRouter } from "express";
import healthRouter from "./health";
import integrationsRouter from "./integrations";
import modelRouter from "./model";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(modelRouter);

export default router;
