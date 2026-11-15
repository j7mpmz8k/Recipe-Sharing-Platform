// public/js/app.js - Global Client-Side Application Script

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------------
    // 1. Online Member Counter (Polls every 10 seconds)
    // -------------------------------------------------------------
    const onlineCountEl = document.getElementById("online-count-text");
    if (onlineCountEl) {
        setInterval(async () => {
            try {
                const res = await fetch("/api/online-count");
                if (res.ok) {
                    const data = await res.json();
                    if (typeof data.count === "number") {
                        onlineCountEl.textContent = data.count + " online";
                    }
                }
            } catch (err) {}
        }, 10000);
    }

    // -------------------------------------------------------------
    // 2. User Account Dropdown Menu
    // -------------------------------------------------------------
    const userMenuBtn = document.getElementById("userMenuBtn");
    const userDropdownMenu = document.getElementById("userDropdownMenu");
    if (userMenuBtn && userDropdownMenu) {
        userMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = userDropdownMenu.classList.toggle("show");
            userMenuBtn.setAttribute("aria-expanded", isOpen);
        });

        document.addEventListener("click", (e) => {
            if (!userDropdownMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
                userDropdownMenu.classList.remove("show");
                userMenuBtn.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                userDropdownMenu.classList.remove("show");
                userMenuBtn.setAttribute("aria-expanded", "false");
            }
        });
    }

    // -------------------------------------------------------------
    // 3. Screen Wake Lock (Automatic on Recipe Detail Page)
    // -------------------------------------------------------------
    if (document.querySelector(".recipe-detail-container")) {
        let wakeLockSentinel = null;
        async function acquireWakeLock() {
            if ("wakeLock" in navigator) {
                try {
                    wakeLockSentinel = await navigator.wakeLock.request("screen");
                } catch (err) {}
            }
        }
        acquireWakeLock();
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                acquireWakeLock();
            }
        });
    }
});

// -----------------------------------------------------------------
// 4. Global Event Delegation (Clicks, Submits, Changes)
// -----------------------------------------------------------------
document.addEventListener("click", async (e) => {
    // --- A. Recipe Favorite Toggle Button ---
    const favBtn = e.target.closest(".favorite-btn");
    if (favBtn) {
        const recipeId = favBtn.dataset.recipeId;
        if (recipeId) {
            try {
                const res = await fetch(`/recipes/${encodeURIComponent(recipeId)}/favorite`, { method: "POST" });
                if (res.ok) {
                    const data = await res.json();
                    favBtn.classList.toggle("favorited", data.isFavorite);
                    favBtn.title = data.isFavorite ? "Unfavorite this recipe" : "Favorite this recipe";

                    const btnIcon = favBtn.querySelector(".heart-icon");
                    if (btnIcon) {
                        btnIcon.textContent = data.isFavorite ? "❤️" : "🤍";
                    }

                    const btnText = favBtn.querySelector(".favorite-text");
                    if (btnText) {
                        btnText.textContent = data.isFavorite ? "Favorited" : "Favorite";
                    }

                    const countSpan = favBtn.querySelector(".favorite-count");
                    if (countSpan && data.favoriteCount !== undefined) {
                        countSpan.textContent = data.favoriteCount;
                    }
                }
            } catch (err) {
                console.error("Error toggling favorite:", err);
            }
        }
        return;
    }

    // --- B. Recipe Share Copy Button or Finger Clue ---
    const finger = e.target.closest(".copy-hint-finger");
    if (finger) {
        const shareBtn = finger.previousElementSibling || finger.closest(".recipe-copy-wrapper")?.querySelector(".share-card-btn, [data-action='copy-share']");
        if (shareBtn) copyRecipeShare(shareBtn);
        return;
    }

    const shareBtn = e.target.closest(".share-card-btn, [data-action='copy-share']");
    if (shareBtn) {
        copyRecipeShare(shareBtn);
        return;
    }

    // --- C. Admin Feature Recipe Toggle on Recipe Detail Page ---
    const adminFeatureBtn = e.target.closest("#adminFeatureBtn");
    if (adminFeatureBtn) {
        const recipeId = adminFeatureBtn.getAttribute("data-recipe-id");
        if (recipeId) {
            try {
                adminFeatureBtn.disabled = true;
                const res = await fetch(`/recipes/${encodeURIComponent(recipeId)}/feature`, {
                    method: "POST",
                    headers: { "Accept": "application/json" }
                });
                if (res.ok) {
                    const data = await res.json();
                    const textSpan = adminFeatureBtn.querySelector("#adminFeatureText") || adminFeatureBtn;
                    if (data.isFeatured) {
                        textSpan.textContent = "★ Featured on Home";
                        adminFeatureBtn.classList.add("is-featured");
                    } else {
                        textSpan.textContent = "☆ Feature on Home";
                        adminFeatureBtn.classList.remove("is-featured");
                    }
                }
            } catch (err) {
                console.error("Error toggling feature:", err);
            } finally {
                adminFeatureBtn.disabled = false;
            }
        }
        return;
    }

    // --- D. Generic Copy to Clipboard via data-copy-text or data-copy-target ---
    const copyTrigger = e.target.closest("[data-copy-text], [data-copy-target]");
    if (copyTrigger) {
        let textToCopy = copyTrigger.getAttribute("data-copy-text");
        const targetId = copyTrigger.getAttribute("data-copy-target");
        if (!textToCopy && targetId) {
            const targetEl = document.getElementById(targetId);
            if (targetEl) textToCopy = targetEl.value || targetEl.innerText;
        }

        if (textToCopy) {
            const orig = copyTrigger.innerHTML;
            const successMsg = copyTrigger.getAttribute("data-copied-text") || "✓ Copied!";
            const handleSuccess = () => {
                copyTrigger.innerHTML = successMsg;
                setTimeout(() => { copyTrigger.innerHTML = orig; }, 2000);
            };

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(handleSuccess).catch(() => fallbackCopy(textToCopy, handleSuccess));
            } else {
                fallbackCopy(textToCopy, handleSuccess);
            }
        }
        return;
    }

    // --- E. Generic Button/Link Confirmation (data-confirm) ---
    const confirmEl = e.target.closest("[data-confirm]");
    if (confirmEl && confirmEl.tagName !== "FORM") {
        const msg = confirmEl.getAttribute("data-confirm");
        if (msg && !confirm(msg)) {
            e.preventDefault();
            e.stopPropagation();
        }
        return;
    }
});

