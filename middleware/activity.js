// middleware/activity.js
import crypto from "crypto";
import { updateUserLastActive } from "../models/users.js";
import { getSiteBanner } from "../models/banner.js";

// In-memory map of active visitor identifiers -> timestamp of last request
const activeVisitors = new Map();

// Throttle database writes so we only update last_active_at in DB once per minute per user
const lastDbUpdateByUser = new Map();

// Consider active if a request was made in the last 3 minutes
const ACTIVE_WINDOW_MS = 3 * 60 * 1000;

// Clean up expired visitors every minute
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of activeVisitors.entries()) {
        if ((now - timestamp) > ACTIVE_WINDOW_MS) {
            activeVisitors.delete(key);
        }
    }
}, 60 * 1000);

if (cleanupInterval.unref) {
    cleanupInterval.unref();
}

export function getOnlineCount() {
    const now = Date.now();
    let count = 0;
    for (const timestamp of activeVisitors.values()) {
        if ((now - timestamp) <= ACTIVE_WINDOW_MS) {
            count = count + 1;
        }
    }
    if (count === 0) {
        return 1;
    }
    return count;
}

export function removeActiveUser(userId) {
    if (userId) {
        activeVisitors.delete("user:" + userId);
    }
}

export async function trackActivity(req, res, next) {
    const now = Date.now();

    // Use a unique visitor cookie for guest browsers to accurately distinguish different devices/tabs
    let visitorId = req.cookies.vid;
    if (!visitorId) {
        visitorId = crypto.randomUUID();
        res.cookie("vid", visitorId, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
    }

    if (req.user && req.user.id) {
        const userKey = "user:" + req.user.id;
        activeVisitors.set(userKey, now);

        // Remove anonymous guest entry for this visitor so they are not double-counted
        if (visitorId) {
            activeVisitors.delete("guest:" + visitorId);
        }

        // Throttle database update to at most once per 60 seconds
        let lastDbTime = lastDbUpdateByUser.get(req.user.id);
        if (!lastDbTime || (now - lastDbTime) > 60 * 1000) {
            lastDbUpdateByUser.set(req.user.id, now);
            updateUserLastActive(req.user.id).catch(err => {
                console.error("Failed to update last_active_at for user:", req.user.id, err);
            });
        }
    } else {
        const guestKey = "guest:" + (visitorId || req.ip || req.socket.remoteAddress || "unknown");
        activeVisitors.set(guestKey, now);
    }

    // Make online count and site banner available to all Handlebars templates
    res.locals.onlineCount = getOnlineCount();
    res.locals.siteBanner = await getSiteBanner();

    next();
}
