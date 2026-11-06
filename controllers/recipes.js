import express from "express";
import { loadRecipes, loadUserProfile } from "../middleware/content.js";
import { requireAuth, isAdminUser } from "../middleware/auth.js";
import { createRecipe, getRecipeById, toggleRecipeFeatured } from "../models/recipes.js";
const recipesRouter = express.Router();
const userRecipiesRouter = express.Router();

recipesRouter.use(loadRecipes);

userRecipiesRouter.get("/my-recipes", requireAuth, loadUserProfile, async (req, res) => {
    res.render("my-recipes");
});

recipesRouter.get("/", (req, res) => {
    res.render("recipes/index");
});

recipesRouter.get("/new", requireAuth, (req, res) => {
    res.render("recipes/new");
});

recipesRouter.post("/", requireAuth, async (req, res) => {
    const { title, description, prep_time, cook_time, servings, ingredients, instructions, category } = req.body;
    const recipeId = await createRecipe(title, description, ingredients, instructions, prep_time, cook_time, servings, req.user.id, req.user.username, category);
    res.redirect(`/recipes/${recipeId}`);
});

recipesRouter.get("/:id", async (req, res, next) => {
    const currentUserId = req.user ? req.user.id : 0;
    const recipe = await getRecipeById(req.params.id, currentUserId);
    if (!recipe) {
        return next({ status: 404 });
    }
    if (req.session) {
        recipe.isOwnedBy(req.user.id);
    }
    res.locals.recipe = recipe;
    res.render("recipes/show");
});

recipesRouter.get("/:id/edit", requireAuth, async (req, res, next) => {
    const recipe = await getRecipeById(req.params.id, req.user.id);
    if (!recipe) {
        return next({ status: 404 });
    } else if (!recipe.isOwnedBy(req.user.id)) {
        return next({ status: 403 });
    } else {
        res.locals.recipe = recipe;
        res.render("recipes/edit");
    }
});

recipesRouter.post("/:id", requireAuth, async (req, res, next) => {
    const recipe = await getRecipeById(req.params.id, req.user.id);
    if (!recipe) {
        return next({ status: 404 });
    } else if (!recipe.isOwnedBy(req.user.id)) {
        return next({ status: 403 });
    } else {
        const { title, description, prep_time, cook_time, servings, ingredients, instructions, category } = req.body;
        recipe.title = title;
        recipe.description = description;
        recipe.prepTime = prep_time || 0;
        recipe.cooktime = cook_time || 0;
        recipe.servings = servings || 0;
        recipe.ingredients = ingredients;
        recipe.instructions = instructions;
        recipe.category = category || "Other";
        await recipe.saveEdit();
        res.redirect(`/recipes/${recipe.recipeId}`);
    }
});

// Admin toggle featured recipe on homepage
recipesRouter.post("/:id/feature", requireAuth, async (req, res) => {
    if (!isAdminUser(req.user.id)) {
        return res.status(403).json({ success: false, error: "Admin privilege required" });
    }
    const updated = await toggleRecipeFeatured(req.params.id);
    if (!updated) {
        return res.status(404).json({ success: false, error: "Recipe not found" });
    }
    res.json({ success: true, isFeatured: updated.is_featured });
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
