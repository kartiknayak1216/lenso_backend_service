import express from 'express';
import {
  getUserCreditStatus,
  getDashboardData,
  getPlanOverviewData,
  getBillingHistory,
  setupNewUser,
  deductCredits
} from '../controllers/userController.js';

const router = express.Router();

// Get the user's credit status
router.get('/credit-status', getUserCreditStatus);

// Get the user's dashboard data
router.get('/dashboard', getDashboardData);

// Get the user's plan overview
router.get('/plan-overview', getPlanOverviewData);

// Get the user's billing history
router.get('/billing-history', getBillingHistory);

// Setup a new user (for first-time registration)
router.post('/setup', setupNewUser);

// Deduct credits from the user's balance
router.post('/deduct-credits', deductCredits);

export default router;
