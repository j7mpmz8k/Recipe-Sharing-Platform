const starRatingContainer = document.querySelector(".star-rating");

if (starRatingContainer) {
    const recipeId = starRatingContainer.dataset.recipeId;
    const initialRating = starRatingContainer.dataset.userRating;

    if (initialRating) {
        const currentInput = document.getElementById("star" + initialRating);
        if (currentInput) {
            currentInput.checked = true;
        }
    }

    const inputs = starRatingContainer.querySelectorAll('input[type="radio"]');
    for (const input of inputs) {
        input.addEventListener("change", async () => {
            const ratingValue = input.value;
            const res = await fetch(`/recipes/${recipeId}/rate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ rating: ratingValue })
            });

            if (res.ok) {
                const data = await res.json();
                input.checked = true;

                const userRatingText = document.getElementById("user-rating-text");
                if (userRatingText) {
                    userRatingText.innerHTML = `Your rating: <strong>★ ${data.userRating}/5</strong> (select a star to change):`;
                }

                const avgRatingText = document.getElementById("avg-rating-text");
                if (avgRatingText) {
                    let avgDisplay = "Unrated";
                    if (data.avgRating) {
                        avgDisplay = data.avgRating;
                    }
                    avgRatingText.innerHTML = `Average Rating: <strong>★ ${avgDisplay}</strong> (${data.ratingCount} ratings)`;
                }
            }
        });
    }
}
