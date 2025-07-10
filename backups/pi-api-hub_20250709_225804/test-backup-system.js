const axios = require('axios');

/**
 * 📦 SMART BANANA BACKUP SYSTEM TEST SCRIPT 📦
 * Test script to verify backup system functionality on Pi
 */

console.log('📦 Testing Smart Banana Backup System...');
console.log('=======================================');

// Configuration
const API_URL = 'http://localhost:3000';
const ADMIN_KEY = 'f00d268863ad4f08992aa8583d2b6ea96c65e649f206a9828334bbb3bbd8f7e7';

async function testBackupSystem() {
  console.log('\\n📦 Starting Backup System Tests...\\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Get backup statistics
  console.log('Test 1: Get Backup Statistics');
  try {
    const response = await axios.get(`${API_URL}/admin/backups/stats`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success && response.data.data.stats) {
      console.log('✅ Get backup stats: SUCCESS');
      const stats = response.data.data.stats;
      console.log(`   Total Backups: ${stats.totalBackups}`);
      console.log(`   Successful Backups: ${stats.successfulBackups}`);
      console.log(`   Failed Backups: ${stats.failedBackups}`);
      console.log(`   Scheduler Status: ${stats.isRunning ? 'Running' : 'Stopped'}`);
      console.log(`   Last Backup: ${stats.lastBackupTime ? new Date(stats.lastBackupTime).toLocaleString() : 'Never'}`);
      console.log(`   Total Backup Size: ${stats.formattedTotalBackupSize}`);
      testsPassed++;
    } else {
      console.log('❌ Get backup stats: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Get backup stats: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 2: List existing backups
  console.log('\\nTest 2: List Existing Backups');
  try {
    const response = await axios.get(`${API_URL}/admin/backups`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success && response.data.data.backups) {
      console.log('✅ List backups: SUCCESS');
      const backups = response.data.data.backups;
      console.log(`   Found ${backups.length} existing backups`);
      
      if (backups.length > 0) {
        console.log('   Recent backups:');
        backups.slice(0, 3).forEach((backup, index) => {
          console.log(`     ${index + 1}. ${backup.id} (${backup.formattedSize}) - ${new Date(backup.created).toLocaleString()}`);
        });
      }
      testsPassed++;
    } else {
      console.log('❌ List backups: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ List backups: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 3: Create new backup
  console.log('\\nTest 3: Create New Backup');
  try {
    console.log('   Creating backup (this may take a moment)...');
    const response = await axios.post(`${API_URL}/admin/backups`, {}, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      },
      timeout: 30000 // 30 second timeout for backup creation
    });
    
    if (response.data.success && response.data.data.backup) {
      console.log('✅ Create backup: SUCCESS');
      const backup = response.data.data.backup;
      console.log(`   Backup ID: ${backup.backupId}`);
      console.log(`   Backup Size: ${backup.backupSize ? (backup.backupSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
      console.log(`   Duration: ${backup.duration}ms`);
      testsPassed++;
    } else {
      console.log('❌ Create backup: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Create backup: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 4: Verify backup was created
  console.log('\\nTest 4: Verify Backup Was Created');
  try {
    const response = await axios.get(`${API_URL}/admin/backups`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success && response.data.data.backups) {
      const backups = response.data.data.backups;
      const recentBackup = backups.find(backup => 
        Date.now() - new Date(backup.created).getTime() < 60000 // Within last minute
      );
      
      if (recentBackup) {
        console.log('✅ Verify backup creation: SUCCESS');
        console.log(`   Recent backup found: ${recentBackup.id}`);
        console.log(`   Size: ${recentBackup.formattedSize}`);
        testsPassed++;
      } else {
        console.log('❌ Verify backup creation: FAILED (no recent backup found)');
        testsFailed++;
      }
    } else {
      console.log('❌ Verify backup creation: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Verify backup creation: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 5: Test backup scheduler stop
  console.log('\\nTest 5: Stop Backup Scheduler');
  try {
    const response = await axios.post(`${API_URL}/admin/backups/schedule/stop`, {}, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success) {
      console.log('✅ Stop scheduler: SUCCESS');
      console.log(`   Message: ${response.data.data.message}`);
      testsPassed++;
    } else {
      console.log('❌ Stop scheduler: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Stop scheduler: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 6: Test backup scheduler start
  console.log('\\nTest 6: Start Backup Scheduler');
  try {
    const response = await axios.post(`${API_URL}/admin/backups/schedule/start`, {}, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success) {
      console.log('✅ Start scheduler: SUCCESS');
      console.log(`   Message: ${response.data.data.message}`);
      testsPassed++;
    } else {
      console.log('❌ Start scheduler: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Start scheduler: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 7: Final statistics check
  console.log('\\nTest 7: Final Statistics Check');
  try {
    const response = await axios.get(`${API_URL}/admin/backups/stats`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success && response.data.data.stats) {
      console.log('✅ Final stats check: SUCCESS');
      const stats = response.data.data.stats;
      console.log(`   Total Backups: ${stats.totalBackups}`);
      console.log(`   Scheduler Status: ${stats.isRunning ? 'Running' : 'Stopped'}`);
      testsPassed++;
    } else {
      console.log('❌ Final stats check: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Final stats check: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Summary
  console.log('\\n📦 SMART BANANA BACKUP SYSTEM TEST COMPLETE! 📦');
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\\n🍌 ALL TESTS PASSED! Backup system is working perfectly! 🍌');
    console.log('Ready for final integration testing! 🍌');
  } else {
    console.log('\\n⚠️  Some tests failed. Check the errors above.');
  }
  
  console.log('\\nBackup System Features Available:');
  console.log('  📦 Automated daily backups (2 AM)');
  console.log('  📋 Backup listing and statistics');
  console.log('  🗜️  Compressed tar.gz archives');
  console.log('  🔄 Backup restoration capability');
  console.log('  📊 Backup size and retention management');
  console.log('  ⏰ Configurable backup scheduling');
  console.log('  🧹 Automatic cleanup of old backups');
}

// Run the test
if (require.main === module) {
  testBackupSystem().catch(console.error);
}

module.exports = testBackupSystem;