/**
 * Configuration utility
 * Loads and validates all settings from environment variables
 */

// Trading type (simulation or real)
const tradeType = process.env.TRADE_TYPE || 'simulation';

// API credentials
const apiKey = process.env.BINANCE_API_KEY || '';
const apiSecret = process.env.BINANCE_API_SECRET || '';

// Trading parameters
const symbol = process.env.SYMBOL || 'BTCUSDT';
const ticker = symbol.replace(/USDT$/, '').replace(/USD$/, '');
const feePercentage = parseFloat(process.env.FEE_PERCENTAGE || 0.075);
const slippagePercentage = parseFloat(process.env.SLIPPAGE_PERCENTAGE || 0.05);

// Simulation parameters
const initialBalance = parseFloat(process.env.INITIAL_BALANCE || 10000);
const startDate = process.env.START_DATE || '2023-01-01';
const endDate = process.env.END_DATE || '2023-11-01';
const interval = process.env.INTERVAL || '1d';

// Validate configuration
function validate() {
  if (tradeType !== 'simulation' && tradeType !== 'real') {
    throw new Error(`Invalid TRADE_TYPE: ${tradeType}. Must be 'simulation' or 'real'.`);
  }
  
  if (isNaN(initialBalance) || initialBalance <= 0) {
    throw new Error(`Invalid INITIAL_BALANCE: ${initialBalance}. Must be a positive number.`);
  }
}

// Validate on load
validate();

// Export configuration
module.exports = {
  tradeType,
  apiKey,
  apiSecret,
  symbol,
  ticker,
  feePercentage,
  slippagePercentage,
  initialBalance,
  startDate,
  endDate,
  interval
}; 