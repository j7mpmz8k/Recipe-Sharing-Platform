import query from "../db/connection.js";

export async function createRecipe(title = "", description = "", ingredients = "", instructions = "", prepTime = 0, cooktime = 0, servings = 0, userId = 0, username = "") {
    const r = (await query(`
        INSERT INTO recipes (title, description, ingredients, instructions, prep_time, cook_time, servings, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
        `, [title, description, ingredients, instructions, prepTime, cooktime, servings, userId]))[0];
    return r.id;
}

export async function getRecipe(recipeId) {
    const r = (await query(`
        SELECT r.*, u.username
        FROM recipes r
        JOIN users u on r.user_id = u.id
        WHERE r.id = $1;
    `, [recipeId]))[0];
    return new Recipe(r.id, r.title, r.description, r.ingredients, r.instructions, r.prep_time, r.cook_time, r.servings, r.user_id, r.username, r.created_at, r.updated_at) || null;
}

export async function getAllRecipes() {
    const rows = (await query(`
        SELECT r.*, u.username
        FROM recipes r
        JOIN users u on r.user_id = u.id;
    `));
    return rows.map(r => new Recipe(r.id, r.title, r.description, r.ingredients, r.instructions, r.prep_time, r.cook_time, r.servings, r.user_id, r.username, r.created_at, r.updated_at)) || null;
}

class Recipe {
    constructor(recipeId, title, description, ingredients, instructions, prepTime, cooktime, servings, userId, username, createdAt, updatedAt) {
        this.recipeId = recipeId;
        this.title = title;
        this.description = description;
        this.ingredients = ingredients;
        this.instructions = instructions;
        this.prepTime = prepTime;//minutes
        this.cooktime = cooktime;//minutes
        this.servings = servings;
        this.userId = userId;
        this.username = username;
        this.isOwner = false;

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
        this.isOwner = Boolean(userId && this.userId === userId);
        return this.isOwner;
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
}
