import { deleteSession } from "../models/sessions.js";
import { loadUser } from "../models/users.js";

export function requireAuth(req, res, next) {
    if (req.session) {
        next();
    } else {
        res.redirect('/login');
    }
}

export function requireAdmin(req, res, next) {
    if (req.user && req.user.id === 1) {
        next();
    } else {
        res.status(403).render("error", {
            statusCode: 403,
            statusMessage: "Forbidden",
            message: "You must be an administrator to access this page."
        });
    }
}

export async function loadSession(req, res, next) {
    const session_id = req.cookies.session_id;
    if (!session_id) {
        req.session = null;
        req.user = res.locals.user = null;
    } else {
        const user = await loadUser(session_id);
        if (!user) {
            req.user = res.locals.user = null;
            req.session = null;
            await deleteSession(session_id);
            res.clearCookie("session_id");
        } else {
            user.isAdmin = (user.id === 1);
            req.user = res.locals.user = user;
            req.session = session_id;
        }
    }
    next();
}
