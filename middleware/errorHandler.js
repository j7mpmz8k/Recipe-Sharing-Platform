export function notFoundHandler(req, res, next) {
    res.status(404).render("not-found");
}

export function errorHandler(err, req, res, next) {
    console.error("Server Error:", err);
    if (err.status === 403) {
        res.status(403).render("unauthorized", {
            message: err.message
        });
    } else {
        res.status(err.status || 500).render("not-found", {
            title: "Kitchen Catastrophe (500)",
            message: err.message
        });
    }
}
