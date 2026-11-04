import express from "express";
import bcrypt from "bcrypt";
import { createUser, findUser } from "../models/users.js";
import { createSession, deleteSession } from "../models/sessions.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { loadUserProfile } from "../middleware/content.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { createInvite, findValidInvite, markInviteUsed, getAllInvites } from "../models/invites.js";

const usersRouter = express.Router();

usersRouter.get("/register", async (req, res) => {
    if (req.user) {
        return res.redirect("/");
    }
    const token = req.query.token;
    if (!token) {
        return res.render("users/register", {
            inviteOnly: true,
            contactEmail: "recipes.online872@passmail.com"
        });
    }

    const invite = await findValidInvite(token);
    if (!invite) {
        return res.render("users/register", {
            inviteOnly: true,
            contactEmail: "recipes.online872@passmail.com",
            error: "This invitation link is invalid or has expired. Please request a new invite."
        });
    }

    res.render("users/register", {
        inviteOnly: false,
        token: token,
        email: invite.email
    });
});

usersRouter.post("/register", authLimiter, async (req, res) => {
    const { token, username, password, confirmPassword } = req.body;
    if (!token) {
        return res.render("users/register", {
            inviteOnly: true,
            contactEmail: "recipes.online872@passmail.com",
            error: "Registration requires a valid invite link."
        });
    }

    const invite = await findValidInvite(token);
    if (!invite) {
        return res.render("users/register", {
            inviteOnly: true,
            contactEmail: "recipes.online872@passmail.com",
            error: "This invitation link is invalid or has expired."
        });
    }

    if (password != confirmPassword) {
        return res.render("users/register", {
            inviteOnly: false,
            token: token,
            email: invite.email,
            username: username,
            error: "Passwords do not match!"
        });
    }
    if (!password || password.length < 8) {
        return res.render("users/register", {
            inviteOnly: false,
            token: token,
            email: invite.email,
            username: username,
            error: "Password must be at least 8 characters long!"
        });
    }

    let userId;
    try {
        userId = await createUser(username, invite.email, password);
    } catch (err) {
        let errorMessage = "An error occurred while creating your account.";
        if (err.code === "23505") {
            errorMessage = "A user with that username or email already exists!";
        }
        return res.render("users/register", {
            inviteOnly: false,
            token: token,
            email: invite.email,
            username: username,
            error: errorMessage
        });
    }

    // Invalidate invite token upon successful registration
    await markInviteUsed(token);

    const sessionId = await createSession(userId);
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.redirect("/");
});

usersRouter.get("/login", (req, res) => {
    if (req.user) {
        return res.redirect("/");
    }
    res.render("users/login");
});

usersRouter.post("/login", authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.render("users/login", {
            error: "Username and password are required!"
        });
    }
    const user = await findUser(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.render("users/login", {
            error: 'No user found with that password!',
        });
    }
    const sessionId = await createSession(user.id);
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.redirect("/");
});

usersRouter.post("/logout", requireAuth, async (req, res) => {
    await deleteSession(req.session);
    res.clearCookie("session_id");
    res.redirect("/login");
});

// Admin invite management routes (Admin user id = 1)
usersRouter.get("/admin/invites", requireAuth, requireAdmin, async (req, res) => {
    const invites = await getAllInvites();
    res.render("admin/invites", {
        invites: invites
    });
});

usersRouter.post("/admin/invites", requireAuth, requireAdmin, async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
        const invites = await getAllInvites();
        return res.render("admin/invites", {
            invites: invites,
            error: "Please enter a valid email address."
        });
    }

    const newInvite = await createInvite(email.trim().toLowerCase(), req.user.id);
    const invites = await getAllInvites();

    const host = req.get("host");
    let protocol = req.protocol;
    const inviteUrl = `${protocol}://${host}/register?token=${newInvite.token}`;

    res.render("admin/invites", {
        invites: invites,
        success: `Invite created successfully for ${newInvite.email}!`,
        inviteUrl: inviteUrl
    });
});

usersRouter.get("/users/:id", loadUserProfile, (req, res) => {
    res.render("users/show");
});

export default usersRouter;
