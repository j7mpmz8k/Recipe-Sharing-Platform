import crypto from "crypto";
import query from "../db/connection.js";

export async function createSession(userId) {
    const sessionId = crypto.randomUUID();
    await query(`
        INSERT INTO sessions (session_id, user_id)
        VALUES ($1, $2);
    `, [sessionId, userId]);
    return sessionId;
}

export async function deleteSession(sessionId) {
    await query(`
        DELETE FROM sessions
        WHERE session_id = $1    
    `,[sessionId]);
}
