const fetch = require('node-fetch');

// Test admin role functionality
async function testAdminRoles() {
    const baseUrl = 'https://localhost:5000';
    
    console.log('🧪 Testing Admin Role System\n');
    
    // Test 1: Create a test token for pushpshar1@gmail.com (admin-create)
    console.log('📋 Test 1: Creating test admin-create token for pushpshar1@gmail.com');
    
    // We'll simulate the JWT payload that would be created during Google OAuth
    const jwt = require('jsonwebtoken');
    const adminCreateUser = {
        userId: 'test-user-id-123',
        email: 'pushpshar1@gmail.com',
        role: 'admin-create',
        isAdmin: true
    };
    
    const adminCreateToken = jwt.sign(adminCreateUser, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Admin-create token created');
    
    // Test 2: Create a test token for full admin
    const fullAdminUser = {
        userId: 'test-admin-id-456',
        email: 'admin@example.com',
        role: 'admin',
        isAdmin: true
    };
    
    const fullAdminToken = jwt.sign(fullAdminUser, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Full admin token created\n');
    
    // Test 3: Test user info endpoint
    console.log('📋 Test 2: Testing user info endpoint');
    try {
        console.log('Testing admin-create user info...');
        const createUserRes = await fetch(`${baseUrl}/api/admin/user-info`, {
            headers: { 
                'Authorization': `Bearer ${adminCreateToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (createUserRes.ok) {
            const createUserData = await createUserRes.json();
            console.log('✅ Admin-create user info:', createUserData);
        } else {
            console.log('❌ Admin-create user info failed:', createUserRes.status);
        }
        
        console.log('Testing full admin user info...');
        const adminUserRes = await fetch(`${baseUrl}/api/admin/user-info`, {
            headers: { 
                'Authorization': `Bearer ${fullAdminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (adminUserRes.ok) {
            const adminUserData = await adminUserRes.json();
            console.log('✅ Full admin user info:', adminUserData);
        } else {
            console.log('❌ Full admin user info failed:', adminUserRes.status);
        }
    } catch (err) {
        console.log('❌ User info test error:', err.message);
    }
    
    console.log('\n📋 Test 3: Testing create permissions (both should work)');
    
    // Test create artist endpoint for both roles
    const testArtistData = {
        displayName: 'Test Artist Role Check',
        bio: 'Testing role permissions',
        artistType: 'musician',
        price: 1000,
        location: 'Test City'
    };
    
    try {
        // Test admin-create role
        console.log('Testing admin-create create permissions...');
        const createRes1 = await fetch(`${baseUrl}/api/admin/create-artist`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${adminCreateToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testArtistData)
        });
        
        if (createRes1.ok) {
            const createData1 = await createRes1.json();
            console.log('✅ Admin-create can create artists');
        } else {
            console.log('❌ Admin-create create failed:', createRes1.status);
            const errorData = await createRes1.text();
            console.log('Error:', errorData);
        }
        
        // Test full admin role
        console.log('Testing full admin create permissions...');
        const createRes2 = await fetch(`${baseUrl}/api/admin/create-artist`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${fullAdminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({...testArtistData, displayName: 'Test Artist Full Admin'})
        });
        
        if (createRes2.ok) {
            const createData2 = await createRes2.json();
            console.log('✅ Full admin can create artists');
        } else {
            console.log('❌ Full admin create failed:', createRes2.status);
        }
    } catch (err) {
        console.log('❌ Create test error:', err.message);
    }
    
    console.log('\n📋 Test 4: Testing delete permissions (only full admin should work)');
    
    // Test delete profile endpoint
    try {
        // Try delete with admin-create (should fail)
        console.log('Testing admin-create delete permissions (should fail)...');
        const deleteRes1 = await fetch(`${baseUrl}/api/profiles/test-profile-id`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${adminCreateToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (deleteRes1.status === 403) {
            console.log('✅ Admin-create correctly blocked from deleting');
        } else {
            console.log('❌ Admin-create delete restriction failed:', deleteRes1.status);
        }
        
        // Try delete with full admin (should work, but profile might not exist)
        console.log('Testing full admin delete permissions...');
        const deleteRes2 = await fetch(`${baseUrl}/api/profiles/test-profile-id`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${fullAdminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (deleteRes2.status === 404) {
            console.log('✅ Full admin has delete permissions (profile not found is expected)');
        } else if (deleteRes2.status === 200) {
            console.log('✅ Full admin successfully deleted profile');
        } else {
            console.log('❌ Full admin delete failed unexpectedly:', deleteRes2.status);
        }
    } catch (err) {
        console.log('❌ Delete test error:', err.message);
    }
    
    console.log('\n🎉 Admin role testing completed!');
}

// Run the tests
testAdminRoles().catch(console.error);