// --- F. Generic Form Confirmation (data-confirm) ---
document.addEventListener("submit", (e) => {
    const form = e.target;
    const msg = form.getAttribute("data-confirm");
    if (msg && !confirm(msg)) {
        e.preventDefault();
    }
});

// --- G. Generic Dropdown Auto-Submit (data-auto-submit) ---
document.addEventListener("change", (e) => {
    if (e.target.matches("[data-auto-submit]")) {
        if (e.target.form) e.target.form.submit();
    }
});

// -----------------------------------------------------------------
// 5. Recipe Share Link Copy Helper & Floating Tooltip
// -----------------------------------------------------------------
function copyRecipeShare(btn) {
    const title = btn.getAttribute("data-title") || "";
    const author = btn.getAttribute("data-author") || "";
    const path = btn.getAttribute("data-url");
    const shareUrl = path ? (window.location.origin + path) : (window.location.origin + window.location.pathname);
    const shareText = 'Check out "' + title + '" by ' + author + "\n" + shareUrl;

    function showSuccess() {
        const orig = btn.innerHTML;
        const isCard = btn.classList.contains("share-card-btn");
        btn.innerHTML = isCard ? "✓" : "✓ Copied!";
        btn.style.color = "#16a34a";
        setTimeout(() => {
            btn.innerHTML = orig;
            btn.style.color = "";
        }, 2000);

        showCopyTooltip(btn, "Shareable link copied!");
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(shareText).then(showSuccess).catch(() => fallbackCopy(shareText, showSuccess));
    } else {
        fallbackCopy(shareText, showSuccess);
    }
}

function showCopyTooltip(btn, message) {
    const existing = document.querySelector(".copy-tooltip");
    if (existing) existing.remove();

    const tooltip = document.createElement("div");
    tooltip.className = "copy-tooltip";
    tooltip.innerHTML = '<span style="color: #22c55e; font-size: 0.95em;">✓</span> ' + (message || "Shareable link copied!");
    document.body.appendChild(tooltip);

    const rect = btn.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top - tooltipRect.height - 8;
    let flipped = false;
    if (top < 10) {
        top = rect.bottom + 8;
        flipped = true;
    }

    let left = rect.left + (rect.width / 2);
    const padding = 12;
    const halfWidth = tooltipRect.width / 2;
    if (left - halfWidth < padding) {
        left = padding + halfWidth;
    } else if (left + halfWidth > window.innerWidth - padding) {
        left = window.innerWidth - padding - halfWidth;
    }

    tooltip.style.top = Math.round(top) + "px";
    tooltip.style.left = Math.round(left) + "px";
    if (flipped) {
        tooltip.classList.add("flipped");
    }

    void tooltip.offsetHeight;
    tooltip.classList.add("show");

    setTimeout(() => {
        tooltip.classList.remove("show");
        tooltip.classList.add("fade-out");
        setTimeout(() => tooltip.remove(), 220);
    }, 1800);
}

function fallbackCopy(text, onSuccess) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand("copy");
        if (onSuccess) onSuccess();
    } catch (err) {
        prompt("Copy this link:", text);
    }
    document.body.removeChild(textarea);
}
