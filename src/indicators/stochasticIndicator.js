const calculateSMA = require('./smaIndicator');

/**
 * Calculates Stochastic Oscillator
 * @param {Array} candles - Array of candle data
 * @param {number} period - Period for calculation (typically 14)
 * @param {number} smoothK - Smoothing for %K (typically 1-3)
 * @param {number} smoothD - Smoothing for %D (typically 3)
 * @returns {Object} - Object containing %K and %D values
 */
function calculateStochastic(candles, period = 14, smoothK = 1, smoothD = 3) {
  if (candles.length < period) {
    return {
      k: 50,
      d: 50
    };
  }
  
  // Calculate raw %K values
  const rawKValues = [];
  for (let i = period - 1; i < candles.length; i++) {
    // Find highest high and lowest low in the period
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    for (let j = i - period + 1; j <= i; j++) {
      highestHigh = Math.max(highestHigh, candles[j].high);
      lowestLow = Math.min(lowestLow, candles[j].low);
    }
    
    // Calculate raw %K value
    const currentClose = candles[i].close;
    const rawK = (currentClose - lowestLow) / (highestHigh - lowestLow) * 100;
    rawKValues.push(rawK);
  }
  
  // Apply smoothing to %K
  let smoothedKValues = rawKValues;
  for (let s = 0; s < smoothK; s++) {
    const tempValues = [];
    for (let i = 2; i < smoothedKValues.length; i++) {
      const smoothedK = (smoothedKValues[i] + smoothedKValues[i-1] + smoothedKValues[i-2]) / 3;
      tempValues.push(smoothedK);
    }
    smoothedKValues = tempValues;
  }
  
  // Calculate %D (SMA of %K)
  let dValue = 0;
  if (smoothedKValues.length >= smoothD) {
    let sum = 0;
    for (let i = smoothedKValues.length - smoothD; i < smoothedKValues.length; i++) {
      sum += smoothedKValues[i];
    }
    dValue = sum / smoothD;
  } else {
    dValue = smoothedKValues[smoothedKValues.length - 1];
  }
  
  return {
    k: smoothedKValues[smoothedKValues.length - 1],
    d: dValue
  };
}

module.exports = calculateStochastic; 