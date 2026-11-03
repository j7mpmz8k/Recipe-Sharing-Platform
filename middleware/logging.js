// Logging middleware
export function loggingMiddleware (req, res, next) {
    const timestamp = new Date().toLocaleString('sv-SE');
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
};
