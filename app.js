// Osnovna podešavanja
const CHANNEL_ID = 3030085;
const FIELD1 = 1; // Stari bunar
const FIELD2 = 2; // Novi bunar
const POINTS_DEFAULT_HOURS = 24; // početni opseg
const REFRESH_MS = 20000; // auto-refresh

let currentHours = POINTS_DEFAULT_HOURS;
let chart1, chart2;
let lastFetchTime = null;

// EMA helper
function computeEMA(values, alpha = 0.2) {
  if (!values.length) return null;
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  return ema;
}

// Trend helper
function computeTrend(values) {
  if (values.length < 2) return "flat";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const diff = last - prev;
  const threshold = Math.max(Math.abs(last), 1) * 0.002; // 0.2%

  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "flat";
}

// Formatiranje vremena
function formatTimeLabel(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

// Fetch podataka
async function fetchData(hours) {
  const results = hours * 4; // pretpostavka ~1 merenje na 15min
  const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?results=${results}`;

  const statusEl = document.getElementById("refresh-status");
  statusEl.textContent = "Osvežavam podatke…";

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    const feeds = data.feeds || [];

    const labels = [];
    const values1 = [];
    const values2 = [];

    feeds.forEach((f) => {
      const t = f.created_at;
      const v1 = parseFloat(f[`field${FIELD1}`]);
      const v2 = parseFloat(f[`field${FIELD2}`]);

      if (!isNaN(v1) || !isNaN(v2)) {
        labels.push(formatTimeLabel(t));
        values1.push(isNaN(v1) ? null : v1);
        values2.push(isNaN(v2) ? null : v2);
      }
    });

    updateUI(labels, values1, values2);
    lastFetchTime = new Date();
    statusEl.textContent = `Osveženo: ${lastFetchTime.toLocaleTimeString("sr-RS")}`;
  } catch (e) {
    console.error("Greška pri fetch-u:", e);
    statusEl.textContent = "Greška pri osvežavanju podataka";
  }
}

// Update UI
function updateUI(labels, values1, values2) {
  // Filtriraj null vrednosti za EMA i trend
  const clean1 = values1.filter((v) => v != null);
  const clean2 = values2.filter((v) => v != null);

  const last1 = clean1.length ? clean1[clean1.length - 1] : null;
  const last2 = clean2.length ? clean2[clean2.length - 1] : null;

  const ema1 = computeEMA(clean1);
  const ema2 = computeEMA(clean2);

  const trend1 = computeTrend(clean1);
  const trend2 = computeTrend(clean2);

  // Tekstualne vrednosti
  const w1ValEl = document.getElementById("well1-value");
  const w2ValEl = document.getElementById("well2-value");
  const w1EmaEl = document.getElementById("well1-ema");
  const w2EmaEl = document.getElementById("well2-ema");
  const w1TrendEl = document.getElementById("well1-trend");
  const w2TrendEl = document.getElementById("well2-trend");

  w1ValEl.textContent = last1 != null ? `${last1.toFixed(1)} cm` : "--";
  w2ValEl.textContent = last2 != null ? `${last2.toFixed(1)} cm` : "--";

  w1EmaEl.textContent = ema1 != null ? `${ema1.toFixed(1)} cm` : "--";
  w2EmaEl.textContent = ema2 != null ? `${ema2.toFixed(1)} cm` : "--";

  w1TrendEl.className = `trend ${trend1}`;
  w2TrendEl.className = `trend ${trend2}`;

  w1TrendEl.textContent =
    trend1 === "up" ? "▲" : trend1 === "down" ? "▼" : "●";
  w2TrendEl.textContent =
    trend2 === "up" ? "▲" : trend2 === "down" ? "▼" : "●";

  // Chart update
  const ctx1 = document.getElementById("chart1").getContext("2d");
  const ctx2 = document.getElementById("chart2").getContext("2d");

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: "#9a9ab0", maxTicksLimit: 6 },
        grid: { color: "rgba(255,255,255,0.03)" },
      },
      y: {
        ticks: { color: "#9a9ab0" },
        grid: { color: "rgba(255,255,255,0.03)" },
      },
    },
    plugins: {
      legend: {
        labels: { color: "#e6e6f0" },
      },
    },
  };

  if (chart1) chart1.destroy();
  if (chart2) chart2.destroy();

  chart1 = new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Stari bunar",
          data: values1,
          borderColor: "#4da3ff",
          backgroundColor: "rgba(77,163,255,0.15)",
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    },
    options: commonOptions,
  });

  chart2 = new Chart(ctx2, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Novi bunar",
          data: values2,
          borderColor: "#ffb347",
          backgroundColor: "rgba(255,179,71,0.15)",
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    },
    options: commonOptions,
  });
}

// Range dugmad
function setupRangeButtons() {
  const buttons = document.querySelectorAll(".range-buttons button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const hours = parseInt(btn.dataset.range, 10);
      currentHours = hours;
      fetchData(currentHours);
    });
  });

  // podrazumevano aktiviraj 24h
  const defaultBtn = document.querySelector(
    `.range-buttons button[data-range="${POINTS_DEFAULT_HOURS}"]`
  );
  if (defaultBtn) defaultBtn.classList.add("active");
}

// Auto-refresh
function setupAutoRefresh() {
  setInterval(() => {
    fetchData(currentHours);
  }, REFRESH_MS);
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupRangeButtons();
  setupAutoRefresh();
  fetchData(currentHours);
});