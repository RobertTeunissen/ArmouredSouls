const axios = require('axios');

async function testAPIResponse() {
  try {
    // You'll need to replace this with a valid token from your browser
    const token = process.argv[2];
    
    if (!token) {
      console.log('Usage: node test-api-response.js <your-auth-token>');
      console.log('\nTo get your token:');
      console.log('1. Open browser dev tools (F12)');
      console.log('2. Go to Application/Storage > Local Storage');
      console.log('3. Copy the value of "token"');
      return;
    }

    const response = await axios.get('http://localhost:3001/api/matches/history?page=1&perPage=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n=== API Response Sample ===\n');
    console.log('Total battles:', response.data.pagination.total);
    console.log('\nFirst 3 battles:\n');
    
    response.data.data.slice(0, 3).forEach((battle, index) => {
      console.log(`Battle ${index + 1}:`);
      console.log(`  ID: ${battle.id}`);
      console.log(`  Type: ${battle.battleType}`);
      console.log(`  leagueType: "${battle.leagueType}" ${battle.leagueType ? '✓' : '✗ MISSING'}`);
      console.log(`  Winner reward: ${battle.winnerReward}`);
      console.log(`  Loser reward: ${battle.loserReward}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAPIResponse();
