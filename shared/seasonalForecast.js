const SEASON_WEIGHTS = {
  winter: { acute: 1.1, chronic: 0.95, preventive: 0.9, default: 1.0 },
  summer: { acute: 1.05, chronic: 1.0, preventive: 1.02, default: 1.0 },
  monsoon: { acute: 1.2, chronic: 1.08, preventive: 1.1, default: 1.05 },
  autumn: { acute: 0.98, chronic: 1.02, preventive: 0.95, default: 1.0 },
};

export function getSeasonFromMonth(monthIndex) {
  if (monthIndex === 0 || monthIndex === 1 || monthIndex === 11) return 'winter';
  if (monthIndex >= 2 && monthIndex <= 6) return 'summer';
  if (monthIndex >= 7 && monthIndex <= 9) return 'monsoon';
  return 'autumn';
}

export function inferCategoryFromName(name = '') {
  const normalized = String(name || '').toLowerCase();
  if (/(vitamin|supplement|multivitamin|preventive)/.test(normalized)) return 'preventive';
  if (/(diabetic|thyroid|cardio|bp|asthma|chronic|insulin)/.test(normalized)) return 'chronic';
  if (/(cold|flu|fever|pain|infection|acute|antibiotic)/.test(normalized)) return 'acute';
  return 'default';
}

export function buildSeasonalForecast(medicine, now = new Date()) {
  const monthIndex = now.getMonth();
  const season = getSeasonFromMonth(monthIndex);
  const category = String(medicine.category || medicine.category_name || inferCategoryFromName(medicine.medicine_name || medicine.name || '')).toLowerCase();
  const multiplier = SEASON_WEIGHTS[season]?.[category] || SEASON_WEIGHTS[season]?.default || 1;
  const avgMonthlySold = Number(medicine.avg_monthly_consumption || medicine.avg_monthly_sales || 0);
  const avgDailySold = Math.max(1, Math.round(avgMonthlySold / 30));
  const daysInSeason = 90;
  const predictedDemand = Math.max(1, Math.round(avgDailySold * daysInSeason * multiplier));

  return {
    season,
    month: monthIndex + 1,
    category,
    multiplier,
    avg_daily_sold: avgDailySold,
    days_in_season: daysInSeason,
    predicted_demand: predictedDemand,
  };
}

export function buildMonthlyForecastSeries(medicine, now = new Date()) {
  const base = Number(medicine.avg_monthly_consumption || medicine.avg_monthly_sales || 0) || 60;
  const category = String(medicine.category || medicine.category_name || inferCategoryFromName(medicine.medicine_name || medicine.name || '')).toLowerCase();
  const monthOffset = now.getMonth();
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (monthOffset + index) % 12;
    const season = getSeasonFromMonth(monthIndex);
    const multiplier = SEASON_WEIGHTS[season]?.[category] || SEASON_WEIGHTS[season]?.default || 1;
    const monthlyDemand = Math.max(1, Math.round((base / 30) * 30 * multiplier));
    return { monthIndex, monthLabel: new Date(now.getFullYear(), monthIndex, 1).toLocaleString('en', { month: 'short' }), value: monthlyDemand };
  });
}
