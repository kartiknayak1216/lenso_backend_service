import { prisma } from '../lib/prisma.js';

export const getUserCreditStatus = async (req, res) => {
  const { clerkUserId } = req.query;

  if (!clerkUserId) {
    return res.status(400).json({
      success: false,
      message: "Missing clerkUserId"
    });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkUserId },
    include: { credits: true }
  });

  if (!dbUser) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  if (!dbUser.credits) {
    return res.status(404).json({
      success: false,
      message: "Credits not found"
    });
  }

  const {
    is_daily,
    today_used,
    daily_credits_assigned,
    used_credit,
    monthly_credits_assigned
  } = dbUser.credits;

  const remaining = is_daily
    ? daily_credits_assigned - today_used
    : monthly_credits_assigned - used_credit;

  return res.status(200).json({
    success: remaining > 0,
    message: remaining > 0 ? "Credits available" : "No available credits",
    data: {
      creditsLeft: remaining
    }
  });
};

export const getDashboardData = async (req, res) => {
  const { clerkUserId } = req.query;

  if (!clerkUserId) {
    return res.status(400).json({
      success: false,
      message: "Missing clerkUserId"
    });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      subscription: true,
      credits: true
    }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  if (!user.subscription || !user.credits) {
    return res.status(400).json({
      success: false,
      message: "User subscription or credits not found"
    });
  }

  const credits = user.credits;
  const today = new Date();
  const dayOfMonth = today.getDate();
  const isDaily = credits.is_daily;

  const totalCredits = isDaily
    ? (credits.daily_credits_assigned ?? 0) * 30
    : credits.monthly_credits_assigned ?? 0;

  const usedThisMonth = credits.used_credit ?? 0;
  const usedToday = credits.today_used ?? 0;
  const remainingToday = isDaily
    ? (credits.daily_credits_assigned ?? 0) - usedToday
    : null;

  const remainingThisMonth = totalCredits - usedThisMonth;
  const avgPerDay = +(usedThisMonth / dayOfMonth).toFixed(1);
  const percentUsed = +((usedThisMonth / totalCredits) * 100).toFixed(1);

  return res.status(200).json({
    success: true,
    message: "Dashboard data retrieved successfully",
    data: {
      usedToday,
      remainingToday,
      usedThisMonth,
      remainingThisMonth,
      totalCredits,
      avgPerDay,
      percentUsed,
      isDaily,
      plan: user.subscription.plan,
      period: user.subscription.duration
    }
  });
};

export const getPlanOverviewData = async (req, res) => {
  const { clerkUserId } = req.query;

  if (!clerkUserId) {
    return res.status(400).json({
      success: false,
      message: "Missing clerkUserId"
    });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      subscription: true,
      credits: true
    }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  if (!user.subscription || !user.credits) {
    return res.status(400).json({
      success: false,
      message: "Subscription or credits not found"
    });
  }

  const {
    plan,
    duration,
    status,
    currentPeriodEnd,
    price
  } = user.subscription;

  const {
    daily_credits_assigned,
    monthly_credits_assigned,
    is_daily
  } = user.credits;

  const data = {
    name: plan,
    billingCycle: duration,
    price,
    isActive: status === "active",
    isDaily: is_daily,
    isMonthly: duration === "monthly",
    credits: is_daily ? daily_credits_assigned : monthly_credits_assigned,
    dailyCredits: is_daily ? daily_credits_assigned : 0,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status
  };

  return res.status(200).json({
    success: true,
    message: "Plan overview retrieved successfully",
    data
  });
};

export const getBillingHistory = async (req, res) => {
  const { clerkUserId } = req.query;

  if (!clerkUserId) {
    return res.status(400).json({
      success: false,
      message: "Missing clerkUserId"
    });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  const history = await prisma.billingHistory.findMany({
    where: { userId: user.id },
    orderBy: { paidAt: "desc" }
  });

  const formattedHistory = history.map(entry => ({
    invoiceId: entry.stripeInvoiceId,
    amount: entry.amount / 100, // assuming cents
    currency: entry.currency.toUpperCase(),
    plan: entry.planName,
    cycle: entry.billingCycle,
    status: entry.status,
    paidAt: entry.paidAt.toISOString()
  }));

  return res.status(200).json({
    success: true,
    message: "Billing history retrieved successfully",
    data: formattedHistory
  });
};

export const setupNewUser = async (req, res) => {
  try {
    const { clerkUserId, email, name } = req.body;

    if (!clerkUserId || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing required user info (clerkUserId or email)"
      });
    }

    const existing = await prisma.user.findUnique({
      where: { clerkUserId }
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "User already exists"
      });
    }

    await prisma.user.create({
      data: {
        clerkUserId,
        email,
        name: name || "Anonymous",
        credits: {
          create: {
            monthly_credits_assigned: 2,
            is_daily: false
          }
        },
        subscription: {
          create: {
            stripeSubId: `free_sub_${clerkUserId}`,
            plan: "Free Plan",
            status: "active",
            duration: "monthly",
            price: 0,
            currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1))
          }
        },
        billingHistory: {
          create: {
            stripeInvoiceId: `free_invoice_${clerkUserId}`,
            amount: 0,
            status: "paid",
            planName: "Free Plan",
            billingCycle: "monthly",
            paidAt: new Date()
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: "User created and initialized with free plan"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Something went wrong"
    });
  }
};

export const deductCredits = async (req, res) => {
  const { clerkUserId, amount } = req.body;

  if (!clerkUserId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid clerkUserId or amount"
    });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: { credits: true }
  });

  if (!user || !user.credits) {
    return res.status(404).json({
      success: false,
      message: "User or credits not found"
    });
  }

  const { credits } = user;

  const isDaily = credits.is_daily;
  const dailyLimit = credits.daily_credits_assigned ?? 0;
  const monthlyLimit = credits.monthly_credits_assigned ?? 0;

  const usedToday = credits.today_used ?? 0;
  const usedMonthly = credits.used_credit ?? 0;

  const remaining = isDaily
    ? dailyLimit - usedToday
    : monthlyLimit - usedMonthly;

  if (amount > remaining) {
    return res.status(400).json({
      success: false,
      message: "Insufficient credits",
      data: { creditsLeft: remaining }
    });
  }

  const updatedCredits = await prisma.credits.update({
    where: { userId: user.id },
    data: isDaily
      ? { today_used: { increment: amount }, used_credit: { increment: amount } }
      : { used_credit: { increment: amount } }
  });

  const newRemaining = isDaily
    ? updatedCredits.daily_credits_assigned - updatedCredits.today_used
    : updatedCredits.monthly_credits_assigned - updatedCredits.used_credit;

  return res.status(200).json({
    success: true,
    message: "Credits deducted successfully",
    data: {
      creditsLeft: newRemaining,
      usedToday: updatedCredits.today_used,
      usedCredit: updatedCredits.used_credit
    }
  });
}

// stripe pyment api pending 