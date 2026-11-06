// middleware/activity.js
import { updateUserLastActive } from "../models/users.js";
import { getSiteBanner } from "../models/banner.js";

// Extracts clean real client IP from Cloudflare, reverse proxy, or socket
export function getClientIp(req) {
    let ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || req.socket?.remoteAddress || "127.0.0.1";
    if (typeof ip === "string") {
        if (ip.includes(",")) {
            ip = ip.split(",")[0].trim();
        }
        if (ip.startsWith("::ffff:")) {
            ip = ip.replace("::ffff:", "");
        }
        if (ip === "::1") {
            ip = "127.0.0.1";
        }
    }
    return ip;
}

export function simplifyDevice(ua = "") {
    const lower = ua.toLowerCase();
    if (lower.includes("iphone") || lower.includes("ipad")) return "Apple iOS";
    if (lower.includes("android")) return "Android";
    if (lower.includes("macintosh") || lower.includes("mac os")) return "macOS";
    if (lower.includes("windows")) return "Windows PC";
    if (lower.includes("linux")) return "Linux";
    return "Web Browser";
}

// In-memory map of active visitor identifiers -> visitor metadata
const activeVisitors = new Map();

// Throttle database writes so we only update last_active_at in DB once per minute per user
const lastDbUpdateByUser = new Map();

// Consider active if a request was made in the last 3 minutes
const ACTIVE_WINDOW_MS = 3 * 60 * 1000;

// Clean up expired visitors every minute
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, v] of activeVisitors.entries()) {
        if ((now - v.lastSeen) > ACTIVE_WINDOW_MS) {
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
    for (const v of activeVisitors.values()) {
        if ((now - v.lastSeen) <= ACTIVE_WINDOW_MS) {
            count = count + 1;
        }
    }
    if (count === 0) {
        return 1;
    }
    return count;
}

export function getActiveGuests() {
    const now = Date.now();
    const guests = [];
    for (const v of activeVisitors.values()) {
        if (v.type === "guest" && (now - v.lastSeen) <= ACTIVE_WINDOW_MS) {
            const secondsAgo = Math.max(0, Math.round((now - v.lastSeen) / 1000));
            let timeAgo = "Just now";
            if (secondsAgo >= 60) {
                timeAgo = `${Math.floor(secondsAgo / 60)}m ago`;
            } else if (secondsAgo > 5) {
                timeAgo = `${secondsAgo}s ago`;
            }

            guests.push({
                ip: v.ip,
                lastSeen: timeAgo,
                lastPath: v.lastPath || "/",
                device: simplifyDevice(v.userAgent)
            });
        }
    }
    return guests;
}

export function removeActiveUser(userId) {
    if (userId) {
        activeVisitors.delete("user:" + userId);
    }
}

export async function trackActivity(req, res, next) {
    const userAgent = req.get("user-agent") || "";

    // Ignore healthchecks, CLI tools (like curl), and polling endpoints from active visitor tracking
    if (
        req.path === "/health" ||
        req.path === "/api/online-count" ||
        req.path === "/admin/api/logs" ||
        userAgent.startsWith("curl/") ||
        userAgent.toLowerCase().includes("healthcheck")
    ) {
        return next();
    }

    const now = Date.now();
    const ip = getClientIp(req);

    if (req.user && req.user.id) {
        const userKey = "user:" + req.user.id;
        activeVisitors.set(userKey, {
            type: "user",
            userId: req.user.id,
            username: req.user.username,
            firstName: req.user.first_name,
            ip: ip,
            lastSeen: now,
            lastPath: req.originalUrl || req.path
        });

        // Remove anonymous guest entry for this IP so logged-in users aren't counted twice
        activeVisitors.delete("guest:" + ip);

        // Throttle database update to at most once per 60 seconds
        let lastDbTime = lastDbUpdateByUser.get(req.user.id);
        if (!lastDbTime || (now - lastDbTime) > 60 * 1000) {
            lastDbUpdateByUser.set(req.user.id, now);
            updateUserLastActive(req.user.id).catch(err => {
                console.error("Failed to update last_active_at for user:", req.user.id, err);
            });
        }
    } else {
        const guestKey = "guest:" + ip;
        activeVisitors.set(guestKey, {
            type: "guest",
            ip: ip,
            lastSeen: now,
            lastPath: req.originalUrl || req.path,
            userAgent: userAgent
        });
    }

    // Make online count and site banner available to all Handlebars templates
    res.locals.onlineCount = getOnlineCount();
    res.locals.siteBanner = await getSiteBanner();

    next();
}
