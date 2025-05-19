const calculateEMA = require('./emaIndicator');

/**
 * Calculates MACD (Moving Average Convergence Divergence)
 * @param {Array} candles - Array of candle data
 * @param {number} fastPeriod - Fast EMA period
 * @param {number} slowPeriod - Slow EMA period
 * @param {number} signalPeriod - Signal EMA period
 * @returns {Object} - MACD line, signal line, and histogram
 */
function calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);
  
  // Calculate MACD line
  const macdLine = fastEMA - slowEMA;
  
  // Calculate signal line
  const macdCandles = candles.slice(-signalPeriod).map(c => ({ close: fastEMA - slowEMA }));
  const signalLine = calculateEMA(macdCandles, signalPeriod);
  
  // Calculate histogram
  const histogram = macdLine - signalLine;
  
  return {
    macdLine,
    signalLine,
    histogram
  };
}

module.exports = calculateMACD; 