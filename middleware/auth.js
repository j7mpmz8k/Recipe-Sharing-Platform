import { deleteSession } from "../models/sessions.js";
import { loadUser } from "../models/users.js";

// Configurable Admin User IDs (Hardcoded)
// To grant admin access to another user, add their user ID to this array (e.g. [1, 2]):
export const ADMIN_USER_IDS = [1];

export function isAdminUser(userId) {
    if (!userId) {
        return false;
    }
    return ADMIN_USER_IDS.includes(Number(userId));
}

export function requireAuth(req, res, next) {
    if (req.session) {
        next();
    } else {
        res.redirect('/login');
    }
}

export function requireAdmin(req, res, next) {
    if (req.user && isAdminUser(req.user.id)) {
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
        } else if (user.is_blocked) {
            req.user = res.locals.user = null;
            req.session = null;
            await deleteSession(session_id);
            res.clearCookie("session_id");
            return res.status(403).render("error", {
                statusCode: 403,
                statusMessage: "Account Suspended",
                message: "Your account has been suspended by an administrator. Please contact contact@recipes.jcardon.me for assistance."
            });
        } else {
            user.isAdmin = isAdminUser(user.id);
            req.user = res.locals.user = user;
            req.session = session_id;
        }
    }
    next();
}
