// Check what the working route returns for our artist
async function checkWorkingRoute() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGJkZTFmYmNkMmU5MzA1OWVhMzEyZDUiLCJlbWFpbCI6ImFydGlzdEB0ZXN0LmNvbSIsInJvbGUiOiJhcnRpc3QiLCJzZXNzaW9uUm9sZSI6ImFydGlzdCIsImlhdCI6MTc1ODI5NTgxNCwiZXhwIjoxNzU4OTAwNjE0fQ.OouCcVwT-LjJ_SHMH-i5HudoGn9Cmo9XiIzQM_lU7jI';
    
    try {
        console.log('Testing working /api/bookings route...');
        const response = await fetch('http://localhost:3000/api/bookings', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Total bookings found:', data.bookings?.length || 0);
            
            // Filter for our artist
            const artistBookings = data.bookings?.filter(b => 
                String(b.artistId) === '68bde1fbcd2e93059ea312d5'
            ) || [];
            
            console.log('Bookings for our test artist:', artistBookings.length);
            
            if (artistBookings.length > 0) {
                console.log('Sample artist booking:');
                console.log(JSON.stringify(artistBookings[0], null, 2));
            }
        } else {
            console.log('Error:', response.status, await response.text());
        }
        
    } catch (error) {
        console.error('Request failed:', error.message);
    }
}

checkWorkingRoute();