import query from "../db/connection.js";
import bcrypt from "bcrypt";

export async function createUser(username, email, plainPassword) {
    let hashedPassword = await bcrypt.hash(plainPassword, 10);
    let userId = await query(`
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING user_id;
    `, [username, email, hashedPassword]);
    return userId;
}
export async function findUser(username) {
    let rows = await query(`
        SELECT username, email, password_hash
        FROM users
        WHERE username = $1;
    `, [username]);
    if (rows.length == 0) {
        return null;
    }
    return new User(rows[0].username, rows[0].email, rows[0].password_hash);
}
export async function loadUser(sessionId) {
    let rows = await query(`
        SELECT u.username, u.email, u.password_hash
        FROM users u
        JOIN session s on u.user_id = s.user_id
        WHERE session_id = $1;
    `, [sessionId]);
    return new User(rows[0].username, rows[0].email, rows[0].password_hash);
}


export class User {
    constructor (username, email, passwordHash) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
    }
}

