// Chart.js loader with fallback mechanism
(function() {
    // Since we're using a local copy of Chart.js, we'll just ensure popup width is correct
    document.addEventListener('DOMContentLoaded', function() {
        // Force Chrome to recognize the width
        document.body.style.width = '800px';
        
        // Check if Chart.js failed to load
        setTimeout(function() {
            if (typeof Chart === 'undefined') {
                console.error('Failed to load Chart.js');
                const chartError = document.getElementById('chart-error');
                if (chartError) {
                    chartError.style.display = 'block';
                }
            }
        }, 1000); // Check after 1 second
    });
})();