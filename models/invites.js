// models/invites.js
import crypto from "crypto";
import query from "../db/connection.js";

export async function createInvite(email, adminId) {
    const token = crypto.randomBytes(24).toString("hex");
    // Token expires in 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const rows = await query(`
        INSERT INTO invites (token, email, created_by, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, token, email, created_by, expires_at, used, created_at;
    `, [token, email, adminId, expiresAt]);

    return rows[0];
}

export async function findValidInvite(token) {
    if (!token) {
        return null;
    }
    const rows = await query(`
        SELECT id, token, email, created_by, expires_at, used, created_at
        FROM invites
        WHERE token = $1 AND used = FALSE AND expires_at > NOW();
    `, [token]);

    if (rows.length > 0) {
        return rows[0];
    }
    return null;
}

export async function markInviteUsed(token) {
    await query(`
        UPDATE invites
        SET used = TRUE
        WHERE token = $1;
    `, [token]);
}

export async function getAllInvites() {
    const rows = await query(`
        SELECT i.id, i.token, i.email, i.expires_at, i.used, i.created_at, u.username AS created_by_username
        FROM invites i
        JOIN users u ON i.created_by = u.id
        ORDER BY i.id DESC;
    `);

    const now = new Date();
    return rows.map(invite => {
        const expiresDate = new Date(invite.expires_at);
        const isExpired = expiresDate <= now;
        let status = "Active";
        if (invite.used) {
            status = "Used";
        } else if (isExpired) {
            status = "Expired";
        }

        return {
            id: invite.id,
            token: invite.token,
            email: invite.email,
            createdBy: invite.created_by_username,
            status: status,
            isActive: status === "Active",
            isUsed: status === "Used",
            isExpired: status === "Expired",
            isUsable: !invite.used && !isExpired,
            createdAt: new Date(invite.created_at).toLocaleDateString("en-US", {
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
