/**
 * Calculates Simple Moving Average (SMA)
 * @param {Array} candles - Array of candle data
 * @param {number} period - Period for calculation
 * @returns {number} - SMA value for the current candle
 */
function calculateSMA(candles, period = 20) {
  if (candles.length < period) {
    return candles[candles.length - 1].close; // Not enough data, return current price
  }
  
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    sum += candles[i].close;
  }
  
  return sum / period;
}

module.exports = calculateSMA; 