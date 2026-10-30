import express from "express";
import bcrypt from "bcrypt";
import {createUser, findUser} from "../models/users.js";
import {createSession, deleteSession} from "../models/sessions.js";

const authRouter = express.Router();

authRouter.get("/register", (req, res) => {
    res.render("register");
});

authRouter.post("/register", async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    if (password != confirmPassword) {
        return res.render("register", {
            error: "Passwords do not match!",
            username,
            email
        });
    }
    let userId = await createUser(username, email, password);
    const sessionId = await createSession(userId);
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
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
    const user = await findUser(username);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        return res.render("login", {
            error: 'No user found with that password!',
        });
    }
    const sessionId = await createSession();
    res.cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.redirect("/");
});

authRouter.post("/logout", async (req, res) => {
    await deleteSession(req.sessionId);
    res.clearCookie("session_id");
});

export default authRouter;
