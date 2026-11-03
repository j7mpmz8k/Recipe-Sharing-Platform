import query from "../db/connection.js";

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
            SELECT r.*, u.username, COUNT(f.id) AS fav_count,
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
    return rows.map(r => new Recipe(r.id, r.title, r.description, r.ingredients, r.instructions, r.prep_time, r.cook_time, r.servings, r.user_id, r.username, r.created_at, r.updated_at, r.fav_count, r.is_favorite)) || [];
}
export async function getUserRecipes(userId, viewerId = 0) {
    const rows = (await query(`
        SELECT r.*, u.username, COUNT(f.id) AS fav_count,
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
    return rows.map(r => new Recipe(r.id, r.title, r.description, r.ingredients, r.instructions, r.prep_time, r.cook_time, r.servings, r.user_id, r.username, r.created_at, r.updated_at, r.fav_count, r.is_favorite)) || [];
}

export async function getFeaturedRecipes(userId = 0) {
    const rows = (await query(`
        SELECT r.*, u.username, COUNT(f.id) AS fav_count,
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
    return rows.map(r => new Recipe(r.id, r.title, r.description, r.ingredients, r.instructions, r.prep_time, r.cook_time, r.servings, r.user_id, r.username, r.created_at, r.updated_at, r.fav_count, r.is_favorite)) || [];
}

export async function getFavoriteRecipes(userId) {
    const rows = (await query(`
        SELECT r.*, u.username, COUNT(all_f.id) AS fav_count, true AS is_favorite
        FROM favorites fav
        JOIN recipes r ON fav.recipe_id = r.id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN favorites all_f ON r.id = all_f.recipe_id
        WHERE fav.user_id = $1
        GROUP BY r.id, u.username
        ORDER BY r.id DESC;
    `, [userId]));
    return rows.map(r => new Recipe(r.id, r.title, r.description, r.ingredients, r.instructions, r.prep_time, r.cook_time, r.servings, r.user_id, r.username, r.created_at, r.updated_at, r.fav_count, true)) || [];
}

class Recipe {
    constructor(recipeId, title, description, ingredients, instructions, prepTime, cooktime, servings, userId, username, createdAt, updatedAt, favoriteCount, isFavorite) {
        this.recipeId = recipeId;
        this.title = title;
        this.description = description;
        this.ingredients = ingredients;
        if (this.ingredients) {//used only for rendering with checkboxes
            this.ingredientsList = this.ingredients.split("\n").map(line => line.trim()).filter(line => line.length > 0);
        } else {
            this.ingredientsList = [];
        }
        this.instructions = instructions;
        this.prepTime = prepTime;//minutes
        this.cooktime = cooktime;//minutes
        this.servings = servings;
        this.userId = userId;
        this.username = username;
        this.canEdit = false;
        this.favCount = Number(favoriteCount) || 0;
        this.isFavorite = isFavorite;

        // compare timestamps with 1 second buffer
        this.isUpdated = (new Date(updatedAt) - new Date(createdAt)) > 1000;

        // formatted as "Oct 31, 2026"
        this.createdAt = new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
        this.updatedAt = new Date(updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    isOwnedBy(userId) {
        this.canEdit = this.userId === userId;
        return this.canEdit;
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
