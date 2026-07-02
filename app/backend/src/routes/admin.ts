import express from 'express';
import tournamentRoutes from './adminTournaments';
import battleTriggerRoutes from './adminBattleTriggers';
import maintenanceRoutes from './adminMaintenance';
import analyticsRoutes from './adminAnalytics';
import usersRoutes from './adminUsers';

const router = express.Router();

// Mount sub-routers — each applies authenticateToken + requireAdmin on every route
router.use('/tournaments', tournamentRoutes);
router.use('/', maintenanceRoutes);
router.use('/', analyticsRoutes);
router.use('/', usersRoutes);
router.use('/', battleTriggerRoutes);

export default router;
