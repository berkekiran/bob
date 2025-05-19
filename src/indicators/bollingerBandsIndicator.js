const calculateSMA = require('./smaIndicator');

/**
 * Calculates Bollinger Bands
 * @param {Array} candles - Array of candle data
 * @param {number} period - Period for calculation
 * @param {number} multiplier - Standard deviation multiplier
 * @returns {Object} - Object containing upper band, middle band, and lower band
 */
function calculateBollingerBands(candles, period = 20, multiplier = 2) {
  if (candles.length < period) {
    return {
      upper: candles[candles.length - 1].close,
      middle: candles[candles.length - 1].close,
      lower: candles[candles.length - 1].close
    };
  }
  
  // Calculate simple moving average (middle band)
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    sum += candles[i].close;
  }
  const sma = sum / period;
  
  // Calculate standard deviation
  let sumSquaredDiff = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const diff = candles[i].close - sma;
    sumSquaredDiff += diff * diff;
  }
  const stdDev = Math.sqrt(sumSquaredDiff / period);
  
  // Calculate bands
  const upper = sma + (multiplier * stdDev);
  const lower = sma - (multiplier * stdDev);
  
  return {
    upper,
    middle: sma,
    lower
  };
}

module.exports = calculateBollingerBands; 