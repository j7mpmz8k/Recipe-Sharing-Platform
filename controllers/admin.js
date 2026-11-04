// controllers/admin.js
import express from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getAllUsers } from "../models/users.js";
import { createInvite, getAllInvites } from "../models/invites.js";
import { createPasswordReset, getAllPasswordResets } from "../models/passwordResets.js";

const adminRouter = express.Router();

// Require both authentication and admin privileges (user.id === 1) for all routes in this router
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

// Admin Main Dashboard - Users, Online Users, Last Online, Password Resets, and Invites
adminRouter.get("/", async (req, res) => {
    const users = await getAllUsers();
    const invites = await getAllInvites();
    const passwordResets = await getAllPasswordResets();

    let onlineCount = 0;
    for (const u of users) {
        if (u.isOnline) {
            onlineCount = onlineCount + 1;
        }
    }

    res.render("admin/dashboard", {
        users: users,
        totalUsers: users.length,
        onlineUsersCount: onlineCount,
        invites: invites,
        passwordResets: passwordResets
    });
});

// Alias for /admin/users
adminRouter.get("/users", (req, res) => {
    res.redirect("/admin");
});

// Endpoint: Generate Password Reset Link for a specific user
adminRouter.post("/users/:id/reset-password", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const users = await getAllUsers();
    let targetUser = null;
    for (const u of users) {
        if (u.id === targetUserId) {
            targetUser = u;
            break;
        }
    }

    if (!targetUser) {
        const invites = await getAllInvites();
        const passwordResets = await getAllPasswordResets();
        return res.status(404).render("admin/dashboard", {
            users: users,
            invites: invites,
            passwordResets: passwordResets,
            error: "User not found."
        });
    }

    const reset = await createPasswordReset(targetUser.id);
    const host = req.get("host");
    let protocol = req.protocol;
    const resetUrl = `${protocol}://${host}/reset-password?token=${reset.token}`;

    const invites = await getAllInvites();
    const passwordResets = await getAllPasswordResets();

    let onlineCount = 0;
    for (const u of users) {
        if (u.isOnline) {
            onlineCount = onlineCount + 1;
        }
    }

    res.render("admin/dashboard", {
        users: users,
        totalUsers: users.length,
        onlineUsersCount: onlineCount,
        invites: invites,
        passwordResets: passwordResets,
        resetSuccess: `Generated password reset link for "${targetUser.username}"!`,
        resetUrl: resetUrl
    });
});

// Endpoint: Manage & Issue Account Invites
adminRouter.get("/invites", async (req, res) => {
    res.redirect("/admin#invites");
});

adminRouter.post("/invites", async (req, res) => {
    const { email } = req.body;
    const users = await getAllUsers();
    const invites = await getAllInvites();
    const passwordResets = await getAllPasswordResets();

    let onlineCount = 0;
    for (const u of users) {
        if (u.isOnline) {
            onlineCount = onlineCount + 1;
        }
    }

    if (!email || !email.includes("@")) {
        return res.render("admin/dashboard", {
            users: users,
            totalUsers: users.length,
            onlineUsersCount: onlineCount,
            invites: invites,
            passwordResets: passwordResets,
            error: "Please enter a valid email address to issue an invite."
        });
    }

    const newInvite = await createInvite(email.trim().toLowerCase(), req.user.id);
    const updatedInvites = await getAllInvites();

    const host = req.get("host");
    let protocol = req.protocol;
    const inviteUrl = `${protocol}://${host}/register?token=${newInvite.token}`;

    res.render("admin/dashboard", {
        users: users,
        totalUsers: users.length,
        onlineUsersCount: onlineCount,
        invites: updatedInvites,
        passwordResets: passwordResets,
        inviteSuccess: `Invite created for ${newInvite.email}!`,
        inviteUrl: inviteUrl
    });
});

export default adminRouter;
