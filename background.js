chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.username && request.posts) {
        fetch("http://127.0.0.1:8000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: request.username, posts: request.posts })
        })
        .then(response => response.json())
        .then(data => console.log("Sentiment Analysis:", data))
        .catch(error => console.error("Error:", error));
    }
});
