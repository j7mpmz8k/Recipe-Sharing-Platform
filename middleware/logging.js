// middleware/logging.js
import { getClientIp } from "./activity.js";

const MAX_LOGS = 1000;
const recentLogs = [];

const STATUS_DESCRIPTIONS = {
    200: "200 OK - Request succeeded",
    201: "201 Created - Resource created successfully",
    204: "204 No Content - Action succeeded with empty response",
    301: "301 Moved Permanently - Resource has permanently moved",
    302: "302 Found - Temporary redirect to another URL",
    304: "304 Not Modified - Cached copy is fresh",
    400: "400 Bad Request - Malformed request syntax or invalid input",
    401: "401 Unauthorized - Authentication required to access",
    403: "403 Forbidden - Access denied / insufficient permissions",
    404: "404 Not Found - Requested endpoint does not exist",
    405: "405 Method Not Allowed - HTTP method not supported on this endpoint",
    422: "422 Unprocessable Entity - Validation error on submitted data",
    429: "429 Too Many Requests - Rate limit exceeded (client throttled)",
    500: "500 Internal Server Error - Unexpected server-side failure",
    502: "502 Bad Gateway - Reverse proxy received invalid upstream response",
    503: "503 Service Unavailable - Server temporarily down for maintenance or overloaded",
    504: "504 Gateway Timeout - Upstream server timed out"
};

export function getStatusHint(code, defaultMsg) {
    if (STATUS_DESCRIPTIONS[code]) return STATUS_DESCRIPTIONS[code];
    if (defaultMsg) return `${code} ${defaultMsg}`;
    if (code >= 500) return `${code} Server Error`;
    if (code >= 400) return `${code} Client Error`;
    if (code >= 300) return `${code} Redirect`;
    if (code >= 200) return `${code} Success`;
    return `${code} Status Code`;
}

export function getRecentLogs() {
    return recentLogs;
}

export function loggingMiddleware(req, res, next) {
    // Skip automated background health checks and polling requests to keep logs clean
    if (
        req.path === "/health" ||
        req.path === "/api/online-count" ||
        req.path === "/admin/api/logs" ||
        req.path === "/admin/api/dashboard"
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
            statusHint: getStatusHint(res.statusCode, res.statusMessage),
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
