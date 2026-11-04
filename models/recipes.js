import query from "../db/connection.js";
import { getRatings } from "./ratings.js";

export async function createRecipe(title = "", description = "", ingredients = "", instructions = "", prepTime = 0, cooktime = 0, servings = 0, userId = 0, username = "") {
    const r = (await query(`
        INSERT INTO recipes (title, description, ingredients, instructions, prep_time, cook_time, servings, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
        `, [title, description, ingredients, instructions, prepTime || 0, cooktime || 0, servings || 0, userId]))[0];
    return r.id;
}

export async function getAllRecipes(userId = 0, querySearch = "") {
    const rows = (await query(`
            SELECT r.*, u.username, 
                COUNT(f.id) AS fav_count,
                EXISTS(
                    SELECT 1 FROM favorites fav
                    WHERE fav.recipe_id = r.id AND fav.user_id = $1
                ) AS is_favorite
            FROM recipes r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN favorites f ON r.id = f.recipe_id
            WHERE u.username ILIKE '%' || $2 || '%'
                OR r.title ILIKE '%' || $2 || '%'
                OR r.description ILIKE '%' || $2 || '%'
                OR r.ingredients ILIKE '%' || $2 || '%'
                OR r.instructions ILIKE '%' || $2 || '%'
            GROUP BY r.id, u.username
            ORDER BY r.id DESC;
        `, [userId, querySearch]));
    const ratings = await getRatings(userId);
    return rows.map(r => new Recipe(r, ratings)) || [];
}
export async function getUserRecipes(userId, viewerId = 0) {
    const rows = (await query(`
        SELECT r.*, u.username, 
            COUNT(f.id) AS fav_count,
            EXISTS(
                SELECT 1 FROM favorites fav
                WHERE fav.recipe_id = r.id AND fav.user_id = $2
            ) AS is_favorite
        FROM recipes r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN favorites f ON r.id = f.recipe_id
        WHERE r.user_id = $1
        GROUP BY r.id, u.username
        ORDER BY r.id DESC;
    `, [userId, viewerId]));
    const ratings = await getRatings(viewerId);
    return rows.map(r => new Recipe(r, ratings)) || [];
}

export async function getFeaturedRecipes(userId = 0) {
    const rows = (await query(`
        SELECT r.*, u.username, 
            COUNT(f.id) AS fav_count,
            EXISTS(
                SELECT 1 FROM favorites fav
                WHERE fav.recipe_id = r.id AND fav.user_id = $1
            ) AS is_favorite
        FROM recipes r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN favorites f ON r.id = f.recipe_id
        GROUP BY r.id, u.username
        ORDER BY fav_count DESC, r.id DESC
        LIMIT 6;
    `, [userId]));
    const ratings = await getRatings(userId);
    return rows.map(r => new Recipe(r, ratings)) || [];
}

export async function getFavoriteRecipes(userId) {
    const rows = (await query(`
        SELECT r.*, u.username, 
            COUNT(all_f.id) AS fav_count, 
            true AS is_favorite
        FROM favorites fav
        JOIN recipes r ON fav.recipe_id = r.id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN favorites all_f ON r.id = all_f.recipe_id
        WHERE fav.user_id = $1
        GROUP BY r.id, u.username
        ORDER BY r.id DESC;
    `, [userId]));
    const ratings = await getRatings(userId);
    return rows.map(r => new Recipe(r, ratings)) || [];
}

class Recipe {
    constructor(row, ratings = null) {
        this.recipeId = row.id;
        this.title = row.title;
        this.description = row.description;
        this.ingredients = row.ingredients;
        if (this.ingredients) {//used only for rendering with checkboxes
            this.ingredientsList = this.ingredients.split("\n").map(line => line.trim()).filter(line => line.length > 0);
        } else {
            this.ingredientsList = [];
        }
        this.instructions = row.instructions;
        this.prepTime = row.prep_time;//minutes
        this.cooktime = row.cook_time;//minutes
        this.servings = row.servings;
        this.userId = row.user_id;
        this.username = row.username;
        this.canEdit = false;
        this.favCount = Number(row.fav_count) || 0;
        this.isFavorite = row.is_favorite;
        const rating = ratings?.[this.recipeId] || {};
        this.avgRating = rating.avgRating || null;
        this.ratingCount = rating.ratingCount || 0;
        this.userRating = rating.userRating || null;

        // compare timestamps with 1 second buffer
        this.isUpdated = (new Date(row.updated_at) - new Date(row.created_at)) > 1000;

        // formatted as "Oct 31, 2026"
        this.createdAt = new Date(row.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
        this.updatedAt = new Date(row.updated_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    isOwnedBy(userId) {
        this.canEdit = this.userId === userId;
        return this.canEdit;
    }

    setRating = async (userId, rating) => {
        const existing = (await query(`
            SELECT id FROM ratings
            WHERE recipe_id = $1 AND user_id = $2;
        `, [this.recipeId, userId]))[0];

        if (existing) {
            await query(`
                UPDATE ratings
                SET rating = $3
                WHERE recipe_id = $1 AND user_id = $2;
            `, [this.recipeId, userId, rating]);
        } else {
            await query(`
                INSERT INTO ratings (recipe_id, user_id, rating)
                VALUES ($1, $2, $3);
            `, [this.recipeId, userId, rating]);
        }
        this.userRating = Number(rating);
    }

    saveEdit = async () => {
        await query(`
            UPDATE recipes
            SET user_id = $2,
                title = $3,
                description = $4,
                ingredients = $5,
                instructions = $6,
                prep_time = $7,
                cook_time = $8,
                servings = $9,
                updated_at = NOW()
            WHERE id = $1;
        `, [this.recipeId, this.userId, this.title, this.description, this.ingredients, this.instructions, this.prepTime, this.cooktime, this.servings]);
    }
    toggleFavorite = async (userId) => {
        if (!this.isFavorite) {
            await query(`
                INSERT INTO favorites (recipe_id, user_id)
                VALUES($1, $2);    
            `, [this.recipeId, userId]);
            this.favCount++;
        } else {
            await query(`
                DELETE FROM favorites
                WHERE recipe_id = $1 AND user_id = $2;    
            `, [this.recipeId, userId]);
            this.favCount = Math.max(0, this.favCount - 1);
        }
        this.isFavorite = !this.isFavorite;
    }
    delete = async () => {
        await query(`
            DELETE FROM recipes
            WHERE id = $1;    
        `, [this.recipeId]);
    }
}
