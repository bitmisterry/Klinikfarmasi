// WHO Growth Chart reference data (LMS method)
// Simplified dataset — key age points for Weight-for-Age, Height-for-Age (0-60 months)
// Source: WHO Child Growth Standards (2006)

// LMS values: L = Box-Cox power, M = median, S = coefficient of variation
// Z-score = ((value/M)^L - 1) / (L * S)  when L != 0
// Z-score = ln(value/M) / S  when L == 0

const WHO_DATA = {
  boys: {
    wfa: [ // Weight-for-Age (boys)
      { age: 0, L: 0.0, M: 3.35, S: 0.0857 },
      { age: 1, L: -0.3, M: 4.50, S: 0.0865 },
      { age: 2, L: -0.3, M: 5.60, S: 0.0869 },
      { age: 3, L: -0.3, M: 6.40, S: 0.0876 },
      { age: 4, L: -0.3, M: 7.00, S: 0.0884 },
      { age: 6, L: -0.3, M: 7.90, S: 0.0901 },
      { age: 9, L: -0.3, M: 8.90, S: 0.0924 },
      { age: 12, L: -0.3, M: 9.60, S: 0.0935 },
      { age: 15, L: -0.3, M: 10.30, S: 0.0943 },
      { age: 18, L: -0.3, M: 10.90, S: 0.0950 },
      { age: 24, L: -0.3, M: 12.20, S: 0.0955 },
      { age: 30, L: -0.3, M: 13.30, S: 0.0962 },
      { age: 36, L: -0.3, M: 14.30, S: 0.0970 },
      { age: 48, L: -0.3, M: 16.30, S: 0.0977 },
      { age: 60, L: -0.3, M: 18.30, S: 0.0984 },
    ],
    hfa: [ // Height-for-Age (boys)
      { age: 0, L: 1.0, M: 49.9, S: 0.0376 },
      { age: 1, L: 1.0, M: 54.7, S: 0.0378 },
      { age: 2, L: 1.0, M: 58.4, S: 0.0383 },
      { age: 3, L: 1.0, M: 61.4, S: 0.0388 },
      { age: 4, L: 1.0, M: 63.9, S: 0.0392 },
      { age: 6, L: 1.0, M: 67.6, S: 0.0400 },
      { age: 9, L: 1.0, M: 72.0, S: 0.0410 },
      { age: 12, L: 0.9, M: 76.0, S: 0.0420 },
      { age: 18, L: 0.9, M: 82.0, S: 0.0435 },
      { age: 24, L: 0.9, M: 87.0, S: 0.0450 },
      { age: 30, L: 0.9, M: 92.0, S: 0.0460 },
      { age: 36, L: 0.9, M: 96.0, S: 0.0470 },
      { age: 48, L: 0.9, M: 103.0, S: 0.0490 },
      { age: 60, L: 0.9, M: 110.0, S: 0.0510 },
    ],
  },
  girls: {
    wfa: [ // Weight-for-Age (girls)
      { age: 0, L: 0.0, M: 3.20, S: 0.0864 },
      { age: 1, L: -0.3, M: 4.20, S: 0.0872 },
      { age: 2, L: -0.3, M: 5.10, S: 0.0877 },
      { age: 3, L: -0.3, M: 5.80, S: 0.0884 },
      { age: 4, L: -0.3, M: 6.40, S: 0.0891 },
      { age: 6, L: -0.3, M: 7.30, S: 0.0908 },
      { age: 9, L: -0.3, M: 8.20, S: 0.0931 },
      { age: 12, L: -0.3, M: 8.90, S: 0.0942 },
      { age: 15, L: -0.3, M: 9.60, S: 0.0950 },
      { age: 18, L: -0.3, M: 10.20, S: 0.0957 },
      { age: 24, L: -0.3, M: 11.50, S: 0.0962 },
      { age: 30, L: -0.3, M: 12.70, S: 0.0969 },
      { age: 36, L: -0.3, M: 13.90, S: 0.0977 },
      { age: 48, L: -0.3, M: 16.10, S: 0.0984 },
      { age: 60, L: -0.3, M: 18.20, S: 0.0991 },
    ],
    hfa: [ // Height-for-Age (girls)
      { age: 0, L: 1.0, M: 49.1, S: 0.0381 },
      { age: 1, L: 1.0, M: 53.7, S: 0.0383 },
      { age: 2, L: 1.0, M: 57.1, S: 0.0388 },
      { age: 3, L: 1.0, M: 59.8, S: 0.0393 },
      { age: 4, L: 1.0, M: 62.1, S: 0.0397 },
      { age: 6, L: 1.0, M: 65.7, S: 0.0405 },
      { age: 9, L: 1.0, M: 70.1, S: 0.0415 },
      { age: 12, L: 0.9, M: 74.0, S: 0.0425 },
      { age: 18, L: 0.9, M: 80.0, S: 0.0440 },
      { age: 24, L: 0.9, M: 86.0, S: 0.0455 },
      { age: 30, L: 0.9, M: 90.0, S: 0.0465 },
      { age: 36, L: 0.9, M: 95.0, S: 0.0475 },
      { age: 48, L: 0.9, M: 102.0, S: 0.0495 },
      { age: 60, L: 0.9, M: 109.0, S: 0.0515 },
    ],
  },
};

