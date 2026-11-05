export function notFoundHandler(req, res, next) {
    res.status(404).render("not-found");
}

export function errorHandler(err, req, res, next) {
    switch (err.status) {
        case 403:
            return res.status(403).render("unauthorized");
        case 404:
            return res.status(404).render("not-found");
        default:
            console.error("Server Error:", err);
            return next(err);
    }
}
