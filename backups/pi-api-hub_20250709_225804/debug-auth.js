const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Test 1: Check if users.json exists
console.log('1. Checking users.json...');
const usersPath = path.join(__dirname, 'data', 'users.json');
console.log('Path:', usersPath);
console.log('Exists:', fs.existsSync(usersPath));

if (fs.existsSync(usersPath)) {
  // Test 2: Load user data
  console.log('2. Loading user data...');
  const userData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  console.log('Users loaded:', Object.keys(userData));
  
  // Test 3: Check admin user
  console.log('3. Checking admin user...');
  const adminUser = userData.admin;
  console.log('Admin user exists:', !!adminUser);
  console.log('Admin password hash:', adminUser?.password?.substring(0, 20) + '...');
  
  // Test 4: Test password verification
  console.log('4. Testing password verification...');
  if (adminUser) {
    const isValid = bcrypt.compareSync('admin123', adminUser.password);
    console.log('Password verification result:', isValid);
  }
} else {
  console.log('ERROR: users.json file not found!');
}