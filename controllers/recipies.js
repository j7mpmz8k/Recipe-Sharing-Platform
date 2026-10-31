import express from "express";
import { loadRecipies } from "../middleware/content.js";
const recipiesRouter = express.Router();

recipiesRouter.use(loadRecipies)
recipiesRouter.get("/", (req, res) => {
    res.render("recipies");
});


export default recipiesRouter;
