
import { SubscriptionTier, UserSubscription } from '../types';

const SUBSCRIPTION_KEY = 'my-muse-ai-subscription';

const getCurrentDateString = () => new Date().toISOString().split('T')[0];

// Limits per day
export const TIER_LIMITS = {
    [SubscriptionTier.FREE]: 0, // Expired state, no generation allowed
    [SubscriptionTier.TRIAL]: 10,
    [SubscriptionTier.SILVER]: 15,
    [SubscriptionTier.GOLD]: 100,
    [SubscriptionTier.DIAMOND]: 500,
};

// Prices in USD
export const TIER_PRICES = {
    [SubscriptionTier.TRIAL]: 0, // Now Free
    [SubscriptionTier.SILVER]: 5,
    [SubscriptionTier.GOLD]: 15,
    [SubscriptionTier.DIAMOND]: 49.99,
};

export const getSubscription = (username: string): UserSubscription => {
    const key = `${SUBSCRIPTION_KEY}-${username}`;
    const stored = localStorage.getItem(key);
    
    // NEW USER: Automatically start with 3-Day Free Trial
    if (!stored) {
        const now = Date.now();
        const newSub: UserSubscription = {
            tier: SubscriptionTier.TRIAL,
            startDate: now,
            expiryDate: now + (3 * 24 * 60 * 60 * 1000), // 3 Days from now
            dailyUsage: 0,
            lastUsageDate: getCurrentDateString(),
            hasUsedTrial: true, // Mark as used so they can't reactivate it later
        };
        saveSubscription(username, newSub);
        return newSub;
    }

    const sub: UserSubscription = JSON.parse(stored);
    
    // Check daily reset (reset usage count if it's a new day)
    const today = getCurrentDateString();
    if (sub.lastUsageDate !== today) {
        sub.dailyUsage = 0;
        sub.lastUsageDate = today;
        saveSubscription(username, sub); // Save the reset
    }

    // Check expiry (For Trial)
    // If expired, downgrade to FREE (which has 0 limit)
    if (sub.expiryDate && Date.now() > sub.expiryDate) {
        if (sub.tier !== SubscriptionTier.FREE) {
            sub.tier = SubscriptionTier.FREE;
            sub.expiryDate = null;
            saveSubscription(username, sub);
        }
    }

    return sub;
};

export const saveSubscription = (username: string, sub: UserSubscription) => {
    const key = `${SUBSCRIPTION_KEY}-${username}`;
    localStorage.setItem(key, JSON.stringify(sub));
};

export const incrementUsage = (username: string): boolean => {
    const sub = getSubscription(username);
    const limit = TIER_LIMITS[sub.tier];

    if (sub.dailyUsage >= limit) {
        return false;
    }

    sub.dailyUsage += 1;
    saveSubscription(username, sub);
    return true;
};

export const checkCanGenerate = (username: string): { allowed: boolean; remaining: number; limit: number; tier: SubscriptionTier } => {
    const sub = getSubscription(username);
    const limit = TIER_LIMITS[sub.tier];
    const remaining = Math.max(0, limit - sub.dailyUsage);
    
    // Free tier (Expired Trial) cannot generate
    if (sub.tier === SubscriptionTier.FREE) {
        return { allowed: false, remaining: 0, limit, tier: sub.tier };
    }

    return { allowed: remaining > 0, remaining, limit, tier: sub.tier };
};

export const upgradeSubscription = (username: string, tier: SubscriptionTier) => {
    const sub = getSubscription(username);
    const now = Date.now();

    sub.tier = tier;
    sub.startDate = now;
    sub.dailyUsage = 0; // Reset usage on upgrade
    
    // Only TRIAL has expiry, others are monthly (simulated as infinite here or logic can be added)
    if (tier === SubscriptionTier.TRIAL) {
        // Logic specific if we ever allowed manual trial selection, 
        // but currently it's auto-assigned on creation.
        sub.expiryDate = now + (3 * 24 * 60 * 60 * 1000); 
        sub.hasUsedTrial = true;
    } else {
        sub.expiryDate = null; // Monthly assumed active until cancelled
    }

    saveSubscription(username, sub);
};
