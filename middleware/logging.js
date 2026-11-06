// middleware/logging.js
import { getClientIp } from "./activity.js";

const MAX_LOGS = 100;
const recentLogs = [];

export function getRecentLogs() {
    return recentLogs;
}

export function loggingMiddleware(req, res, next) {
    // Skip automated background health checks and polling requests to keep logs clean
    if (
        req.path === "/health" ||
        req.path === "/api/online-count" ||
        req.path === "/admin/api/logs"
    ) {
        return next();
    }

    const start = Date.now();
    const timestamp = new Date().toLocaleString("sv-SE");

    res.on("finish", () => {
        const ip = getClientIp(req);
        const userTag = req.user?.username ? `@${req.user.username}` : "guest";
        const duration = Date.now() - start;

        // Terminal console output
        console.log(`[${timestamp}] [${ip}] [${userTag}] ${req.method} ${req.originalUrl || req.path} ${res.statusCode} (${duration}ms)`);

        // In-memory UI buffer
        const timeFormatted = new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });

        const entry = {
            id: Date.now() + Math.random(),
            time: timeFormatted,
            ip: ip,
            user: req.user?.username ? `@${req.user.username}` : "guest",
            isUser: !!req.user,
            method: req.method,
            path: req.originalUrl || req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            isSuccess: res.statusCode >= 200 && res.statusCode < 300,
            isRedirect: res.statusCode >= 300 && res.statusCode < 400,
            isClientError: res.statusCode >= 400 && res.statusCode < 500,
            isServerError: res.statusCode >= 500
        };

        recentLogs.unshift(entry);
        if (recentLogs.length > MAX_LOGS) {
            recentLogs.pop();
        }
    });

    next();
}
