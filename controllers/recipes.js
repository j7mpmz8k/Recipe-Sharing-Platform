import express from "express";
import { loadRecipes } from "../middleware/content.js";
import { requireAuth } from "../middleware/auth.js";
import { createRecipe, getRecipe } from "../models/recipes.js";
const recipesRouter = express.Router();

recipesRouter.use(loadRecipes);

recipesRouter.get("/", (req, res) => {
    res.render("recipes/index");
});

recipesRouter.get("/new", requireAuth, (req, res) => {
    res.render("recipes/new");
});

recipesRouter.post("/", requireAuth, async (req, res) => {
    const { title, description, prep_time, cook_time, servings, ingredients, instructions } = req.body;
    const recipeId = await createRecipe(title, description, ingredients, instructions, prep_time, cook_time, servings, req.user.id, req.user.username);
    res.redirect(`${recipeId}`);
});

recipesRouter.get("/:id", async (req, res) => {
    const recipeId = req.params.id;
    const recipe = await getRecipe(recipeId);
    if (!recipe) {
        return res.status(404).render("not-found");
    }
    res.locals.recipe = recipe;
    res.render("recipes/show");
});

export default recipesRouter;
