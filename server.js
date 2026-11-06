import express from "express";
import cookieParser from "cookie-parser";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import { loggingMiddleware } from "./middleware/logging.js";
import { loadSession } from "./middleware/auth.js";
import { loadRecipes, loadFeaturedRecipes } from "./middleware/content.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { securityHeaders } from "./middleware/security.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { trackActivity, getOnlineCount } from "./middleware/activity.js";
import usersRouter from "./controllers/users.js";
import { recipesRouter, userRecipiesRouter } from "./controllers/recipes.js";
import favRouter from "./controllers/favorites.js";
import adminRouter from "./controllers/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Trust the first proxy hop (Nginx) for real client IPs and secure HTTPS cookies
app.set("trust proxy", 1);

// global middleware
app.use(securityHeaders);
app.use(express.static(path.join(__dirname, "public")));
app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(loggingMiddleware);
app.use(loadSession);
app.use(trackActivity);

// global handlebars
app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

//global routers
app.use("/", usersRouter);
app.use("/admin", adminRouter);
app.use("/", userRecipiesRouter);
app.use("/recipes", recipesRouter);
app.use("/", favRouter);
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

app.get("/api/online-count", (req, res) => {
    res.json({ count: getOnlineCount() });
});

app.get("/", loadFeaturedRecipes, (req, res) => {
    res.render("home");
});

//global error pages
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
