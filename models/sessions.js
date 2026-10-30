import crypto from "crypto";

export async function createSession(userId) {
    const sessionId = crypto.randomUUID();
    await query(`
        INSERT INTO sessions (session_id, user_id)
        VALUES ($1, $2);
    `, [sessionId, userId]);
    return sessionId;
}
export async function deleteSession(sessionId) {
    
}
