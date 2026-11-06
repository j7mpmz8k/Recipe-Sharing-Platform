// middleware/rateLimiter.js

export function createRateLimiter(options) {
    let windowMs = 15 * 60 * 1000; // default 15 minutes
    let max = 100; // default 100 requests per window
    let message = "Too many requests from this IP, please try again later.";
    let statusCode = 429;

    if (options) {
        if (options.windowMs) {
            windowMs = options.windowMs;
        }
        if (options.max) {
            max = options.max;
        }
        if (options.message) {
            message = options.message;
        }
        if (options.statusCode) {
            statusCode = options.statusCode;
        }
    }

    // In-memory store: Map of ip -> array of request timestamps
    const ipHits = new Map();

    // Clean up expired timestamps periodically (every 5 minutes)
    const interval = setInterval(() => {
        const now = Date.now();
        for (const [ip, timestamps] of ipHits.entries()) {
            const validTimestamps = timestamps.filter(ts => (now - ts) < windowMs);
            if (validTimestamps.length === 0) {
                ipHits.delete(ip);
            } else {
                ipHits.set(ip, validTimestamps);
            }
        }
    }, 5 * 60 * 1000);

    // Prevent interval from keeping the process alive when shutting down
    if (interval.unref) {
        interval.unref();
    }

    return function rateLimiter(req, res, next) {
        let clientIp = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();

        let timestamps = ipHits.get(clientIp);
        if (!timestamps) {
            timestamps = [];
        }

        // Keep only timestamps within the current window
        timestamps = timestamps.filter(ts => (now - ts) < windowMs);

        if (timestamps.length >= max) {
            const oldest = timestamps[0];
            const retryAfterSeconds = Math.ceil(((oldest + windowMs) - now) / 1000);
            res.setHeader("Retry-After", retryAfterSeconds);
            res.setHeader("X-RateLimit-Limit", max);
            res.setHeader("X-RateLimit-Remaining", 0);

            // If the request accepts JSON, return JSON; otherwise render error view or send plain text
            const acceptsJson = req.headers.accept && req.headers.accept.includes("application/json");
            if (acceptsJson) {
                return res.status(statusCode).json({ error: message });
            }

            return res.status(statusCode).render("error", {
                statusCode: statusCode,
                statusMessage: "Too Many Requests",
                message: message
            });
        }

        timestamps.push(now);
        ipHits.set(clientIp, timestamps);

        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", max - timestamps.length);

        next();
    };

    rateLimiter.getBlockedCount = function() {
        const now = Date.now();
        let blocked = 0;
        for (const timestamps of ipHits.values()) {
            const active = timestamps.filter(ts => (now - ts) < windowMs);
            if (active.length >= max) {
                blocked = blocked + 1;
            }
        }
        return blocked;
    };

    return rateLimiter;
}

// Strict limiter for sensitive auth routes (10 attempts per 15 minutes)
export const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many authentication attempts. Please wait 15 minutes before trying again."
});

// General limiter for public endpoints (2000 requests per 15 minutes)
export const generalLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: "Too many requests. Please slow down and try again in a few minutes."
});

export function getTotalRateLimitedCount() {
    let count = 0;
    if (authLimiter && authLimiter.getBlockedCount) {
        count = count + authLimiter.getBlockedCount();
    }
    if (generalLimiter && generalLimiter.getBlockedCount) {
        count = count + generalLimiter.getBlockedCount();
    }
    return count;
}
