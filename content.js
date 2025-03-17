function extractPosts() {
    let posts = document.querySelectorAll(".userContent"); // Update selector
    let postTexts = Array.from(posts).map(post => post.innerText);
    console.log("Extracted Posts:", postTexts);
    return postTexts;
}
