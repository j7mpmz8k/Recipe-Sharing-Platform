import express from "express";
import { loadRecipes, loadUserProfile } from "../middleware/content.js";
import { requireAuth } from "../middleware/auth.js";
import { createRecipe } from "../models/recipes.js";
const recipesRouter = express.Router();
const userRecipiesRouter = express.Router();
userRecipiesRouter.use(loadUserProfile);

recipesRouter.use(loadRecipes);

userRecipiesRouter.get("/my-recipes", requireAuth, async (req, res) => {
    res.render("my-recipes");
});

recipesRouter.get("/", (req, res) => {
    res.render("recipes/index");
});

recipesRouter.get("/new", requireAuth, (req, res) => {
    res.render("recipes/new");
});

recipesRouter.post("/", requireAuth, async (req, res) => {
    const { title, description, prep_time, cook_time, servings, ingredients, instructions } = req.body;
    const recipeId = await createRecipe(title, description, ingredients, instructions, prep_time, cook_time, servings, req.user.id, req.user.username);
    res.redirect(`/recipes/${recipeId}`);
});

recipesRouter.get("/:id", (req, res, next) => {
    const recipe = req.recipes.find(i => i.recipeId == req.params.id);
    if (!recipe) {
        next({ status: 404 });
    } else {
        res.locals.recipe = recipe;
        res.render("recipes/show");
    }
});

recipesRouter.get("/:id/edit", requireAuth, (req, res, next) => {
    const recipe = req.recipes.find(i => i.recipeId == req.params.id);
    if (!recipe) {
        next({ status: 404 });
    } else if (!recipe.canEdit) {
        next({ status: 403 });
    } else {
        res.locals.recipe = recipe;
        res.render("recipes/edit");
    }
});

recipesRouter.post("/:id", requireAuth, async (req, res, next) => {
    const recipe = req.recipes.find(i => i.recipeId == req.params.id);
    if (!recipe) {
        next({ status: 404 });
    } else if (!recipe.canEdit) {
        next({ status: 403 });
    } else {
        const { title, description, prep_time, cook_time, servings, ingredients, instructions } = req.body;
        recipe.title = title;
        recipe.description = description;
        recipe.prepTime = prep_time || 0;
        recipe.cookTime = cook_time || 0;
        recipe.servings = servings || 0;
        recipe.ingredients = ingredients;
        recipe.instructions = instructions;
        await recipe.saveEdit();
        res.redirect(`/recipes/${recipe.recipeId}`);
    }
});

recipesRouter.post("/:id/favorite", requireAuth, async (req, res, next) => {
    const recipe = req.recipes.find(i => i.recipeId == req.params.id);
    if (!recipe) {
        next({ status: 404 });
    } else {
        await recipe.toggleFavorite(req.user.id);
        res.json({ 
            isFavorite: recipe.isFavorite,
            favoriteCount: recipe.favCount
        });
    }
})

recipesRouter.post("/:id/delete", requireAuth, async (req, res, next) => {
    const recipe = req.recipes.find(i => i.recipeId == req.params.id);
    if (!recipe) {
        next({ status: 404 });
    } else if (!recipe.canEdit) {
        next({ status: 403 });
    } else {
        recipe.delete();
        res.redirect("/recipes");
    }
})

export { recipesRouter, userRecipiesRouter }
