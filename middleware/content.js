import { getAllRecipes } from "../models/recipes.js";

export async function loadRecipes(req, res, next) {
    let userId = 0;
    if (req.user) {
        userId = req.user.id;
    }
    const recipes = await getAllRecipes(userId);
    if (req.session) {
        recipes.forEach(recipe => recipe.isOwnedBy(req.user.id));
    }
    req.recipes = res.locals.recipes = recipes;
    next();
}
