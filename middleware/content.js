import { getAllRecipes } from "../models/recipes.js";

export async function loadRecipes(req, res, next) {
    const recipes = await getAllRecipes();
    if (req.session) {
        recipes.forEach(recipe => recipe.isOwnedBy(req.user.id));
    }
    req.recipes = res.locals.recipes = recipes;
    next();
}
