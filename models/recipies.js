import query from "../db/connection.js";

export async function createRecipe(title = "", ingredients = "", instructions = "", prepTime = 0, cooktime = 0, servings = 0, userId = 0, username = "") {
    rows = (await query(`
        INSERT INTO recipies (title, ingredients, instructions, prep_time, cook_time, servings, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at, updated_at;
        `, [title, ingredients, prepTime, cooktime, servings, userId]))[0];
    const recipe = new Recipe(rows.id, title, ingredients, instructions, prepTime, cooktime, servings, userId, username, rows.created_at, rows.updated_at);
    return recipe;
}
export async function getRecipies() {
    const rows = (await query(`
        SELECT r.*, u.username
        FROM recipies r
        JOIN users u on r.user_id = u.id
    `));
    return rows.map(recipe => new Recipe(recipe.id, recipe.title, recipe.ingredients, recipe.instructions, recipe.prep_time, recipe.cook_time, recipe.servings, recipe.user_id, recipe.username, recipe.created_at, recipe.updated_at)) || null;
}

class Recipe {
    constructor(recipeId, title, ingredients, instructions, prepTime, cooktime, servings, userId, username, createdAt, updatedAt) {
        this.recipeId = recipeId;
        this.title = title;
        this.ingredients = ingredients;
        this.instructions = instructions;
        this.prepTime = prepTime;//minutes
        this.cooktime = cooktime;//minutes
        this.servings = servings;
        this.userId = userId;
        this.username = username;

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

    saveRecipe = async () => {
        await query(`
            UPDATE recipies
            SET user_id = $2,
                title = $3,
                ingredients = $4,
                instructions = $5,
                prep_time = $6,
                cooktime = $7,
                servings = $8,
                updated_at = NOW(),
            WHERE id = $1;
        `, [this.recipeId, this.userId, this.title, this.ingredients, this.instructions, this.prepTime, this.servings, this.cooktime]);
    }
}
