import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {createUser} from "../models.users";
import { createUser, findUser, loadUser } from "../models/users";

const usersRouter = express.Router();

usersRouter.get("/register", (req, res) => {
    res.render("register");
});

usersRouter.post("/register", async (req,res) => {
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
    res.cookie("session_id", crypto.randomUUID(), {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    const user = createUser(username, email, password);
    user.createSession()
    req.user = res.locals.user = user;
    res.redirect("/");
});

usersRouter.get("/login", (req, res) => {
    if (req.user) {
        return res.redirect("/");
    }
    res.render("login");
});

usersRouter.post("/login", async (req, res) => {
    const { username, email, password } = req.body;
    const user = findUser(username);
    req.user = req.local.user = user;

    if (!user.username || !bcrypt.compare(password, user.passwordHash)) {
        return res.render("register", {
            error: 'No user found with that password!',
        });
    }
    res.cookie("session_id", user.sessionId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.redirect("/");
});

export default usersRouter;
