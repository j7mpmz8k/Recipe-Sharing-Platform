import query from "../db/connection.js";
import bcrypt from "bcrypt";

export async function createUser(username, email, plainPassword) {
    hashedPassword = await bcrypt.hash(plainPassword, 10);
    await query(`
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
    `, [username, email, hashedPassword]);
    return new User(username, email, hashedPassword);
}
export async function findUser(username) {
    let rows = await query(`
        SELECT username, email, hashed_password
        FROM users
        WHERE username = $1
    `, [username]);
    return new User(rows[0].username, rows[0].email, rows[0].hashed_password);
}
export async function loadUser(sessionId) {
    let rows = await query(`
        SELECT u.username, u.email, u.hashed_password
        FROM users u
        JOIN session s on u.user_id = s.user_id
        WHERE session_id = $1
    `, [sessionId]);
    return new User(rows[0].username, rows[0].email, rows[0].hashed_password);
}


export class User {
    constructor (username, email, passwordHash) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
    }
}

