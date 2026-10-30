export function requireAuth(req, res, next) {
    if (req.session) {
        next();
    } else {
        res.redirect('/login');
    }
}

export function loadSession(req, res, next) {
    const session_id = req.cookies.session_token;
    if (!session_id) {//TODO test if safe to remove if check
        req.session = null;
        next();
    } else {
        req.session = session_id;
        next();
    }
}
