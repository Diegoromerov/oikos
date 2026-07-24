// global-setup.js - CommonJS for Jest globalSetup
const { DataSource } = require('typeorm');

let container = null;
let dataSource = null;

async function globalSetup() {
  console.log('Integration test global setup - using existing PostgreSQL...');
  console.log('Using existing PostgreSQL for integration tests');
  
  // For local development, we use the existing PostgreSQL
  // In CI/CD, you would start a Testcontainers PostgreSQL here
}

module.exports = globalSetup;