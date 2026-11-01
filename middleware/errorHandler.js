export function notFoundHandler(req, res, next) {
    res.status(404).render("not-found");
}

export function errorHandler(err, req, res, next) {
    if (err.status === 403) {
        return res.status(403).render("unauthorized");
    }
    console.error("Server Error:", err);
    next(err);
}
