// Test basic booking routes to see which ones work
async function testBasicRoutes() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGJkZTFmYmNkMmU5MzA1OWVhMzEyZDUiLCJlbWFpbCI6ImFydGlzdEB0ZXN0LmNvbSIsInJvbGUiOiJhcnRpc3QiLCJzZXNzaW9uUm9sZSI6ImFydGlzdCIsImlhdCI6MTc1ODI5NTgxNCwiZXhwIjoxNzU4OTAwNjE0fQ.OouCcVwT-LjJ_SHMH-i5HudoGn9Cmo9XiIzQM_lU7jI';
    
    const routes = [
        '/api/bookings',
        '/api/bookings/artist/68bde1fbcd2e93059ea312d5'
    ];
    
    for (const route of routes) {
        try {
            console.log(`\nTesting: ${route}`);
            const response = await fetch(`http://localhost:3000${route}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('SUCCESS:', data.success ? `Found ${data.bookings?.length || 0} bookings` : 'Response not success');
            } else {
                const errorData = await response.text();
                console.log('ERROR:', errorData);
            }
            
        } catch (error) {
            console.error('Request failed:', error.message);
        }
    }
}

testBasicRoutes();