function interpolateLMS(data, ageMonths) {
  if (ageMonths <= 0) return data[0];
  if (ageMonths >= data[data.length - 1].age) return data[data.length - 1];
  for (let i = 0; i < data.length - 1; i++) {
    if (ageMonths >= data[i].age && ageMonths <= data[i + 1].age) {
      const ratio = (ageMonths - data[i].age) / (data[i + 1].age - data[i].age);
      return {
        L: data[i].L + (data[i + 1].L - data[i].L) * ratio,
        M: data[i].M + (data[i + 1].M - data[i].M) * ratio,
        S: data[i].S + (data[i + 1].S - data[i].S) * ratio,
      };
    }
  }
  return data[data.length - 1];
}

function calcZScore(value, lms) {
  if (!lms || value == null) return null;
  const { L, M, S } = lms;
  if (M <= 0) return null;
  if (L === 0) {
    return Math.log(value / M) / S;
  }
  return (Math.pow(value / M, L) - 1) / (L * S);
}

function zToPercentile(z) {
  if (z == null) return null;
  // Standard normal CDF approximation
  const x = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? (1 - p) * 100 : p * 100;
}

export function calculateGrowth(gender, ageMonths, weight, height) {
  const g = gender === 'L' ? 'boys' : 'girls';
  const data = WHO_DATA[g];

  const wfaLMS = interpolateLMS(data.wfa, ageMonths);
  const hfaLMS = interpolateLMS(data.hfa, ageMonths);

  const z_bb_u = calcZScore(weight, wfaLMS);
  const z_tb_u = calcZScore(height, hfaLMS);

  // BMI calculation
  const heightM = height / 100;
  const bmi = heightM > 0 ? weight / (heightM * heightM) : null;

  // Nutrition status based on Z-score BB/U
  let nutritionStatus = 'Normal';
  if (z_bb_u != null) {
    if (z_bb_u < -3) nutritionStatus = 'Sangat Kurus';
    else if (z_bb_u < -2) nutritionStatus = 'Kurus';
    else if (z_bb_u > 3) nutritionStatus = 'Obesitas';
    else if (z_bb_u > 2) nutritionStatus = 'Gemuk';
  }

  return {
    z_score_bb_u: z_bb_u ? Math.round(z_bb_u * 100) / 100 : null,
    z_score_tb_u: z_tb_u ? Math.round(z_tb_u * 100) / 100 : null,
    percentile_bb_u: zToPercentile(z_bb_u) ? Math.round(zToPercentile(z_bb_u)) : null,
    percentile_tb_u: zToPercentile(z_tb_u) ? Math.round(zToPercentile(z_tb_u)) : null,
    percentile_bb_tb: null, // requires weight-for-height table (simplified)
    z_score_bb_tb: null,
    bmi: bmi ? Math.round(bmi * 10) / 10 : null,
    nutrition_status: nutritionStatus,
  };
}

// Generate chart data for rendering WHO percentile bands
export function getGrowthChartData(gender, type = 'wfa') {
  const g = gender === 'L' ? 'boys' : 'girls';
  const data = WHO_DATA[g][type];
  const ages = [];
  for (let a = 0; a <= 60; a += 1) {
    const lms = interpolateLMS(data, a);
    const p3 = lms.M * Math.pow(1 + lms.L * lms.S * (-1.88), 1 / lms.L);
    const p15 = lms.M * Math.pow(1 + lms.L * lms.S * (-1.04), 1 / lms.L);
    const p50 = lms.M;
    const p85 = lms.M * Math.pow(1 + lms.L * lms.S * 1.04, 1 / lms.L);
    const p97 = lms.M * Math.pow(1 + lms.L * lms.S * 1.88, 1 / lms.L);
    ages.push({ age: a, p3, p15, p50, p85, p97 });
  }
  return ages;
}