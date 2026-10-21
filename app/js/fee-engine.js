/**
 * ParkPro Dynamic Fee Calculation Engine
 * Calculates parking tariffs based on duration, vehicle type rates, grace periods,
 * 24-hour daily maximums, night tariffs, and lost-ticket penalties.
 */

class ParkProFeeEngine {
  /**
   * Calculate detailed fee breakdown
   * @param {Date|string} entryTime 
   * @param {Date|string} exitTime 
   * @param {Object} rateConfig { base_rate, hourly_rate, grace_period_mins, daily_max, night_rate }
   * @param {Object} options { isLostTicket, penaltyFee, discountAmount }
   * @returns {Object} detailed calculation breakdown
   */
  calculateFee(entryTime, exitTime, rateConfig, options = {}) {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const durationMs = Math.max(0, exit - entry);
    const durationMins = Math.max(1, Math.round(durationMs / 60000));
    const durationHours = Math.ceil(durationMins / 60);

    const baseRate = parseFloat(rateConfig.base_rate || 0);
    const hourlyRate = parseFloat(rateConfig.hourly_rate || 0);
    const graceMins = parseInt(rateConfig.grace_period_mins || 0, 10);
    const dailyMax = parseFloat(rateConfig.daily_max || 0);
    const nightRate = parseFloat(rateConfig.night_rate || 0);

    const isLostTicket = !!options.isLostTicket;
    const penaltyFee = isLostTicket ? parseFloat(options.penaltyFee || 500) : 0;
    const discountAmount = parseFloat(options.discountAmount || 0);

    // 1. Grace Period Check
    if (durationMins <= graceMins && !isLostTicket) {
      return {
        durationMins,
        durationHours: 0,
        isGracePeriod: true,
        baseAmount: 0,
        hourlyAmount: 0,
        daysCount: 0,
        dailyAmount: 0,
        nightSurcharge: 0,
        penaltyAmount: 0,
        discountAmount: 0,
        totalFee: 0,
        summary: `Exit within grace period (${durationMins}m / ${graceMins}m allowed). No fee.`
      };
    }

    // 2. Day-by-Day (24-hour cycle) & Hourly Calculation
    const fullDays = Math.floor(durationMins / 1440);
    const remainderMins = durationMins % 1440;
    let daysAmount = 0;

    if (fullDays > 0) {
      const perDayCap = dailyMax > 0 ? dailyMax : (baseRate + (23 * hourlyRate));
      daysAmount = fullDays * perDayCap;
    }

    // Remainder hours within partial day
    let remainderAmount = 0;
    let baseAmount = 0;
    let hourlyAmount = 0;

    if (remainderMins > 0 || fullDays === 0) {
      const remainderHours = Math.ceil(remainderMins / 60);
      baseAmount = baseRate;

      if (remainderHours > 1) {
        hourlyAmount = (remainderHours - 1) * hourlyRate;
      }

      remainderAmount = baseAmount + hourlyAmount;

      // Cap partial day at daily maximum if set
      if (dailyMax > 0 && remainderAmount > dailyMax) {
        remainderAmount = dailyMax;
      }
    }

    // 3. Night Surcharge (if overnight stay between 22:00 and 06:00)
    let nightSurcharge = 0;
    const exitHour = exit.getHours();
    if (nightRate > 0 && (exitHour >= 22 || exitHour < 6)) {
      nightSurcharge = nightRate;
    }

    // 4. Total Calculation
    const subtotal = daysAmount + remainderAmount + nightSurcharge + penaltyFee;
    const totalFee = Math.max(0, subtotal - discountAmount);

    return {
      durationMins,
      durationHours,
      isGracePeriod: false,
      daysCount: fullDays,
      dailyAmount: daysAmount,
      baseAmount,
      hourlyAmount,
      nightSurcharge,
      penaltyAmount: penaltyFee,
      discountAmount,
      totalFee: Math.round(totalFee),
      summary: `${durationHours} hr stay (${durationMins} mins)`
    };
  }
}

// Global Fee Engine Instance
window.feeEngine = new ParkProFeeEngine();
