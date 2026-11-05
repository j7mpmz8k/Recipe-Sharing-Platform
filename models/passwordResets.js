// models/passwordResets.js
import crypto from "crypto";
import query from "../db/connection.js";

export async function createPasswordReset(userId) {
    const token = crypto.randomBytes(24).toString("hex");
    // Token expires in 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const rows = await query(`
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, token, expires_at, used, created_at;
    `, [userId, token, expiresAt]);

    return rows[0];
}

export async function findValidPasswordReset(token) {
    if (!token) {
        return null;
    }
    const rows = await query(`
        SELECT pr.id, pr.user_id, pr.token, pr.expires_at, pr.used, pr.created_at,
               u.username, u.email
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.token = $1 AND pr.used = FALSE AND pr.expires_at > NOW();
    `, [token]);

    if (rows.length > 0) {
        return rows[0];
    }
    return null;
}

export async function markPasswordResetUsed(token) {
    await query(`
        UPDATE password_resets
        SET used = TRUE
        WHERE token = $1;
    `, [token]);
}

export async function getAllPasswordResets() {
    const rows = await query(`
        SELECT pr.id, pr.user_id, pr.token, pr.expires_at, pr.used, pr.created_at,
               u.username, u.email
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        ORDER BY pr.id DESC;
    `);

    const now = new Date();
    return rows.map(reset => {
        const expiresDate = new Date(reset.expires_at);
        const isExpired = expiresDate <= now;
        let status = "Active";
        if (reset.used) {
            status = "Used";
        } else if (isExpired) {
            status = "Expired";
        }

        return {
            id: reset.id,
            userId: reset.user_id,
            username: reset.username,
            email: reset.email,
            token: reset.token,
            status: status,
            isActive: status === "Active",
            isUsed: status === "Used",
            isExpired: status === "Expired",
            isUsable: !reset.used && !isExpired,
            createdAt: new Date(reset.created_at).toLocaleDateString("en-US", {
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
        };
    });
}
