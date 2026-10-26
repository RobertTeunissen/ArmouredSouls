import express from 'express';
import tournamentRoutes from './adminTournaments';
import battleTriggerRoutes from './adminBattleTriggers';
import maintenanceRoutes from './adminMaintenance';
import analyticsRoutes from './adminAnalytics';
import usersRoutes from './adminUsers';
import schedulerRoutes from './adminScheduler';
import battlesRoutes from './adminBattles';

const router = express.Router();

// Mount sub-routers — each applies authenticateToken + requireAdmin on every route
router.use('/tournaments', tournamentRoutes);
router.use('/battles', battlesRoutes);
router.use('/', maintenanceRoutes);
router.use('/', analyticsRoutes);
router.use('/', usersRoutes);
router.use('/', battleTriggerRoutes);
router.use('/', schedulerRoutes);

export default router;
