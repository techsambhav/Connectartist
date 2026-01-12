@echo off
echo 🧪 Testing Admin Role System
echo.

echo 📋 Test 1: Testing admin-create user info
curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQtMTIzIiwiZW1haWwiOiJwdXNocHNoYXIxQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbi1jcmVhdGUiLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE3NTgzNTQ5MTZ9.U-0BIywDXKzoxdOPhKrhvR49jT7faVP5QB8y3EdJ0LY" http://localhost:3000/api/admin/user-info
echo.
echo.

echo 📋 Test 2: Testing full admin user info
curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LWFkbWluLWlkLTQ1NiIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE3NTgzNTQ5MTZ9._710KMgOhGdjQy2ghKnH-8ChIYSz5idCFuuOFWmv3OY" http://localhost:3000/api/admin/user-info
echo.
echo.

echo 📋 Test 3: Testing delete with admin-create (should fail)
curl -s -X DELETE -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQtMTIzIiwiZW1haWwiOiJwdXNocHNoYXIxQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbi1jcmVhdGUiLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE3NTgzNTQ5MTZ9.U-0BIywDXKzoxdOPhKrhvR49jT7faVP5QB8y3EdJ0LY" http://localhost:3000/api/profiles/test-id
echo.
echo.

echo 📋 Test 4: Testing delete with full admin (should work but 404)
curl -s -X DELETE -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LWFkbWluLWlkLTQ1NiIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE3NTgzNTQ5MTZ9._710KMgOhGdjQy2ghKnH-8ChIYSz5idCFuuOFWmv3OY" http://localhost:3000/api/profiles/test-id
echo.
echo.

echo ✅ Testing completed!
pause