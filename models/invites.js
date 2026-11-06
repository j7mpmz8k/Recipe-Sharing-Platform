// models/invites.js
import crypto from "crypto";
import query from "../db/connection.js";

export async function createInvite(name, adminId) {
    const token = crypto.randomBytes(24).toString("hex");
    // Token expires in 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const cleanName = (name || "").trim();

    const rows = await query(`
        INSERT INTO invites (token, name, created_by, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, token, name, created_by, expires_at, used, created_at;
    `, [token, cleanName, adminId, expiresAt]);

    return rows[0];
}

export async function findValidInvite(token) {
    if (!token) {
        return null;
    }
    const rows = await query(`
        SELECT id, token, name, created_by, expires_at, used, used_by, created_at
        FROM invites
        WHERE token = $1 AND used = FALSE AND expires_at > NOW();
    `, [token]);

    if (rows.length > 0) {
        return rows[0];
    }
    return null;
}

export async function markInviteUsed(token, userId = null) {
    await query(`
        UPDATE invites
        SET used = TRUE, used_by = $2
        WHERE token = $1;
    `, [token, userId]);
}

export async function deleteInvite(id) {
    await query(`
        DELETE FROM invites
        WHERE id = $1;
    `, [id]);
}

export async function getAllInvites() {
    const rows = await query(`
        SELECT i.id, i.token, i.name, i.expires_at, i.used, i.used_by, i.created_at,
               u.username AS created_by_username,
               u2.username AS used_by_username, u2.first_name AS used_by_first_name, u2.last_name AS used_by_last_name
        FROM invites i
        JOIN users u ON i.created_by = u.id
        LEFT JOIN users u2 ON i.used_by = u2.id
        ORDER BY i.id DESC;
    `);

    const now = new Date();
    return rows.map(invite => {
        const expiresDate = new Date(invite.expires_at);
        const isExpired = expiresDate <= now;
        let status = "Active";
        if (invite.used) {
            status = "Accepted";
        } else if (isExpired) {
            status = "Expired";
        }

        let acceptedByText = "";
        if (invite.used_by_username) {
            let fullName = invite.used_by_first_name || "";
            if (invite.used_by_last_name) {
                fullName = (fullName + " " + invite.used_by_last_name).trim();
            }
            acceptedByText = fullName ? `${fullName} (@${invite.used_by_username})` : `@${invite.used_by_username}`;
        }

        return {
            id: invite.id,
            token: invite.token,
            name: invite.name || "Unnamed invite",
            createdBy: invite.created_by_username,
            status: status,
            isActive: status === "Active",
            isAccepted: status === "Accepted",
            isExpired: status === "Expired",
            isUsable: !invite.used && !isExpired,
            acceptedBy: acceptedByText,
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
