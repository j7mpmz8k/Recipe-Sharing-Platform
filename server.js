import express from "express";
import cookieParser from "cookie-parser";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import { loggingMiddleware } from "./middleware/logging.js";
import { loadSession } from "./middleware/auth.js";
import { loadRecipes } from "./middleware/content.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import usersRouter from "./controllers/users.js";
import recipesRouter from "./controllers/recipes.js";
import favRouter from "./controllers/favorites.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// global middleware
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(loggingMiddleware);
app.use(loadSession);

// global handlebars
app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

//global routers
app.use("/", usersRouter);
app.use("/recipes", recipesRouter);
app.use("/favorits", favRouter);
app.get("/", loadRecipes, (req, res) => {
    res.render("home");
});

//global error pages
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
