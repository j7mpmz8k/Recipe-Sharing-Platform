import { getRecipes } from "../models/recipes.js";

export async function loadRecipes(req, res, next) {
    const recipes = await getRecipes();
    req.recipes = res.locals.recipes = recipes;
    next();
}
