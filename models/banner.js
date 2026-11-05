// models/banner.js
import query from "../db/connection.js";

let cachedBanner = null;

export async function getSiteBanner() {
    if (cachedBanner) {
        return cachedBanner;
    }

    const rows = await query(`
        SELECT id, message, banner_type, is_active, updated_at
        FROM site_banner
        WHERE id = 1;
    `);

    if (rows.length > 0) {
        const row = rows[0];
        cachedBanner = {
            id: row.id,
            message: row.message || "",
            bannerType: row.banner_type || "warning",
            isActive: Boolean(row.is_active),
            isWarning: row.banner_type === "warning",
            isAlert: row.banner_type === "alert",
            isInfo: row.banner_type === "info",
            isSuccess: row.banner_type === "success",
            updatedAt: row.updated_at
        };
        return cachedBanner;
    }

    return {
        id: 1,
        message: "",
        bannerType: "warning",
        isActive: false,
        isWarning: true,
        isAlert: false,
        isInfo: false,
        isSuccess: false
    };
}

export async function updateSiteBanner(message, bannerType, isActive) {
    let type = "warning";
    if (bannerType === "alert" || bannerType === "info" || bannerType === "success") {
        type = bannerType;
    }

    const activeBool = Boolean(isActive);
    const msg = (message || "").trim();

    const rows = await query(`
        UPDATE site_banner
        SET message = $1,
            banner_type = $2,
            is_active = $3,
            updated_at = NOW()
        WHERE id = 1
        RETURNING id, message, banner_type, is_active, updated_at;
    `, [msg, type, activeBool]);

    if (rows.length > 0) {
        const row = rows[0];
        cachedBanner = {
            id: row.id,
            message: row.message || "",
            bannerType: row.banner_type || "warning",
            isActive: Boolean(row.is_active),
            isWarning: row.banner_type === "warning",
            isAlert: row.banner_type === "alert",
            isInfo: row.banner_type === "info",
            isSuccess: row.banner_type === "success",
            updatedAt: row.updated_at
        };
        return cachedBanner;
    }

    cachedBanner = null;
    return getSiteBanner();
}
