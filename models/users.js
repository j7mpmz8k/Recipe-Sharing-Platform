import query from "../db/connection.js";
import bcrypt from "bcrypt";

export async function createUser(username, email, plainPassword) {
    let hashedPassword = await bcrypt.hash(plainPassword, 10);
    let rows = await query(`
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id;
    `, [username, email, hashedPassword]);
    return rows[0].id;
}
export async function findUser(username) {
    let user = await query(`
        SELECT id, password_hash
        FROM users
        WHERE username = $1;
    `, [username]);
    if (user.length == 0) {
        return null;
    }
    return user[0];
}
export async function loadUser(sessionId) {
    let user = await query(`
        SELECT u.username, u.email
        FROM users u
        JOIN sessions s on u.id = s.user_id
        WHERE session_id = $1;
    `, [sessionId]);
    if (user.length == 0) {
        return null;
    }
    return user[0];
}

