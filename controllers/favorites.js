import express from "express";
import { loadUserProfile } from "../middleware/content.js";
import { requireAuth } from "../middleware/auth.js";

const favRouter = express.Router();

favRouter.get("/favorites", requireAuth, loadUserProfile, (req, res) => {
    res.render("favorites");
});

export default favRouter;
