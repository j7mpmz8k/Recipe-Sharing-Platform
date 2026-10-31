import { getRecipies } from "../models/recipies.js";

async function loadRecipies(req, res, next) {
    req.recipies = res.locals.recipies = await getRecipies();
    next()
}
