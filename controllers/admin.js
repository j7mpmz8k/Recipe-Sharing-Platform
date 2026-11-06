// controllers/admin.js
import express from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getAllUsers, toggleUserBlocked, updateUsername, updateUserProfile, deleteUser } from "../models/users.js";
import { createInvite, getAllInvites, deleteInvite } from "../models/invites.js";
import { createPasswordReset, getAllPasswordResets } from "../models/passwordResets.js";
import { getSiteBanner, updateSiteBanner } from "../models/banner.js";
import { getTotalRateLimitedCount } from "../middleware/rateLimiter.js";
import { getActiveGuests, getOnlineCount } from "../middleware/activity.js";
import { getRecentLogs } from "../middleware/logging.js";

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

async function getDashboardData(req) {
    const users = await getAllUsers();
    const invites = await getAllInvites();
    const passwordResets = await getAllPasswordResets();
    const siteBanner = await getSiteBanner();
    const rateLimitedCount = getTotalRateLimitedCount();
    const stats = calculateUserStats(users);
    const activeGuests = getActiveGuests();
    const recentLogs = getRecentLogs();

    const baseUrl = req ? `${req.protocol}://${req.get("host")}` : "";

    return {
        users: users,
        totalUsers: users.length,
        onlineCount: getOnlineCount(),
        onlineUsersCount: stats.onlineCount,
        blockedUsersCount: stats.blockedCount,
        rateLimitedCount: rateLimitedCount,
        invites: invites,
        passwordResets: passwordResets,
        banner: siteBanner,
        baseUrl: baseUrl,
        activeGuests: activeGuests,
        activeGuestsCount: activeGuests.length,
        recentLogs: recentLogs
    };
}

// Endpoint: Live data polling endpoint for Admin Dashboard
adminRouter.get("/api/dashboard", async (req, res) => {
    try {
        const data = await getDashboardData(req);
        res.json({
            success: true,
            onlineCount: data.onlineCount,
            totalUsers: data.totalUsers,
            onlineUsersCount: data.onlineUsersCount,
            blockedUsersCount: data.blockedUsersCount,
            activeGuestsCount: data.activeGuestsCount,
            rateLimitedCount: data.rateLimitedCount,
            totalInvites: data.invites.length,
            users: data.users,
            guests: data.activeGuests,
            logs: data.recentLogs,
            invites: data.invites
        });
    } catch (err) {
        console.error("Dashboard API error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint: Real-time logs and active guests polling endpoint for Admin Dashboard
adminRouter.get("/api/logs", (req, res) => {
    res.json({
        logs: getRecentLogs(),
        guests: getActiveGuests()
    });
});

// Admin Main Dashboard
adminRouter.get("/", async (req, res) => {
    const data = await getDashboardData(req);
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

    const data = await getDashboardData(req);
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

    const data = await getDashboardData(req);
    data.bannerSuccess = "Site announcement banner has been deactivated.";
    res.render("admin/dashboard", data);
});

// Endpoint: Edit Member Profile (First Name, Last Name, Username)
adminRouter.post("/users/:id/edit", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { username, first_name, last_name } = req.body;

    const data = await getDashboardData(req);

    const cleanUsername = (username || "").trim();
    const cleanFirstName = (first_name || "").trim();
    const cleanLastName = (last_name || "").trim();

    if (!cleanFirstName) {
        data.error = "First name is required.";
        return res.render("admin/dashboard", data);
    }

    if (!cleanUsername || cleanUsername.length < 3) {
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
        await updateUserProfile(targetUserId, cleanUsername, cleanFirstName, cleanLastName);
    } catch (err) {
        if (err.code === "23505") {
            data.error = `Username "${cleanUsername}" is already taken by another account!`;
            return res.render("admin/dashboard", data);
        }
        data.error = "Failed to update member profile.";
        return res.render("admin/dashboard", data);
    }

    const updatedData = await getDashboardData(req);
    let displayName = cleanFirstName;
    if (cleanLastName) {
        displayName = displayName + " " + cleanLastName;
    }
    updatedData.actionSuccess = `Successfully updated User #${targetUserId}: ${displayName} (@${cleanUsername}).`;
    res.render("admin/dashboard", updatedData);
});

// Endpoint: Change User's Username
adminRouter.post("/users/:id/change-username", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { newUsername } = req.body;

    const data = await getDashboardData(req);

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

    const updatedData = await getDashboardData(req);
    updatedData.actionSuccess = `Successfully changed username for User #${targetUserId} to "${newUsername.trim()}".`;
    res.render("admin/dashboard", updatedData);
});

// Endpoint: Delete a User Account
adminRouter.post("/users/:id/delete", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const data = await getDashboardData(req);

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

    const updatedData = await getDashboardData(req);
    updatedData.actionSuccess = `User account "${targetUser.username}" (#${targetUserId}) has been permanently deleted.`;
    res.render("admin/dashboard", updatedData);
});

// Endpoint: Toggle Block / Unblock a User
adminRouter.post("/users/:id/toggle-block", async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const data = await getDashboardData(req);

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
    const data = await getDashboardData(req);

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

    const updatedData = await getDashboardData(req);
    updatedData.resetSuccess = `Generated password reset link for "${targetUser.username}"!`;
    updatedData.resetUrl = resetUrl;

    res.render("admin/dashboard", updatedData);
});

// Endpoint: Manage & Issue Account Invites
adminRouter.get("/invites", async (req, res) => {
    res.redirect("/admin#invites");
});

adminRouter.post("/invites", async (req, res) => {
    try {
        const { name } = req.body;
        const cleanName = (name || "").trim();

        const newInvite = await createInvite(cleanName, req.user.id);

        const host = req.get("host");
        const protocol = req.protocol;
        const inviteUrl = `${protocol}://${host}/register?token=${newInvite.token}`;

        if (req.xhr || req.headers["content-type"] === "application/json" || req.headers.accept?.includes("application/json")) {
            const expiresDate = new Date(newInvite.expires_at);
            return res.json({
                success: true,
                inviteUrl: inviteUrl,
                invite: {
                    id: newInvite.id,
                    token: newInvite.token,
                    name: newInvite.name || "Unnamed invite",
                    createdBy: req.user.username,
                    status: "Active",
                    isActive: true,
                    isAccepted: false,
                    isExpired: false,
                    isUsable: true,
                    acceptedBy: "",
                    acceptedAt: null,
                    createdAt: new Date(newInvite.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    }),
                    expiresAt: expiresDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    })
                }
            });
        }

        const updatedData = await getDashboardData(req);
        updatedData.inviteSuccess = newInvite.name ? `Invite created for "${newInvite.name}"!` : "Invite link created!";
        updatedData.inviteUrl = inviteUrl;

        res.render("admin/dashboard", updatedData);
    } catch (err) {
        console.error("Error creating invite:", err);
        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(500).json({ success: false, error: "Failed to generate invite" });
        }
        res.redirect("/admin#invites");
    }
});

// Endpoint: Delete an Account Invite Link
adminRouter.post("/invites/:id/delete", async (req, res) => {
    try {
        const inviteId = parseInt(req.params.id, 10);
        if (!isNaN(inviteId)) {
            await deleteInvite(inviteId);
        }
        if (req.xhr || req.headers.accept?.includes("application/json") || req.headers["content-type"] === "application/json") {
            return res.json({ success: true, id: inviteId });
        }
        res.redirect("/admin#invites");
    } catch (err) {
        console.error("Error deleting invite:", err);
        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.redirect("/admin#invites");
    }
});

export default adminRouter;
