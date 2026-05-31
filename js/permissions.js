(function (global) {
  "use strict";

  function normalizeStartPoolPlan(plan) {
    return ({
      free: "free_starter",
      single: "single_event",
      commissioner: "commissioner",
      premium: "premium_community",
      free_starter: "free_starter",
      single_event: "single_event",
      premium_community: "premium_community"
    })[plan] || "";
  }

  var PLAN_PERMISSIONS = {
    free_starter: {
      maxPlayers: 5,
      allowFighterPicks: true,
      allowMethodPicks: true,
      allowRoundPicks: true,
      allowOverUnder: true,
      allowLockOfTheNight: true,
      allowUnderdogBonus: true,
      allowCustomScoring: true,
      allowEditableBanners: true,
      allowLiveChat: true,
      allowAllTimeLeaderboard: false,
      allowAdminScoringEdits: true,
      allowFastestFinishTiebreaker: true
    },
    single_event: {
      maxPlayers: Infinity,
      allowFighterPicks: true,
      allowMethodPicks: true,
      allowRoundPicks: true,
      allowOverUnder: true,
      allowLockOfTheNight: true,
      allowUnderdogBonus: true,
      allowCustomScoring: true,
      allowEditableBanners: true,
      allowLiveChat: true,
      allowAllTimeLeaderboard: false,
      allowAdminScoringEdits: true,
      allowFastestFinishTiebreaker: true
    },
    commissioner: {
      maxPlayers: Infinity,
      allowFighterPicks: true,
      allowMethodPicks: true,
      allowRoundPicks: true,
      allowOverUnder: true,
      allowLockOfTheNight: true,
      allowUnderdogBonus: true,
      allowCustomScoring: true,
      allowEditableBanners: true,
      allowLiveChat: true,
      allowAllTimeLeaderboard: true,
      allowAdminScoringEdits: true,
      allowSavedScoringPresets: true,
      allowSavedHostSettings: true,
      allowFastestFinishTiebreaker: true
    },
    premium_community: {
      maxPlayers: Infinity,
      allowFighterPicks: true,
      allowMethodPicks: true,
      allowRoundPicks: true,
      allowOverUnder: true,
      allowLockOfTheNight: true,
      allowUnderdogBonus: true,
      allowCustomScoring: true,
      allowEditableBanners: true,
      allowLiveChat: true,
      allowAllTimeLeaderboard: true,
      allowAdminScoringEdits: true,
      allowSavedScoringPresets: true,
      allowSavedHostSettings: true,
      allowFastestFinishTiebreaker: true
    }
  };

  function getPoolPlanType(pool) {
    pool = pool || {};
    var raw = pool.planType || pool.plan || pool.tier || pool.pricingPlan || "";
    return normalizeStartPoolPlan(raw);
  }

  function getPlanPermissions(pool) {
    var type = typeof pool === "string" ? normalizeStartPoolPlan(pool) : getPoolPlanType(pool);
    return PLAN_PERMISSIONS[type] || PLAN_PERMISSIONS.commissioner;
  }

  function isPoolFeatureEnabled(pool, featureName) {
    var permissions = getPlanPermissions(pool);
    return permissions[featureName] !== false;
  }

  function currentPoolPermissions() {
    if (global.embeddedUfc328Preview) return PLAN_PERMISSIONS.commissioner;
    return getPlanPermissions(global.currentPoolMeta || {});
  }

  function currentPoolFeatureEnabled(featureName) {
    if (global.embeddedUfc328Preview) return true;
    return currentPoolPermissions()[featureName] !== false;
  }

  global.normalizeStartPoolPlan = normalizeStartPoolPlan;
  global.PLAN_PERMISSIONS = PLAN_PERMISSIONS;
  global.getPoolPlanType = getPoolPlanType;
  global.getPlanPermissions = getPlanPermissions;
  global.isPoolFeatureEnabled = isPoolFeatureEnabled;
  global.currentPoolPermissions = currentPoolPermissions;
  global.currentPoolFeatureEnabled = currentPoolFeatureEnabled;
})(window);
