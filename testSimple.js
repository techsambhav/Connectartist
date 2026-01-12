// Direct test without axios - using fetch to avoid dependencies issues
async function testWithFetch() {
    const artistId = '68bde1fbcd2e93059ea312d5';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGJkZTFmYmNkMmU5MzA1OWVhMzEyZDUiLCJlbWFpbCI6ImFydGlzdEB0ZXN0LmNvbSIsInJvbGUiOiJhcnRpc3QiLCJzZXNzaW9uUm9sZSI6ImFydGlzdCIsImlhdCI6MTc1ODI5NTgxNCwiZXhwIjoxNzU4OTAwNjE0fQ.OouCcVwT-LjJ_SHMH-i5HudoGn9Cmo9XiIzQM_lU7jI';
    
    try {
        console.log('Testing HTTP endpoint...');
        const response = await fetch(`http://localhost:3000/api/bookings/artist/${artistId}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response status text:', response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Success! Response data:', JSON.stringify(data, null, 2));
        } else {
            const errorData = await response.text();
            console.log('Error response:', errorData);
        }
        
    } catch (error) {
        console.error('Request failed:', error.message);
    }
}

// Use Node's global fetch if available, or require node-fetch
if (typeof fetch === 'undefined') {
    console.log('Fetch not available, please install node-fetch: npm install node-fetch');
    process.exit(1);
}

testWithFetch();