#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkServerRunning() {
  return new Promise((resolve) => {
    const axios = require('axios');
    axios.get('http://localhost:3000/health', { timeout: 5000 })
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });
}

async function runTest(testFile, testName) {
  return new Promise((resolve, reject) => {
    log(`\n🧪 Running ${testName}...`, 'cyan');
    
    const testProcess = spawn('node', [testFile], {
      stdio: 'inherit',
      cwd: path.dirname(testFile)
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${testName} completed successfully`, 'green');
        resolve({ name: testName, status: 'PASS', code });
      } else {
        log(`❌ ${testName} failed with code ${code}`, 'red');
        resolve({ name: testName, status: 'FAIL', code });
      }
    });

    testProcess.on('error', (error) => {
      log(`💥 ${testName} crashed: ${error.message}`, 'red');
      reject({ name: testName, status: 'ERROR', error: error.message });
    });
  });
}

async function main() {
  log('🍌 PI-API-HUB COMPREHENSIVE TEST RUNNER', 'bright');
  log('=' * 50, 'cyan');
  
  // Check if server is running
  log('\n🔍 Checking if server is running...', 'blue');
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    log('❌ Server is not running on localhost:3000', 'red');
    log('💡 Please start the server first with: npm start', 'yellow');
    process.exit(1);
  }
  
  log('✅ Server is running on localhost:3000', 'green');
  
  // Define test suites to run
  const testSuites = [
    {
      file: path.join(__dirname, 'comprehensive-integration.test.js'),
      name: 'Comprehensive Integration Tests'
    }
  ];
  
  // Check if stress tests exist and add them
  const stressTestPath = path.join(__dirname, 'stress-tests.js');
  try {
    require('fs').accessSync(stressTestPath);
    testSuites.push({
      file: stressTestPath,
      name: 'Stress Tests'
    });
  } catch (error) {
    log('ℹ️  Stress tests not found, skipping...', 'yellow');
  }
  
  // Run all test suites
  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const testSuite of testSuites) {
    try {
      const result = await runTest(testSuite.file, testSuite.name);
      results.push(result);
      
      if (result.status === 'PASS') {
        totalPassed++;
      } else {
        totalFailed++;
      }
    } catch (error) {
      results.push(error);
      totalFailed++;
    }
  }
  
  // Generate final report
  log('\n' + '=' * 50, 'cyan');
  log('🏆 FINAL TEST REPORT', 'bright');
  log('=' * 50, 'cyan');
  
  results.forEach(result => {
    const statusColor = result.status === 'PASS' ? 'green' : 'red';
    log(`${result.status === 'PASS' ? '✅' : '❌'} ${result.name}: ${result.status}`, statusColor);
  });
  
  const totalTests = totalPassed + totalFailed;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
  
  log(`\n📊 Summary:`, 'blue');
  log(`  Total Suites: ${totalTests}`, 'blue');
  log(`  Passed: ${totalPassed}`, 'green');
  log(`  Failed: ${totalFailed}`, 'red');
  log(`  Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');
  
  if (passRate >= 90) {
    log('\n🎉 ALL SYSTEMS GO! Production ready! 🚀', 'green');
  } else if (passRate >= 80) {
    log('\n✅ Most systems working well! Minor issues detected.', 'yellow');
  } else {
    log('\n⚠️  Multiple issues detected. Review failed tests.', 'red');
  }
  
  log('\n🍌 Test run complete!', 'bright');
  
  // Exit with appropriate code
  process.exit(passRate >= 80 ? 0 : 1);
}

// Handle SIGINT gracefully
process.on('SIGINT', () => {
  log('\n\n⏹️  Test run interrupted by user', 'yellow');
  process.exit(130);
});

// Run main function
main().catch(error => {
  log(`💥 Test runner failed: ${error.message}`, 'red');
  process.exit(1);
});