import crypto from "crypto";

export async function createSession() {
    const sessionId = crypto.randomUUID();
    return sessionId;
}
export async function deleteSession(sessionId) {
    
}
