/**
 * Main entry point for the trading application
 * Handles both simulation and real trading modes
 */
require('dotenv').config();

const simulator = require('./simulator');
const trader = require('./exchange/trader');
const config = require('./utils/config');

async function main() {
  console.log('Bob Trading Bot - Starting up...');
  console.log(`Mode: ${config.tradeType}`);
  console.log(`Symbol: ${config.symbol}`);
  
  try {
    // Run in simulation or real trading mode based on configuration
    if (config.tradeType === 'simulation') {
      console.log('Running in simulation mode...');
      console.log(`Period: ${config.startDate} to ${config.endDate}`);
      console.log(`Initial Balance: $${config.initialBalance}`);
      
      // Run simulation
      await simulator.run(config);
    } else if (config.tradeType === 'real') {
      console.log('Running in real trading mode...');
      
      // Check for API keys
      if (!config.apiKey || !config.apiSecret) {
        console.error('ERROR: Binance API credentials are required for real trading.');
        console.error('Please set BINANCE_API_KEY and BINANCE_API_SECRET in your .env file.');
        process.exit(1);
      }
      
      // Start real trading
      await trader.start(config);
    } else {
      console.error(`ERROR: Invalid TRADE_TYPE. Must be either 'simulation' or 'real'.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the application
main().catch(err => {
  console.error('Unhandled exception:', err);
  process.exit(1);
}); 