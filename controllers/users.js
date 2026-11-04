import express from "express";
import bcrypt from "bcrypt";
import { createUser, findUser } from "../models/users.js";
import { createSession, deleteSession } from "../models/sessions.js";
import { requireAuth } from "../middleware/auth.js";
import { loadUserProfile } from "../middleware/content.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const usersRouter = express.Router();

usersRouter.get("/register", (req, res) => {
    res.render("users/register");
});

usersRouter.post("/register", authLimiter, async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    if (password != confirmPassword) {
        return res.render("users/register", {
            error: "Passwords do not match!",
            username,
            email
        });
    }
    if (!password || password.length < 8) {
        return res.render("users/register", {
            error: "Password must be at least 8 characters long!",
            username,
            email
        });
    }

    let userId;
    try {
        userId = await createUser(username, email, password);
    } catch (err) {
        let errorMessage = "An error occurred while creating your account.";
        if (err.code === "23505") {
            errorMessage = "A user with that username or email already exists!";
        }
        return res.render("users/register", {
            error: errorMessage,
            username,
            email
        });
    }

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

usersRouter.post("/login", authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.render("users/login", {
            error: "Username and password are required!"
        });
    }
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
