// middleware/logging.js

export function loggingMiddleware(req, res, next) {
    // Skip automated background health checks and polling requests to keep logs clean
    if (req.path === "/health" || req.path === "/api/online-count") {
        return next();
    }

    const start = Date.now();
    const timestamp = new Date().toLocaleString("sv-SE");

    res.on("finish", () => {
        let ip = req.headers["cf-connecting-ip"] || req.ip || req.socket?.remoteAddress || "-";
        if (typeof ip === "string" && ip.startsWith("::ffff:")) {
            ip = ip.replace("::ffff:", "");
        }
        if (ip === "::1") {
            ip = "127.0.0.1";
        }

        const userTag = req.user?.username ? `@${req.user.username}` : "guest";
        const duration = Date.now() - start;

        console.log(`[${timestamp}] [${ip}] [${userTag}] ${req.method} ${req.originalUrl || req.path} ${res.statusCode} (${duration}ms)`);
    });

    next();
}
