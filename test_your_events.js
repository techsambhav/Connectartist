// Test script to verify YOUR EVENTS functionality
// Run this in the browser console on the artist profile page

console.log('🧪 Testing YOUR EVENTS functionality...');

// Test 1: Check if we have the artist ID in URL
const artistId = new URLSearchParams(window.location.search).get('id');
console.log('1. Artist ID from URL:', artistId);

// Test 2: Check authentication
const token = localStorage.getItem('token');
const userId = localStorage.getItem('userId');
console.log('2. Authentication:', {
    hasToken: !!token,
    userId: userId,
    isOwner: String(userId) === String(artistId)
});

// Test 3: Check if DOM elements exist
const wrapper = document.getElementById('yourEventsSection');
const eventsWrapper = document.getElementById('yourEventsWrapper');
console.log('3. DOM elements:', {
    hasWrapper: !!wrapper,
    hasEventsWrapper: !!eventsWrapper,
    wrapperDisplay: eventsWrapper ? eventsWrapper.style.display : 'N/A'
});

// Test 4: Simulate API call to check booking data
if (token && artistId) {
    fetch(`/api/bookings/artist/${encodeURIComponent(artistId)}`, {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => {
        console.log('4. API Response Status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('4. API Response Data:', data);
        if (data.bookings) {
            console.log(`✅ Found ${data.bookings.length} booking(s) for artist ${artistId}`);
            data.bookings.forEach((booking, index) => {
                console.log(`   Booking ${index + 1}:`, {
                    id: booking._id,
                    organizer: booking.organizerName,
                    date: booking.eventDate,
                    price: booking.price,
                    status: booking.status
                });
            });
        }
    })
    .catch(error => {
        console.error('4. API Error:', error);
    });
} else {
    console.log('4. Skipping API test - missing token or artistId');
}

// Test 5: Check if YOUR EVENTS section is visible
setTimeout(() => {
    const eventsSection = document.getElementById('yourEventsWrapper');
    if (eventsSection) {
        const isVisible = eventsSection.style.display !== 'none';
        console.log('5. YOUR EVENTS visibility:', {
            display: eventsSection.style.display,
            isVisible: isVisible,
            content: document.getElementById('yourEventsSection')?.innerHTML?.substring(0, 100) + '...'
        });
    }
}, 2000);

console.log('🧪 Test script completed. Check console for results.');