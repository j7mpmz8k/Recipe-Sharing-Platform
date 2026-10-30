import express from "express";
import cookieParser from "cookie-parser";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import { loggingMiddleware } from "./middleware/logging.js";
import { loadSession } from "./middleware/auth.js";
import usersRouter from "./controllers/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Global Middleware
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(loadSession);
app.use(express.static(path.join(__dirname, "public")));
app.use(loggingMiddleware)

// Global handlebars
app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use("/", usersRouter);


app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
