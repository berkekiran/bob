/**
 * Average Directional Index (ADX) Indicator
 * ADX measures the strength of a trend (regardless of direction)
 * Values range from 0 to 100:
 * - 0-25: Weak or non-existent trend
 * - 25-50: Strong trend
 * - 50-75: Very strong trend
 * - 75-100: Extremely strong trend
 */

/**
 * Calculate ADX for the given candles
 * @param {Array} candles - Array of price candles
 * @param {Number} period - Period for calculations (typically 14)
 * @returns {Number} ADX value
 */
function calculateADX(candles, period = 14) {
  if (candles.length < period + 2) {
    return null; // Not enough data
  }
  
  // Step 1: Calculate +DM, -DM, TR
  let plusDM = [];
  let minusDM = [];
  let trueRange = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;
    
    // Calculate True Range
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    const tr = Math.max(tr1, tr2, tr3);
    trueRange.push(tr);
    
    // Calculate Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    // +DM
    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }
    
    // -DM
    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
  }
  
  // Step 2: Calculate smoothed TR, +DM, -DM over period
  let smoothedTR = trueRange.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  
  // Step 3: Calculate +DI and -DI
  let plusDI = (smoothedPlusDM / smoothedTR) * 100;
  let minusDI = (smoothedMinusDM / smoothedTR) * 100;
  
  // Step 4: Calculate DX and ADX
  let DX = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
  
  // For smooth ADX, use Wilder's smoothing over the period
  for (let i = period; i < trueRange.length; i++) {
    // Update smoothed values using Wilder's smoothing
    smoothedTR = smoothedTR - (smoothedTR / period) + trueRange[i];
    smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
    smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];
    
    // Recalculate +DI and -DI
    plusDI = (smoothedPlusDM / smoothedTR) * 100;
    minusDI = (smoothedMinusDM / smoothedTR) * 100;
    
    // Recalculate DX
    DX = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
  }
  
  // Round to 2 decimal places
  return parseFloat(DX.toFixed(2));
}

module.exports = calculateADX; 