document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const analyzeButton = document.getElementById("analyze");
  const viewResultsButton = document.getElementById("view-results");
  const openSettingsButton = document.getElementById("open-settings");
  const closeSettingsButton = document.getElementById("close-settings");
  const settingsModal = document.getElementById("settings-modal");
  const facebookTokenInput = document.getElementById("facebook-token");
  const toggleTokenVisibilityButton = document.getElementById("toggle-token-visibility");
  const validateTokenButton = document.getElementById("validate-token");
  const clearTokenButton = document.getElementById("clear-token");
  const tokenStatusDiv = document.getElementById("token-status");
  const extensionIdDisplay = document.getElementById("extension-id-display");
  const loading = document.getElementById("loading");
  const dashboard = document.getElementById("dashboard");
  const errorMessage = document.getElementById("error-message");
  const chartError = document.getElementById("chart-error");

  // Dashboard elements
  const totalPostsEl = document.getElementById("total-posts");
  const overallSentimentEl = document.getElementById("overall-sentiment");
  const latestDateEl = document.getElementById("latest-date");
  const userDisplayEl = document.getElementById("user-display");
  const postsTableBody = document.getElementById("posts-table").querySelector("tbody");

  // Chart elements
  const distributionChartEl = document.getElementById("distribution-chart");
  const trendChartEl = document.getElementById("trend-chart");
  const distributionFallbackEl = document.getElementById("distribution-fallback");
  const trendFallbackEl = document.getElementById("trend-fallback");

  // Chart instances
  let sentimentDistributionChart = null;
  let sentimentTrendChart = null;

  // Auto-detect extension ID
  const extensionId = chrome.runtime.id;
  
  // API endpoints
  const API_BASE_URL = "http://127.0.0.1:8000";
  const ANALYZE_ENDPOINT = `${API_BASE_URL}/fetch-analyze`;
  const GET_RESULTS_ENDPOINT = `${API_BASE_URL}/get-sentiment-results`;
  const VALIDATE_TOKEN_ENDPOINT = `${API_BASE_URL}/validate-token`;

  // Storage keys
  const FACEBOOK_TOKEN_KEY = "facebook_access_token";
  const FACEBOOK_USERNAME_KEY = "facebook_username";
  
  // Initialize - Display extension ID and load saved token
  if (extensionIdDisplay) {
    extensionIdDisplay.textContent = extensionId;
  }
  
  // Load saved token from storage
  loadSavedToken();
  
  // Settings event listeners
  if (openSettingsButton) {
    openSettingsButton.addEventListener("click", openSettings);
  }
  
  if (closeSettingsButton) {
    closeSettingsButton.addEventListener("click", closeSettings);
  }
  
  if (toggleTokenVisibilityButton) {
    toggleTokenVisibilityButton.addEventListener("click", toggleTokenVisibility);
  }
  
  if (validateTokenButton) {
    validateTokenButton.addEventListener("click", validateAndSaveToken);
  }
  
  if (clearTokenButton) {
    clearTokenButton.addEventListener("click", clearToken);
  }

  // Check if Chart.js is available
  const isChartAvailable = function () {
    return typeof Chart !== "undefined";
  };

  // Event Listeners for main functionality
  if (analyzeButton) {
    analyzeButton.addEventListener("click", analyzePosts);
  }

  if (viewResultsButton) {
    viewResultsButton.addEventListener("click", fetchAndDisplayResults);
  }

  // Initialize - Check if we have results to display
  fetchAndDisplayResults();
  
  // Settings functions
  function openSettings() {
    if (settingsModal) {
      settingsModal.classList.remove("hidden");
    }
  }
  
  function closeSettings() {
    if (settingsModal) {
      settingsModal.classList.add("hidden");
    }
  }
  
  function toggleTokenVisibility() {
    if (facebookTokenInput) {
      if (facebookTokenInput.type === "password") {
        facebookTokenInput.type = "text";
        toggleTokenVisibilityButton.textContent = "Hide";
      } else {
        facebookTokenInput.type = "password";
        toggleTokenVisibilityButton.textContent = "Show";
      }
    }
  }
  
  function loadSavedToken() {
    chrome.storage.sync.get([FACEBOOK_TOKEN_KEY], function(result) {
      if (result[FACEBOOK_TOKEN_KEY] && facebookTokenInput) {
        facebookTokenInput.value = result[FACEBOOK_TOKEN_KEY];
        showTokenStatus("Token loaded from storage", "status-success");
      }
    });
  }
  
  async function validateAndSaveToken() {
    const token = facebookTokenInput.value.trim();
    
    if (!token) {
      showTokenStatus("Please enter a Facebook access token", "status-error");
      return;
    }
    
    try {
      showTokenStatus("Validating token...", "status-warning");
      
      // Make a validation request to our backend
      const response = await fetch(VALIDATE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token: token,
          extension_id: extensionId 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Token validation failed");
      }
      
      // If we got here, the token is valid
      // Save the token to Chrome storage
      chrome.storage.sync.set({ 
        [FACEBOOK_TOKEN_KEY]: token,
        [FACEBOOK_USERNAME_KEY]: data.name // Save the username from the validation response
      }, function() {
        showTokenStatus(`Token validated and saved successfully for ${data.name}!`, "status-success");
      });
      
    } catch (error) {
      showTokenStatus(`Token validation failed: ${error.message}`, "status-error");
    }
  }
  
  function clearToken() {
    chrome.storage.sync.remove([FACEBOOK_TOKEN_KEY, FACEBOOK_USERNAME_KEY], function() {
      if (facebookTokenInput) {
        facebookTokenInput.value = "";
      }
      showTokenStatus("Token and username cleared", "status-warning");
    });
  }
  
  function showTokenStatus(message, className) {
    if (tokenStatusDiv) {
      tokenStatusDiv.textContent = message;
      tokenStatusDiv.className = "status-message " + className;
      tokenStatusDiv.classList.remove("hidden");
      
      // Hide the status after 5 seconds
      setTimeout(() => {
        tokenStatusDiv.classList.add("hidden");
      }, 5000);
    }
  }
  
  // Get token from storage
  async function getStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([FACEBOOK_TOKEN_KEY], function(result) {
        resolve(result[FACEBOOK_TOKEN_KEY] || null);
      });
    });
  }

  // Get username from storage
  async function getStoredUsername() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([FACEBOOK_USERNAME_KEY], function(result) {
        resolve(result[FACEBOOK_USERNAME_KEY] || null);
      });
    });
  }

  // Check if token and username are available
  async function checkTokenAvailability() {
    const token = await getStoredToken();
    const username = await getStoredUsername();
    
    if (!token) {
      showError("Facebook access token not found. Please add your token in the Settings.");
      openSettings();
      return false;
    }
    
    if (!username) {
      showError("Facebook username not found. Please re-validate your token in Settings.");
      openSettings();
      return false;
    }
    
    return true;
  }

  // Functions
  // Updated analyzePosts function to send token and extension ID
  async function analyzePosts() {
    try {
      // Check if token is available
      if (!await checkTokenAvailability()) {
        return;
      }
      
      showLoading();
      hideError();
      
      // Get token from storage
      const token = await getStoredToken();
      
      const response = await fetch(ANALYZE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facebook_token: token,
          extension_id: extensionId
        })
      });
      
      // Parse the response body
      const data = await response.json();
      
      if (!response.ok) {
        // Extract the detailed error message
        const errorDetail = data.detail || "Failed to analyze posts";
        throw new Error(errorDetail);
      }
      
      console.log("Sentiment Analysis Results:", data);
      
      // Check if we have a message about no new posts
      if (data.message && data.message.includes("No new posts")) {
        // Show a message to the user
        showMessage("No new posts to analyze. All your recent posts have already been analyzed.");
      } else {
        // Show success message
        if (data.message) {
          showMessage(data.message);
        }
        
        // After analysis, fetch and display the updated results
        await fetchAndDisplayResults();
      }
    } catch (error) {
      console.error("Error:", error.message);
      
      // Display user-friendly error message with potential solutions
      let errorMessage = error.message;
      let solutionMessage = "";
      
      // Add helpful solutions based on error message content
      if (errorMessage.includes("access token is invalid or expired")) {
        solutionMessage = "<br><br>Please check your Facebook token in the Settings and ensure it's valid and not expired.";
      } else if (errorMessage.includes("permission")) {
        solutionMessage = "<br><br>Please ensure your Facebook token has the necessary permissions (user_posts).";
      }
      
      showError(errorMessage + solutionMessage);
    } finally {
      hideLoading();
    }
  }

  // Add a new function to show generic messages (not errors)
  function showMessage(message) {
    // You might want to add a message div to your HTML, or reuse the error div
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.innerHTML = `<p>${message}</p>`;
    
    // Add the message to the container
    const container = document.querySelector('.container');
    
    // Remove any existing message
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Insert the message after the actions div
    const actionsDiv = document.querySelector('.actions');
    if (actionsDiv && container) {
      container.insertBefore(messageEl, actionsDiv.nextSibling);
    }
    
    // Auto-hide the message after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 5000);
  }

  // Update the showError function to handle HTML content
  function showError(message) {
    showElement(errorMessage);
    const errorParagraph = errorMessage.querySelector("p");
    if (errorParagraph) {
      errorParagraph.innerHTML =
        message || "An error occurred. Please try again.";
    }
  }

  // Updated fetchAndDisplayResults function to send username for filtering
  async function fetchAndDisplayResults() {
    try {
      // For viewing results, we need both token and username
      const token = await getStoredToken();
      const username = await getStoredUsername();
      
      if (!token || !username) {
        showMessage("Facebook account information not found. Please validate your token in Settings.");
        openSettings();
        return;
      }
      
      showLoading();
      hideError();

      // Include username as a query parameter
      const response = await fetch(`${GET_RESULTS_ENDPOINT}?username=${encodeURIComponent(username)}`, {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "X-Extension-ID": extensionId
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch sentiment results");
      }

      const data = await response.json();
      console.log("Fetched Sentiment Results:", data);

      // Update the dashboard with the fetched data
      updateDashboard(data);
      showDashboard();
    } catch (error) {
      console.error("Error:", error.message);
      showError(error.message);
    } finally {
      hideLoading();
    }
  }

  function updateDashboard(data) {
    if (!data || !data.posts || data.posts.length === 0) {
      showError("No sentiment data available. Try analyzing your posts first.");
      return;
    }

    const { posts, stats, username } = data;

    // Update user display
    if (userDisplayEl) {
      userDisplayEl.textContent = username;
    }

    // Update summary cards
    totalPostsEl.textContent = stats.totalPosts;
    overallSentimentEl.textContent = stats.overallSentiment;

    // Format the latest analysis date
    if (stats.latestAnalysis) {
      latestDateEl.textContent = formatDate(stats.latestAnalysis);
    } else {
      latestDateEl.textContent = "Not available";
    }

    // Update recent posts table
    updatePostsTable(posts);

    // Update charts if Chart.js is available
    if (isChartAvailable()) {
      hideElement(chartError);
      updateDistributionChart(stats.distribution);
      updateTrendChart(stats.trend);
    } else {
      console.warn("Chart.js is not available. Using fallback visualization.");
      showElement(chartError);
      updateDistributionFallback(stats.distribution);
      updateTrendFallback(stats.trend);
    }
  }

  function updatePostsTable(posts) {
    // Clear existing rows
    postsTableBody.innerHTML = "";

    // Add new rows (limit to 5 most recent)
    posts.slice(0, 5).forEach((post) => {
      const row = document.createElement("tr");

      // Get sentiment value - matches your table structure
      const sentiment = post.sentiment || "Unknown";

      // Determine row class based on sentiment (lowercase for CSS)
      const sentimentClass = sentiment.toLowerCase();
      row.className = `sentiment-${sentimentClass}`;

      // Create table cells
      const dateCell = document.createElement("td");
      dateCell.textContent = post.timestamp
        ? formatDate(post.timestamp)
        : "N/A";

      const contentCell = document.createElement("td");
      contentCell.className = "post-content";
      contentCell.textContent = truncateText(post.content, 50);

      const sentimentCell = document.createElement("td");
      sentimentCell.textContent = sentiment;
      sentimentCell.className = `sentiment ${sentimentClass}`;

      // Append cells to row
      row.appendChild(dateCell);
      row.appendChild(contentCell);
      row.appendChild(sentimentCell);

      // Append row to table body
      postsTableBody.appendChild(row);
    });
  }

  function updateDistributionChart(distribution) {
    try {
      // Ensure Chart is defined before proceeding
      if (!isChartAvailable()) {
        updateDistributionFallback(distribution);
        return;
      }

      // Destroy existing chart if it exists
      if (sentimentDistributionChart) {
        sentimentDistributionChart.destroy();
      }

      // Get the canvas context
      const ctx = distributionChartEl.getContext("2d");
      if (!ctx) {
        console.error("Could not get canvas context for distribution chart");
        updateDistributionFallback(distribution);
        return;
      }

      // Create new chart
      sentimentDistributionChart = new Chart(ctx, {
        type: "pie",
        data: {
          labels: ["Positive", "Neutral", "Negative"],
          datasets: [
            {
              data: [
                distribution.positive,
                distribution.neutral,
                distribution.negative,
              ],
              backgroundColor: [
                "#4CAF50", // Green for positive
                "#2196F3", // Blue for neutral
                "#F44336", // Red for negative
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || "";
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage =
                    total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value} (${percentage}%)`;
                },
              },
            },
          },
        },
      });

      // Hide fallback if chart was successfully created
      hideElement(distributionFallbackEl);
    } catch (error) {
      console.error("Error creating distribution chart:", error);
      updateDistributionFallback(distribution);
    }
  }

  function updateTrendChart(trend) {
    try {
      // Ensure Chart is defined before proceeding
      if (!isChartAvailable()) {
        updateTrendFallback(trend);
        return;
      }

      // Extract dates and sentiment counts
      const dates = trend.map((item) => formatShortDate(item.date));
      const positiveData = trend.map((item) => item.positive);
      const neutralData = trend.map((item) => item.neutral);
      const negativeData = trend.map((item) => item.negative);

      // Destroy existing chart if it exists
      if (sentimentTrendChart) {
        sentimentTrendChart.destroy();
      }

      // Get the canvas context
      const ctx = trendChartEl.getContext("2d");
      if (!ctx) {
        console.error("Could not get canvas context for trend chart");
        updateTrendFallback(trend);
        return;
      }

      // Create new chart
      sentimentTrendChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: dates,
          datasets: [
            {
              label: "Positive",
              data: positiveData,
              borderColor: "#4CAF50",
              backgroundColor: "rgba(76, 175, 80, 0.1)",
              tension: 0.1,
              fill: true,
            },
            {
              label: "Neutral",
              data: neutralData,
              borderColor: "#2196F3",
              backgroundColor: "rgba(33, 150, 243, 0.1)",
              tension: 0.1,
              fill: true,
            },
            {
              label: "Negative",
              data: negativeData,
              borderColor: "#F44336",
              backgroundColor: "rgba(244, 67, 54, 0.1)",
              tension: 0.1,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: {
                display: true,
                text: "Date",
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Posts",
              },
            },
          },
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        },
      });

      // Hide fallback if chart was successfully created
      hideElement(trendFallbackEl);
    } catch (error) {
      console.error("Error creating trend chart:", error);
      updateTrendFallback(trend);
    }
  }

  function updateDistributionFallback(distribution) {
    // Show fallback element
    showElement(distributionFallbackEl);

    // Create a text-based visualization
    const total =
      distribution.positive + distribution.neutral + distribution.negative;
    const percentPositive =
      total > 0 ? Math.round((distribution.positive / total) * 100) : 0;
    const percentNeutral =
      total > 0 ? Math.round((distribution.neutral / total) * 100) : 0;
    const percentNegative =
      total > 0 ? Math.round((distribution.negative / total) * 100) : 0;

    distributionFallbackEl.innerHTML = `
            <div class="fallback-chart">
                <div class="fallback-item">
                    <span class="fallback-label">Positive:</span>
                    <span class="fallback-value">${distribution.positive} (${percentPositive}%)</span>
                    <div class="fallback-bar positive" style="width: ${percentPositive}%"></div>
                </div>
                <div class="fallback-item">
                    <span class="fallback-label">Neutral:</span>
                    <span class="fallback-value">${distribution.neutral} (${percentNeutral}%)</span>
                    <div class="fallback-bar neutral" style="width: ${percentNeutral}%"></div>
                </div>
                <div class="fallback-item">
                    <span class="fallback-label">Negative:</span>
                    <span class="fallback-value">${distribution.negative} (${percentNegative}%)</span>
                    <div class="fallback-bar negative" style="width: ${percentNegative}%"></div>
                </div>
            </div>
        `;
  }

  function updateTrendFallback(trend) {
    // Show fallback element
    showElement(trendFallbackEl);

    // Create a text-based trend visualization
    let fallbackHTML = '<div class="fallback-trend">';
    fallbackHTML +=
      '<table class="fallback-table"><thead><tr><th>Date</th><th>Positive</th><th>Neutral</th><th>Negative</th></tr></thead><tbody>';

    trend.forEach((item) => {
      fallbackHTML += `<tr>
                <td>${formatShortDate(item.date)}</td>
                <td class="positive">${item.positive}</td>
                <td class="neutral">${item.neutral}</td>
                <td class="negative">${item.negative}</td>
            </tr>`;
    });

    fallbackHTML += "</tbody></table></div>";
    trendFallbackEl.innerHTML = fallbackHTML;
  }

  // Utility functions
  function truncateText(text, maxLength) {
    if (!text) return "No content";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  function formatDate(dateString) {
    // Try to handle different date formats
    try {
      // If it's already a date object
      if (dateString instanceof Date) {
        return dateString.toLocaleDateString();
      }

      // If it has a T separator (ISO format)
      if (typeof dateString === "string" && dateString.includes("T")) {
        // Create a date object and explicitly format it in the local timezone
        const date = new Date(dateString);
        return date.toLocaleDateString();
      }

      // Try parsing as simple date
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      // Return as is if we can't parse it
      console.error("Error formatting date:", e);
      return dateString;
    }
  }

  function formatShortDate(dateString) {
    try {
      // For chart labels, we want a shorter format
      const date = new Date(dateString);
      // Use local timezone consistently
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      console.error("Error formatting short date:", e);
      return dateString;
    }
  }

  function showElement(element) {
    if (element) element.classList.remove("hidden");
  }

  function hideElement(element) {
    if (element) element.classList.add("hidden");
  }

  function showLoading() {
    showElement(loading);
  }

  function hideLoading() {
    hideElement(loading);
  }

  function showDashboard() {
    showElement(dashboard);
  }

  function hideDashboard() {
    hideElement(dashboard);
  }

  function hideError() {
    hideElement(errorMessage);
  }
});