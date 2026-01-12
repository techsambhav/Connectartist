const axios = require('axios');
const https = require('https');

// Create an HTTPS agent that ignores SSL certificate errors for local testing
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testArtistBookingsAPI() {
    const artistId = '68bde1fbcd2e93059ea312d5';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGJkZTFmYmNkMmU5MzA1OWVhMzEyZDUiLCJlbWFpbCI6ImFydGlzdEB0ZXN0LmNvbSIsInJvbGUiOiJhcnRpc3QiLCJzZXNzaW9uUm9sZSI6ImFydGlzdCIsImlhdCI6MTc1ODI5NTgxNCwiZXhwIjoxNzU4OTAwNjE0fQ.OouCcVwT-LjJ_SHMH-i5HudoGn9Cmo9XiIzQM_lU7jI';
    
    try {
        console.log('Testing HTTP endpoint...');
        const httpResponse = await axios.get(`http://localhost:3000/api/bookings/artist/${artistId}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
        
        console.log('HTTP Response Status:', httpResponse.status);
        console.log('HTTP Response Data:', JSON.stringify(httpResponse.data, null, 2));
        
    } catch (httpError) {
        console.log('HTTP endpoint failed:', httpError.message);
        if (httpError.response) {
            console.log('HTTP Error Response Status:', httpError.response.status);
            console.log('HTTP Error Response Data:', httpError.response.data);
        }
        
        try {
            console.log('\nTesting HTTPS endpoint...');
            const httpsResponse = await axios.get(`https://localhost:5000/api/bookings/artist/${artistId}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent,
                timeout: 5000
            });
            
            console.log('HTTPS Response Status:', httpsResponse.status);
            console.log('HTTPS Response Data:', JSON.stringify(httpsResponse.data, null, 2));
            
        } catch (httpsError) {
            console.log('HTTPS endpoint also failed:', httpsError.message);
            if (httpsError.response) {
                console.log('HTTPS Error Response Status:', httpsError.response.status);
                console.log('HTTPS Error Response Data:', httpsError.response.data);
            }
            
            // Check if server is running
            console.log('\nChecking server status...');
            try {
                const healthCheck = await axios.get('http://localhost:3000/', { timeout: 2000 });
                console.log('Server is responding to health check');
            } catch (healthError) {
                console.log('Server health check failed:', healthError.message);
            }
        }
    }
}

testArtistBookingsAPI();