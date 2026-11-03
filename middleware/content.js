import { getAllRecipes } from "../models/recipes.js";
import { getUserData } from "../models/users.js";

export async function loadRecipes(req, res, next) {
    //used to test if user favorited recipe...set to zero as fallback incase no session user
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

export async function loadUserProfile(req, res, next) {
    let userId = req.params.id;
    if (!userId && req.user) {
        userId = req.user.id;
    }
    let currentUserId = 0;
    if (req.user) {
        currentUserId = req.user.id;
    }
    const user = await getUserData(userId, currentUserId);
    if (!user) {
        return next({ status: 404 });
    }
    if (req.user) {
        user.recipes.forEach(recipe => recipe.isOwnedBy(req.user.id));
    }
    req.userProfile = res.locals.userProfile = user;
    req.recipes = res.locals.recipes = user.recipes;
    next();
}
