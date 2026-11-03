import express from "express";
import bcrypt from "bcrypt";
import { createUser, findUser } from "../models/users.js";
import { createSession, deleteSession } from "../models/sessions.js";
import { requireAuth } from "../middleware/auth.js";
import { loadUserProfile } from "../middleware/content.js";

const usersRouter = express.Router();

usersRouter.get("/register", (req, res) => {
    res.render("users/register");
});

usersRouter.post("/register", async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    if (password != confirmPassword) {
        return res.render("users/register", {
            error: "Passwords do not match!",
            username,
            email
        });
    }
    const userId = await createUser(username, email, password);
    const sessionId = await createSession(userId);
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.redirect("/");
});

usersRouter.get("/login", (req, res) => {
    if (req.user) {
        return res.redirect("/");
    }
    res.render("users/login");
});

usersRouter.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await findUser(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.render("users/login", {
            error: 'No user found with that password!',
        });
    }
    const sessionId = await createSession(user.id);
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.redirect("/");
});

usersRouter.post("/logout", requireAuth, async (req, res) => {
    await deleteSession(req.session);
    res.clearCookie("session_id");
    res.redirect("/login");
});

usersRouter.get("/users/:id", loadUserProfile, (req, res) => {
    res.render("users/show");
});

export default usersRouter;
