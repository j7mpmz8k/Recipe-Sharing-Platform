import query from "../db/connection.js";
import bcrypt from "bcrypt";
import { getUserRecipes, getFavoriteRecipes } from "./recipes.js";

export async function createUser(username, email, plainPassword) {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const row = (await query(`
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id;
    `, [username, email, hashedPassword]))[0];
    return row.id;
}
export async function findUser(username) {
    const user = (await query(`
        SELECT id, password_hash
        FROM users
        WHERE username = $1;
    `, [username]))[0];
    return user || null;
}
export async function loadUser(sessionId) {
    const user = (await query(`
        SELECT u.id, u.username, u.email
        FROM users u
        JOIN sessions s on u.id = s.user_id
        WHERE session_id = $1;
    `, [sessionId]))[0];
    return user || null;
}

export async function getUserData(userId, viewerId = 0) {
    const user = (await query(`
        SELECT username, email, created_at
        FROM users
        WHERE id = $1;
    `, [userId]))[0];
    if (!user) return null;
    user.createdAt = new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    user.recipes = await getUserRecipes(userId, viewerId);
    user.favoriteRecipes = await getFavoriteRecipes(userId);
    return user || null;
}

