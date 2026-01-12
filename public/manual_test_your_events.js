// Manual test script to trigger YOUR EVENTS functionality
// This script sets up authentication and manually calls the load function

console.log('🧪 Manual YOUR EVENTS Test');

// Set authentication data
const artistId = '68b917970861b56e3644d863';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGI5MTc5NzA4NjFiNTZlMzY0NGQ4NjMiLCJyb2xlIjoiYXJ0aXN0IiwiaWF0IjoxNzU4MzA5MzgyLCJleHAiOjE3NTgzMTI5ODJ9.e1k3E3Ex3WhEIktmwzOTAgFHEXxxSbSQNAvoe4WXbUk';

localStorage.setItem('token', token);
localStorage.setItem('userId', artistId);

console.log('✅ Set authentication data:');
console.log('  Token:', localStorage.getItem('token') ? 'Set' : 'Not set');
console.log('  User ID:', localStorage.getItem('userId'));

// Navigate to the artist profile page (if not already there)
const currentUrl = window.location.href;
const targetUrl = `${window.location.origin}/card.html?id=${artistId}`;

if (!currentUrl.includes(`card.html?id=${artistId}`)) {
    console.log('🔄 Navigating to artist profile page...');
    window.location.href = targetUrl;
} else {
    console.log('✅ Already on artist profile page');
    
    // Check if the YOUR EVENTS script is loaded
    setTimeout(() => {
        console.log('🔍 Checking YOUR EVENTS section...');
        
        const wrapper = document.getElementById('yourEventsSection');
        const eventsWrapper = document.getElementById('yourEventsWrapper');
        
        console.log('DOM Elements:');
        console.log('  yourEventsSection:', !!wrapper);
        console.log('  yourEventsWrapper:', !!eventsWrapper);
        
        if (eventsWrapper) {
            console.log('  Current display:', eventsWrapper.style.display);
            // Manually show the section for testing
            eventsWrapper.style.display = 'block';
            console.log('  ✅ Manually showed the section');
        }
        
        if (wrapper) {
            console.log('  Current content:', wrapper.innerHTML.substring(0, 100) + '...');
        }
        
        // Try to manually trigger the YOUR EVENTS function if available
        if (typeof window.loadArtistBookings === 'function') {
            console.log('🚀 Manually triggering loadArtistBookings...');
            window.loadArtistBookings(artistId);
        } else {
            console.log('⚠️ loadArtistBookings function not available globally');
        }
        
    }, 2000);
}