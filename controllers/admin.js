// controllers/admin.js
import express from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getAllUsers, toggleUserBlocked, updateUsername, deleteUser } from "../models/users.js";
import { createInvite, getAllInvites } from "../models/invites.js";
import { createPasswordReset, getAllPasswordResets } from "../models/passwordResets.js";
import { getSiteBanner, updateSiteBanner } from "../models/banner.js";
import { getTotalRateLimitedCount } from "../middleware/rateLimiter.js";

const adminRouter = express.Router();

// Require both authentication and admin privileges for all routes in this router
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

function calculateUserStats(users) {
    let onlineCount = 0;
    let blockedCount = 0;
    for (const u of users) {
        if (u.isOnline) {
            onlineCount = onlineCount + 1;
        }
        if (u.isBlocked) {
            blockedCount = blockedCount + 1;
        }
    }
    return {
        onlineCount: onlineCount,
        blockedCount: blockedCount
    };
}

async function getDashboardData() {
    const users = await getAllUsers();
    const invites = await getAllInvites();
    const passwordResets = await getAllPasswordResets();
    const siteBanner = await getSiteBanner();
    const rateLimitedCount = getTotalRateLimitedCount();
    const stats = calculateUserStats(users);

    return {
        users: users,
        totalUsers: users.length,
        onlineUsersCount: stats.onlineCount,
        blockedUsersCount: stats.blockedCount,
        rateLimitedCount: rateLimitedCount,
        invites: invites,
        passwordResets: passwordResets,
        banner: siteBanner
    };
}

// Admin Main Dashboard
adminRouter.get("/", async (req, res) => {
    const data = await getDashboardData();
    res.render("admin/dashboard", data);
});

// Alias for /admin/users
adminRouter.get("/users", (req, res) => {
    res.redirect("/admin");
});

// Endpoint: Update Site Announcement Banner
adminRouter.post("/banner", async (req, res) => {
    const { message, banner_type, is_active } = req.body;
    const activeBool = is_active === "on" || is_active === "true" || is_active === true;

    await updateSiteBanner(message, banner_type, activeBool);

    const data = await getDashboardData();
    let statusText = "published";
    if (!activeBool) {
        statusText = "updated (currently disabled)";
    }
    data.bannerSuccess = `Site banner ${statusText} successfully!`;
    res.render("admin/dashboard", data);
});

// Endpoint: Disable / Clear Site Banner
adminRouter.post("/banner/disable", async (req, res) => {
    const banner = await getSiteBanner();
    await updateSiteBanner(banner.message, banner.bannerType, false);

    const data = await getDashboardData();
    data.bannerSuccess = "Site announcement banner has been deactivated.";
    res.render("admin/dashboard", data);
});

// Endpoint: Change User's Username
adminRouter.post("/users/:id/change-username", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { newUsername } = req.body;

    const data = await getDashboardData();

    if (!newUsername || newUsername.trim().length < 3) {
        data.error = "Username must be at least 3 characters long.";
        return res.render("admin/dashboard", data);
    }

    let targetUser = null;
    for (const u of data.users) {
        if (u.id === targetUserId) {
            targetUser = u;
            break;
        }
    }

    if (!targetUser) {
        data.error = "User not found.";
        return res.status(404).render("admin/dashboard", data);
    }

    try {
        await updateUsername(targetUserId, newUsername.trim());
    } catch (err) {
        if (err.code === "23505") {
            data.error = `Username "${newUsername.trim()}" is already taken by another account!`;
            return res.render("admin/dashboard", data);
        }
        data.error = "Failed to update username.";
        return res.render("admin/dashboard", data);
    }

    const updatedData = await getDashboardData();
    updatedData.actionSuccess = `Successfully changed username for User #${targetUserId} to "${newUsername.trim()}".`;
    res.render("admin/dashboard", updatedData);
});

// Endpoint: Delete a User Account
adminRouter.post("/users/:id/delete", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const data = await getDashboardData();

    let targetUser = null;
    for (const u of data.users) {
        if (u.id === targetUserId) {
            targetUser = u;
            break;
        }
    }

    if (!targetUser) {
        data.error = "User not found.";
        return res.redirect("/admin");
    }

    if (targetUser.isAdmin) {
        data.error = "Administrators cannot be deleted.";
        return res.render("admin/dashboard", data);
    }

    await deleteUser(targetUserId);

    const updatedData = await getDashboardData();
    updatedData.actionSuccess = `User account "${targetUser.username}" (#${targetUserId}) has been permanently deleted.`;
    res.render("admin/dashboard", updatedData);
});

// Endpoint: Toggle Block / Unblock a User
adminRouter.post("/users/:id/toggle-block", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const data = await getDashboardData();

    let targetUser = null;
    for (const u of data.users) {
        if (u.id === targetUserId) {
            targetUser = u;
            break;
        }
    }

    if (!targetUser) {
        return res.redirect("/admin");
    }

    // Protect administrators from being blocked
    if (targetUser.isAdmin) {
        data.error = "Administrators cannot be blocked.";
        return res.render("admin/dashboard", data);
    }

    await toggleUserBlocked(targetUserId);
    res.redirect("/admin");
});

// Endpoint: Generate Password Reset Link for a specific user
adminRouter.post("/users/:id/reset-password", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const data = await getDashboardData();

    let targetUser = null;
    for (const u of data.users) {
        if (u.id === targetUserId) {
            targetUser = u;
            break;
        }
    }

    if (!targetUser) {
        data.error = "User not found.";
        return res.status(404).render("admin/dashboard", data);
    }

    const reset = await createPasswordReset(targetUser.id);
    const host = req.get("host");
    let protocol = req.protocol;
    const resetUrl = `${protocol}://${host}/reset-password?token=${reset.token}`;

    const updatedData = await getDashboardData();
    updatedData.resetSuccess = `Generated password reset link for "${targetUser.username}"!`;
    updatedData.resetUrl = resetUrl;

    res.render("admin/dashboard", updatedData);
});

// Endpoint: Manage & Issue Account Invites
adminRouter.get("/invites", async (req, res) => {
    res.redirect("/admin#invites");
});

adminRouter.post("/invites", async (req, res) => {
    const { email } = req.body;
    const data = await getDashboardData();

    if (!email || !email.includes("@")) {
        data.error = "Please enter a valid email address to issue an invite.";
        return res.render("admin/dashboard", data);
    }

    const newInvite = await createInvite(email.trim().toLowerCase(), req.user.id);

    const host = req.get("host");
    let protocol = req.protocol;
    const inviteUrl = `${protocol}://${host}/register?token=${newInvite.token}`;

    const updatedData = await getDashboardData();
    updatedData.inviteSuccess = `Invite created for ${newInvite.email}!`;
    updatedData.inviteUrl = inviteUrl;

    res.render("admin/dashboard", updatedData);
});

export default adminRouter;
