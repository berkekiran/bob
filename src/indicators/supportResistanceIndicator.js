/**
 * Identifies support levels from candles
 * @param {Array} candles - Array of candle data
 * @param {number} i - Current candle index
 * @param {number} lookback - Number of candles to look back
 * @returns {boolean} - True if candle is a support level
 */
function isSupport(candles, i, lookback = 3) {
  if (i < lookback || i >= candles.length - lookback) {
    return false;
  }
  
  const currentLow = candles[i].low;
  
  // Check if current low is lower than previous candles
  for (let j = i - lookback; j < i; j++) {
    if (currentLow >= candles[j].low) {
      return false;
    }
  }
  
  // Check if current low is lower than following candles
  for (let j = i + 1; j <= i + lookback; j++) {
    if (currentLow >= candles[j].low) {
      return false;
    }
  }
  
  return true;
}

/**
 * Identifies resistance levels from candles
 * @param {Array} candles - Array of candle data
 * @param {number} i - Current candle index
 * @param {number} lookback - Number of candles to look back
 * @returns {boolean} - True if candle is a resistance level
 */
function isResistance(candles, i, lookback = 3) {
  if (i < lookback || i >= candles.length - lookback) {
    return false;
  }
  
  const currentHigh = candles[i].high;
  
  // Check if current high is higher than previous candles
  for (let j = i - lookback; j < i; j++) {
    if (currentHigh <= candles[j].high) {
      return false;
    }
  }
  
  // Check if current high is higher than following candles
  for (let j = i + 1; j <= i + lookback; j++) {
    if (currentHigh <= candles[j].high) {
      return false;
    }
  }
  
  return true;
}

module.exports = {
  isSupport,
  isResistance
}; 