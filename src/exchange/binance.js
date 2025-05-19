/**
 * Binance API Integration
 * Handles communication with Binance for real trading
 */
const Binance = require('binance-api-node').default;

let client = null;

/**
 * Initialize the Binance API client
 * @param {string} apiKey - Binance API key
 * @param {string} apiSecret - Binance API secret
 * @returns {Object} Binance client
 */
function initialize(apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    throw new Error('Binance API credentials are required');
  }
  
  client = Binance({
    apiKey,
    apiSecret,
    futures: true // Enable futures API
  });
  
  return client;
}

/**
 * Get the Binance client instance
 * @returns {Object} Binance client
 */
function getClient() {
  if (!client) {
    throw new Error('Binance client not initialized');
  }
  
  return client;
}

/**
 * Get account information
 * @returns {Promise<Object>} Account information
 */
async function getAccountInfo() {
  const client = getClient();
  return await client.accountInfo();
}

/**
 * Get futures account information
 * @returns {Promise<Object>} Futures account information
 */
async function getFuturesAccountInfo() {
  const client = getClient();
  return await client.futuresAccountInfo();
}

/**
 * Get current market price
 * @param {string} symbol - Trading pair symbol
 * @returns {Promise<number>} Current price
 */
async function getCurrentPrice(symbol) {
  const client = getClient();
  const ticker = await client.prices({ symbol });
  return parseFloat(ticker[symbol]);
}

/**
 * Place a market order
 * @param {string} symbol - Trading pair symbol
 * @param {string} side - Order side (BUY or SELL)
 * @param {number} quantity - Order quantity
 * @param {Object} options - Additional order options
 * @returns {Promise<Object>} Order result
 */
async function placeMarketOrder(symbol, side, quantity, options = {}) {
  const client = getClient();
  
  const orderParams = {
    symbol,
    side,
    quantity: quantity.toString(),
    type: 'MARKET',
    ...options
  };
  
  if (options.futures) {
    return await client.futuresOrder(orderParams);
  } else {
    return await client.order(orderParams);
  }
}

/**
 * Set leverage for futures trading
 * @param {string} symbol - Trading pair symbol
 * @param {number} leverage - Leverage multiplier
 * @returns {Promise<Object>} Leverage update result
 */
async function setLeverage(symbol, leverage) {
  const client = getClient();
  return await client.futuresLeverage({
    symbol,
    leverage: parseInt(leverage, 10)
  });
}

/**
 * Get open positions
 * @returns {Promise<Array>} List of open positions
 */
async function getOpenPositions() {
  const client = getClient();
  const positions = await client.futuresPositionRisk();
  return positions.filter(p => parseFloat(p.positionAmt) !== 0);
}

/**
 * Get candle data (OHLCV)
 * @param {string} symbol - Trading pair symbol
 * @param {string} interval - Candle interval (1m, 1h, 4h, 1d)
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Candle data
 */
async function getCandles(symbol, interval = '1d', options = {}) {
  const client = getClient();
  
  // Default to 100 candles if not specified
  const limit = options.limit || 100;
  
  const candles = await client.candles({
    symbol,
    interval,
    limit,
    ...options
  });
  
  // Format candles to match our standard format
  return candles.map(candle => ({
    time: candle.openTime,
    timestamp: candle.openTime,
    open: parseFloat(candle.open),
    high: parseFloat(candle.high),
    low: parseFloat(candle.low),
    close: parseFloat(candle.close),
    volume: parseFloat(candle.volume)
  }));
}

module.exports = {
  initialize,
  getClient,
  getAccountInfo,
  getFuturesAccountInfo,
  getCurrentPrice,
  placeMarketOrder,
  setLeverage,
  getOpenPositions,
  getCandles
}; 