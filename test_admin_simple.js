// Simple test script to verify admin roles
const jwt = require('jsonwebtoken');
const https = require('https');

// Create test tokens
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('🧪 Testing Admin Role System\n');

// Test tokens
const adminCreateUser = {
    userId: 'test-user-id-123',
    email: 'pushpshar1@gmail.com',
    role: 'admin-create',
    isAdmin: true
};

const fullAdminUser = {
    userId: 'test-admin-id-456', 
    email: 'admin@example.com',
    role: 'admin',
    isAdmin: true
};

const adminCreateToken = jwt.sign(adminCreateUser, JWT_SECRET);
const fullAdminToken = jwt.sign(fullAdminUser, JWT_SECRET);

console.log('📋 Generated Test Tokens:');
console.log('✅ Admin-create token for pushpshar1@gmail.com');
console.log('✅ Full admin token for admin@example.com\n');

console.log('🔧 Manual Testing Commands:\n');

console.log('1️⃣  Test user info endpoint (admin-create):');
console.log(`curl -k -H "Authorization: Bearer ${adminCreateToken}" https://localhost:5000/api/admin/user-info\n`);

console.log('2️⃣  Test user info endpoint (full admin):');
console.log(`curl -k -H "Authorization: Bearer ${fullAdminToken}" https://localhost:5000/api/admin/user-info\n`);

console.log('3️⃣  Test create artist (admin-create - should work):');
console.log(`curl -k -X POST -H "Authorization: Bearer ${adminCreateToken}" -H "Content-Type: application/json" -d "{\\"displayName\\":\\"Test Artist\\",\\"bio\\":\\"Test\\",\\"artistType\\":\\"musician\\",\\"price\\":1000,\\"location\\":\\"Test City\\"}" https://localhost:5000/api/admin/create-artist\n`);

console.log('4️⃣  Test delete profile (admin-create - should fail with 403):');
console.log(`curl -k -X DELETE -H "Authorization: Bearer ${adminCreateToken}" https://localhost:5000/api/profiles/test-id\n`);

console.log('5️⃣  Test delete profile (full admin - should work but return 404):');
console.log(`curl -k -X DELETE -H "Authorization: Bearer ${fullAdminToken}" https://localhost:5000/api/profiles/test-id\n`);

console.log('📝 Expected Results:');
console.log('• User info should return role: "admin-create" for pushpshar1@gmail.com');
console.log('• User info should return role: "admin" for admin@example.com');
console.log('• Create artist should work for both roles');
console.log('• Delete should return 403 for admin-create');
console.log('• Delete should return 404 (profile not found) for full admin\n');

console.log('🎯 Key Test: Admin-create role restrictions are working if delete returns 403 Forbidden');