import query from "../db/connection.js";

export async function getRatings(userId = 0) {
    const rows = await query(`
        SELECT r.recipe_id, u.rating AS user_rating,
            ROUND(AVG(r.rating), 1) AS avg_rating, 
            COUNT(r.id) AS rating_count
        FROM ratings r
        LEFT JOIN ratings u ON r.recipe_id = u.recipe_id AND u.user_id = $1
        GROUP BY r.recipe_id, u.rating;
    `, [userId]);

    const lookup = {};
    for (const r of rows) {
        lookup[r.recipe_id] = {
            avgRating: r.avg_rating,
            ratingCount: Number(r.rating_count),
            userRating: r.user_rating || null
        };
    }
    return lookup;
}
