// middleware/activity.js
import { updateUserLastActive } from "../models/users.js";
import { getSiteBanner } from "../models/banner.js";

// In-memory map of active visitor identifiers -> timestamp of last request
const activeVisitors = new Map();

// Throttle database writes so we only update last_active_at in DB once per minute per user
const lastDbUpdateByUser = new Map();

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired visitors every 2 minutes
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of activeVisitors.entries()) {
        if ((now - timestamp) > ACTIVE_WINDOW_MS) {
            activeVisitors.delete(key);
        }
    }
}, 2 * 60 * 1000);

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

export async function trackActivity(req, res, next) {
    const now = Date.now();
    let visitorKey = "guest:" + (req.ip || req.socket.remoteAddress || "unknown");

    if (req.user && req.user.id) {
        visitorKey = "user:" + req.user.id;

        // Throttle database update to at most once per 60 seconds
        let lastDbTime = lastDbUpdateByUser.get(req.user.id);
        if (!lastDbTime || (now - lastDbTime) > 60 * 1000) {
            lastDbUpdateByUser.set(req.user.id, now);
            updateUserLastActive(req.user.id).catch(err => {
                console.error("Failed to update last_active_at for user:", req.user.id, err);
            });
        }
    }

    activeVisitors.set(visitorKey, now);

    // Make online count and site banner available to all Handlebars templates
    res.locals.onlineCount = getOnlineCount();
    res.locals.siteBanner = await getSiteBanner();

    next();
}
