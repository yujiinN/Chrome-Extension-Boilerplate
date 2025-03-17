document.addEventListener("DOMContentLoaded", function () {
    const analyzeButton = document.getElementById("analyze");

    if (analyzeButton) {
        analyzeButton.addEventListener("click", () => {
            fetch("http://127.0.0.1:8000/fetch-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})  // Send an empty body since the backend fetches the name automatically
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.detail); });
                }
                return response.json();
            })
            .then(data => console.log("Sentiment Analysis Results:", data))
            .catch(error => console.error("Error:", error.message));
        });
    } else {
        console.error("Button with ID 'analyze' not found.");
    }
});
