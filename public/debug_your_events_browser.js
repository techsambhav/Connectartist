// Browser debugging script for YOUR EVENTS functionality
// Paste this in the browser console on the artist profile page

console.log('🔍 YOUR EVENTS Debug Script Started');

async function debugYourEvents() {
    // 1. Check URL and artist ID
    const artistId = new URLSearchParams(window.location.search).get('id');
    console.log('1. Artist ID from URL:', artistId);

    // 2. Check authentication
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    console.log('2. Authentication:', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        userId: userId,
        userIdType: typeof userId
    });

    // 3. Test /api/auth/me endpoint
    if (token) {
        try {
            console.log('3. Testing /api/auth/me...');
            const authResponse = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            console.log('   Auth status:', authResponse.status);
            if (authResponse.ok) {
                const authData = await authResponse.json();
                console.log('   Auth data:', authData);
            } else {
                const errorText = await authResponse.text();
                console.log('   Auth error:', errorText);
            }
        } catch (error) {
            console.error('   Auth request failed:', error);
        }
    } else {
        console.log('3. Skipping auth test - no token');
    }

    // 4. Check DOM elements
    console.log('4. DOM Elements:');
    const wrapper = document.getElementById('yourEventsSection');
    const eventsWrapper = document.getElementById('yourEventsWrapper');
    console.log('   yourEventsSection:', !!wrapper);
    console.log('   yourEventsWrapper:', !!eventsWrapper);
    if (eventsWrapper) {
        console.log('   eventsWrapper display:', eventsWrapper.style.display);
        console.log('   eventsWrapper visibility:', getComputedStyle(eventsWrapper).display);
    }

    // 5. Test API endpoint
    if (token && artistId) {
        try {
            console.log('5. Testing /api/bookings/artist/' + artistId + '...');
            const bookingsResponse = await fetch(`/api/bookings/artist/${encodeURIComponent(artistId)}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            console.log('   Bookings status:', bookingsResponse.status);
            if (bookingsResponse.ok) {
                const bookingsData = await bookingsResponse.json();
                console.log('   Bookings data:', bookingsData);
                console.log('   Bookings count:', bookingsData.bookings ? bookingsData.bookings.length : 0);
            } else {
                const errorText = await bookingsResponse.text();
                console.log('   Bookings error:', errorText);
            }
        } catch (error) {
            console.error('   Bookings request failed:', error);
        }
    } else {
        console.log('5. Skipping bookings test - missing token or artistId');
    }

    // 6. Check current wrapper content
    if (wrapper) {
        console.log('6. Current wrapper content:', wrapper.innerHTML.substring(0, 200) + '...');
    }

    console.log('🔍 Debug complete!');
}

debugYourEvents();