const axios = require('axios');

async function testAppearanceEndpoint() {
  try {
    // First, login to get a token
    console.log('1. Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'player1',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful');

    // Get user's robots
    console.log('\n2. Fetching robots...');
    const robotsResponse = await axios.get('http://localhost:3001/api/robots', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const robots = robotsResponse.data;
    if (robots.length === 0) {
      console.log('✗ No robots found for this user');
      return;
    }
    
    const robot = robots[0];
    console.log(`✓ Found robot: ${robot.name} (ID: ${robot.id})`);
    console.log(`  Current imageUrl: ${robot.imageUrl || 'null'}`);

    // Test updating appearance
    console.log('\n3. Testing appearance update...');
    const testImageUrl = '/src/assets/robots/robot-chassis-humanoid-red.webp';
    console.log(`  Sending imageUrl: ${testImageUrl}`);
    
    const updateResponse = await axios.put(
      `http://localhost:3001/api/robots/${robot.id}/appearance`,
      { imageUrl: testImageUrl },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✓ Update successful!');
    console.log('  Response:', JSON.stringify(updateResponse.data, null, 2));

    // Verify the update
    console.log('\n4. Verifying update...');
    const verifyResponse = await axios.get(`http://localhost:3001/api/robots/${robot.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`✓ Verified imageUrl: ${verifyResponse.data.imageUrl}`);
    
    if (verifyResponse.data.imageUrl === testImageUrl) {
      console.log('\n✅ TEST PASSED: Appearance endpoint is working correctly!');
    } else {
      console.log('\n❌ TEST FAILED: imageUrl mismatch');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Error:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
  }
}

testAppearanceEndpoint();
