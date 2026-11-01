import express from "express";
import { loadRecipes } from "../middleware/content.js";
const recipesRouter = express.Router();

recipesRouter.use(loadRecipes);
recipesRouter.get("/", (req, res) => {
    res.render("recipes");
});

export default recipesRouter;
