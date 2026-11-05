import express from "express";
import bcrypt from "bcrypt";
import { createUser, findUser, updateUserPassword, getUserPasswordHash } from "../models/users.js";
import { createSession, deleteSession } from "../models/sessions.js";
import { requireAuth } from "../middleware/auth.js";
import { loadUserProfile } from "../middleware/content.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { findValidInvite, markInviteUsed } from "../models/invites.js";
import { findValidPasswordReset, markPasswordResetUsed } from "../models/passwordResets.js";
import { removeActiveUser } from "../middleware/activity.js";

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
    const { token, username, password, confirmPassword, first_name, last_name } = req.body;
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

    if (!first_name || first_name.trim().length === 0) {
        return res.render("users/register", {
            inviteOnly: false,
            token: token,
            email: invite.email,
            username: username,
            first_name: first_name,
            last_name: last_name,
            error: "First name is required!"
        });
    }

    const cleanUsername = (username || "").trim();
    if (!cleanUsername || cleanUsername.length < 3) {
        return res.render("users/register", {
            inviteOnly: false,
            token: token,
            email: invite.email,
            username: username,
            first_name: first_name,
            last_name: last_name,
            error: "Username must be at least 3 characters long!"
        });
    }

    if (password != confirmPassword) {
        return res.render("users/register", {
            inviteOnly: false,
            token: token,
            email: invite.email,
            username: username,
            first_name: first_name,
            last_name: last_name,
            error: "Passwords do not match!"
        });
    }
    if (!password || password.length < 12) {
        return res.render("users/register", {
            inviteOnly: false,
            token: token,
            email: invite.email,
            username: username,
            first_name: first_name,
            last_name: last_name,
            error: "Password must be at least 12 characters long!"
        });
    }

    let userId;
    try {
        userId = await createUser(cleanUsername, invite.email, password, first_name, last_name);
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
            first_name: first_name,
            last_name: last_name,
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
    if (user.is_blocked) {
        return res.render("users/login", {
            error: "This account has been suspended by an administrator."
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
    if (req.user && req.user.id) {
        removeActiveUser(req.user.id);
    }
    await deleteSession(req.session);
    res.clearCookie("session_id");
    res.redirect("/login");
});

// Password Reset consumption routes
usersRouter.get("/reset-password", async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.render("users/reset-password", {
            error: "A valid password reset token is required."
        });
    }

    const reset = await findValidPasswordReset(token);
    if (!reset) {
        return res.render("users/reset-password", {
            error: "This password reset link is invalid or has expired."
        });
    }

    res.render("users/reset-password", {
        token: token,
        username: reset.username,
        email: reset.email
    });
});

usersRouter.post("/reset-password", authLimiter, async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!token) {
        return res.render("users/reset-password", {
            error: "A valid password reset token is required."
        });
    }

    const reset = await findValidPasswordReset(token);
    if (!reset) {
        return res.render("users/reset-password", {
            error: "This password reset link is invalid or has expired."
        });
    }

    if (password != confirmPassword) {
        return res.render("users/reset-password", {
            token: token,
            username: reset.username,
            email: reset.email,
            error: "Passwords do not match!"
        });
    }

    if (!password || password.length < 12) {
        return res.render("users/reset-password", {
            token: token,
            username: reset.username,
            email: reset.email,
            error: "Password must be at least 12 characters long!"
        });
    }

    await updateUserPassword(reset.user_id, password);
    await markPasswordResetUsed(token);

    res.render("users/login", {
        success: "Your password has been reset successfully! Please log in with your new password."
    });
});

usersRouter.get("/account", requireAuth, (req, res) => {
    res.redirect(`/users/${req.user.id}`);
});

usersRouter.get("/profile", requireAuth, (req, res) => {
    res.redirect(`/users/${req.user.id}`);
});

usersRouter.get("/change-password", requireAuth, (req, res) => {
    res.render("users/change-password");
});

usersRouter.post("/change-password", requireAuth, authLimiter, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.render("users/change-password", {
            error: "All password fields are required."
        });
    }

    const currentHash = await getUserPasswordHash(req.user.id);
    if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
        return res.render("users/change-password", {
            error: "Your current password is incorrect."
        });
    }

    if (newPassword !== confirmPassword) {
        return res.render("users/change-password", {
            error: "New passwords do not match."
        });
    }

    if (newPassword.length < 12) {
        return res.render("users/change-password", {
            error: "New password must be at least 12 characters long."
        });
    }

    if (currentPassword === newPassword) {
        return res.render("users/change-password", {
            error: "New password must be different from your current password."
        });
    }

    await updateUserPassword(req.user.id, newPassword);

    res.render("users/change-password", {
        success: "Your password has been changed successfully!"
    });
});

usersRouter.all("/users/change-password", requireAuth, (req, res) => {
    res.redirect("/change-password");
});

usersRouter.get("/users/:id", loadUserProfile, (req, res) => {
    if (req.query.updated === "password") {
        res.locals.passwordSuccess = "Your password has been changed successfully!";
    }
    res.render("users/show");
});

export default usersRouter;
