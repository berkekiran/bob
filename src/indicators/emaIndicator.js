/**
 * Calculates Exponential Moving Average (EMA)
 * @param {Array} candles - Array of candle data
 * @param {number} period - Period for calculation
 * @returns {number} - EMA value for the current candle
 */
function calculateEMA(candles, period = 20) {
  if (candles.length < period) {
    return candles[candles.length - 1].close; // Not enough data, return current price
  }
  
  // Calculate simple moving average as the first EMA value
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    sum += candles[i].close;
  }
  let sma = sum / period;
  
  // Calculate multiplier for EMA
  const multiplier = 2 / (period + 1);
  
  // Calculate EMA
  let ema = sma;
  for (let i = candles.length - period + 1; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
  }
  
  return ema;
}

module.exports = calculateEMA; 