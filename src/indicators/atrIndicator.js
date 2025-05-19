/**
 * Calculates Average True Range (ATR)
 * @param {Array} candles - Array of candle data
 * @param {number} period - Period for calculation
 * @returns {number} - ATR value for the current candle
 */
function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) {
    return 0; // Not enough data
  }
  
  // Calculate initial true ranges
  const trueRanges = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    // True Range is the greatest of:
    // 1. Current High - Current Low
    // 2. |Current High - Previous Close|
    // 3. |Current Low - Previous Close|
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    const trueRange = Math.max(tr1, tr2, tr3);
    trueRanges.push(trueRange);
  }
  
  // Use simple average for the first ATR value
  let atr = 0;
  for (let i = 0; i < period; i++) {
    atr += trueRanges[i];
  }
  atr /= period;
  
  // Calculate smoothed ATR using Wilder's method
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }
  
  return atr;
}

module.exports = calculateATR; 