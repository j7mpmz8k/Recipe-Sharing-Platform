import { getAllRecipes } from "../models/recipes.js";

export async function loadRecipes(req, res, next) {
    const recipes = await getAllRecipes();
    req.recipes = res.locals.recipes = recipes;
    next();
}
