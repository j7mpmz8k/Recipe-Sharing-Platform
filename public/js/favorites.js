const buttons = document.querySelectorAll(".favorite-btn");

for (btn of buttons) {
    btn.addEventListener("click", async () => {
        const recipeId = btn.dataset.recipeId; 
        const res = await fetch(`/recipes/${recipeId}/favorite`, {
            method: "POST"
        });
        const data = await res.json();
        const btnIcon = btn.querySelector(".heart-icon");
        if (data.isFavorite) {
            btnIcon.textContent = "❤️";                                                                                                  
        } else {
            btnIcon.textContent = "🤍";                                                                                                  
        }
    });
}
