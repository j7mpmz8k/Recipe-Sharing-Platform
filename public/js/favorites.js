const buttons = document.querySelectorAll(".favorite-btn");

for (btn of buttons) {
    btn.addEventListener("click", async () => {
        const recipeId = btn.dataset.recipeId; 
        const res = await fetch(`/recipes/${recipeId}/favorite`, {
            method: "POST"
        });
        const data = await res.json();
        const btnIcon = btn.querySelector(".heart-icon");
        btn.classList.toggle("favorited", data.isFavorite);
        if (data.isFavorite) {
            btnIcon.textContent = "❤️";                                                                                                  
        } else {
            btnIcon.textContent = "🤍";                                                                                                  
        }

        const btnText = btn.querySelector(".favorite-text");
        if (btnText) {
            btnText.textContent = data.isFavorite ? "Favorited" : "Favorite";
        }

        const countSpan = btn.querySelector(".favorite-count");
        if (countSpan && data.favoriteCount !== undefined) {
            countSpan.textContent = data.favoriteCount;
        }
    });
}
