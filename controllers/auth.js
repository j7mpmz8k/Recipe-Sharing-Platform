import express from "express";
import bcrypt from "bcrypt";
import {createUser, findUser} from "../models.users";
import {createSession, deleteSession} from "../models.sessions";

const authRouter = express.Router();

authRouter.get("/register", (req, res) => {
    res.render("register");
});

authRouter.post("/register", async (req,res) => {
    const { username, email, password, confirmPassword } = req.body;
    if (email.split("@").length == 0) {
        return res.render("register", {
            error: 'Email not valid eg. "name@example.com"',
            username,
            password,
            confirmPassword
        })
    }
    if (password != confirmPassword) {
        return res.render("register", {
            error: "Passwords do not match!",
            username,
            email
        });
    }
    const sessionId = createSession();
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    const user = createUser(username, email, password);
    req.user = res.locals.user = user;
    res.redirect("/");
});

authRouter.get("/login", (req, res) => {
    if (req.user) {
        return res.redirect("/");
    }
    res.render("login");
});

authRouter.post("/login", async (req, res) => {
    const { username, email, password } = req.body;
    const user = findUser(username);
    req.user = req.local.user = user;

    if (!user.username || !bcrypt.compare(password, user.passwordHash)) {
        return res.render("register", {
            error: 'No user found with that password!',
        });
    }
    const sessionId = createSession();
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.redirect("/");
});

export default authRouter;
