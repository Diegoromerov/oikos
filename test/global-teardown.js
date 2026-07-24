// global-teardown.js - CommonJS for Jest globalTeardown
async function globalTeardown() {
  console.log('Cleaning up test environment...');
}

module.exports = globalTeardown;