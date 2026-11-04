import query from "../db/connection.js";
import bcrypt from "bcrypt";
import { getUserRecipes, getFavoriteRecipes } from "./recipes.js";
import { isAdminUser } from "../middleware/auth.js";

export async function createUser(username, email, plainPassword, firstName = "", lastName = "") {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const fName = (firstName || "").trim();
    const lName = (lastName || "").trim();
    const row = (await query(`
        INSERT INTO users (username, email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
    `, [username, email, hashedPassword, fName, lName]))[0];
    return row.id;
}
export async function findUser(username) {
    const user = (await query(`
        SELECT id, username, email, password_hash, first_name, last_name, is_blocked
        FROM users
        WHERE username = $1;
    `, [username]))[0];
    return user || null;
}
export async function loadUser(sessionId) {
    const user = (await query(`
        SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_blocked
        FROM users u
        JOIN sessions s on u.id = s.user_id
        WHERE session_id = $1;
    `, [sessionId]))[0];
    if (!user) {
        return null;
    }
    user.displayName = user.first_name || user.username;
    return user;
}

export async function getUserData(userId, viewerId = 0) {
    const user = (await query(`
        SELECT id, username, email, first_name, last_name, created_at
        FROM users
        WHERE id = $1;
    `, [userId]))[0];
    if (!user) return null;
    user.displayName = user.first_name || user.username;
    let fullName = user.first_name || "";
    if (user.last_name) {
        fullName = (fullName + " " + user.last_name).trim();
    }
    user.fullName = fullName || user.username;
    user.createdAt = new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    user.recipes = await getUserRecipes(userId, viewerId);
    user.favoriteRecipes = await getFavoriteRecipes(userId);
    return user || null;
}

export async function getAllUsers() {
    const rows = await query(`
        SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.created_at, u.last_active_at, u.is_blocked,
               COUNT(r.id) AS recipe_count
        FROM users u
        LEFT JOIN recipes r ON u.id = r.user_id
        GROUP BY u.id
        ORDER BY u.id ASC;
    `);

    const now = Date.now();
    return rows.map(u => {
        let isOnline = false;
        let lastOnlineText = "Never";

        if (u.last_active_at) {
            const lastActiveTime = new Date(u.last_active_at).getTime();
            const diffMs = now - lastActiveTime;
            // Online if active within last 5 minutes (300,000 ms)
            if (diffMs <= 5 * 60 * 1000) {
                isOnline = true;
                lastOnlineText = "Online now";
            } else if (diffMs < 60 * 60 * 1000) {
                const mins = Math.floor(diffMs / (60 * 1000));
                lastOnlineText = `${mins}m ago`;
            } else if (diffMs < 24 * 60 * 60 * 1000) {
                const hours = Math.floor(diffMs / (60 * 60 * 1000));
                lastOnlineText = `${hours}h ago`;
            } else {
                lastOnlineText = new Date(u.last_active_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                });
            }
        }

        let fullName = u.first_name || "";
        if (u.last_name) {
            fullName = (fullName + " " + u.last_name).trim();
        }

        return {
            id: u.id,
            username: u.username,
            firstName: u.first_name || "",
            lastName: u.last_name || "",
            fullName: fullName || u.username,
            displayName: u.first_name || u.username,
            email: u.email,
            recipeCount: Number(u.recipe_count) || 0,
            isAdmin: isAdminUser(u.id),
            isBlocked: Boolean(u.is_blocked),
            isOnline: isOnline,
            lastOnline: lastOnlineText,
            createdAt: new Date(u.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            })
        };
    });
}

export async function toggleUserBlocked(userId) {
    await query(`
        UPDATE users
        SET is_blocked = NOT is_blocked
        WHERE id = $1;
    `, [userId]);
}

export async function updateUserLastActive(userId) {
    await query(`
        UPDATE users
        SET last_active_at = NOW()
        WHERE id = $1;
    `, [userId]);
}

export async function updateUserPassword(userId, plainPassword) {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await query(`
        UPDATE users
        SET password_hash = $2
        WHERE id = $1;
    `, [userId, hashedPassword]);
}

export async function updateUsername(userId, newUsername) {
    await query(`
        UPDATE users
        SET username = $2
        WHERE id = $1;
    `, [userId, newUsername.trim()]);
}

export async function deleteUser(userId) {
    await query(`
        DELETE FROM users
        WHERE id = $1;
    `, [userId]);
}



