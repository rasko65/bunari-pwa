const CHANNEL_ID = 3030085;
const FIELD1 = 1;
const FIELD2 = 2;
const POINTS_DEFAULT_HOURS = 24;
const REFRESH_MS = 20000;

let currentHours = POINTS_DEFAULT_HOURS;
let chart1, chart2;
let lastFetchTime = null;

function computeTrend(values) {
  if (values.length < 2) return "flat";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const diff = last - prev;
  const threshold = Math.max(Math.abs(last), 1) * 0.002;

  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "flat";
}

// FORMATIRANJE X OSE — NOVA LOGIKA
function formatTimeLabel(ts) {
  const d = new Date(ts);

  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");

  // 1h i 24h → samo vreme
  if (currentHours <= 24) {
    return `${hours}:${minutes}`;
  }

  // 7 dana i 30 dana → samo datum
  return `${day}.${month}.`;
}

async function fetchData(hours) {
  const results = hours * 4;
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

    // OFFLINE DETEKCIJA
    const lastTimestamp = new Date(feeds[feeds.length - 1].created_at);
    const now = new Date();
    const diffMinutes = (now - lastTimestamp) / 60000;

    const statusBox = document.getElementById("device-status");

    if (diffMinutes > 5) {
      statusBox.classList.remove("hidden");
    } else {
      statusBox.classList.add("hidden");
    }

    updateUI(labels, values1, values2);
    lastFetchTime = new Date();
    statusEl.textContent = `Osveženo: ${lastFetchTime.toLocaleTimeString("sr-RS")}`;
  } catch (e) {
    console.error("Greška pri fetch-u:", e);
    statusEl.textContent = "Greška pri osvežavanju podataka";
  }
}

function updateUI(labels, values1, values2) {
  const clean1 = values1.filter((v) => v != null);
  const clean2 = values2.filter((v) => v != null);

  const last1 = clean1.length ? clean1[clean1.length - 1] : null;
  const last2 = clean2.length ? clean2[clean2.length - 1] : null;

  const trend1 = computeTrend(clean1);
  const trend2 = computeTrend(clean2);

  document.getElementById("well1-value").textContent =
    last1 != null ? `${last1.toFixed(2)} m` : "--";
  document.getElementById("well2-value").textContent =
    last2 != null ? `${last2.toFixed(2)} m` : "--";

  const w1TrendEl = document.getElementById("well1-trend");
  const w2TrendEl = document.getElementById("well2-trend");

  w1TrendEl.className = `trend ${trend1}`;
  w2TrendEl.className = `trend ${trend2}`;

  w1TrendEl.textContent =
    trend1 === "up" ? "▲" : trend1 === "down" ? "▼" : "●";
  w2TrendEl.textContent =
    trend2 === "up" ? "▲" : trend2 === "down" ? "▼" : "●";

  const ctx1 = document.getElementById("chart1").getContext("2d");
  const ctx2 = document.getElementById("chart2").getContext("2d");

  if (chart1) chart1.destroy();
  if (chart2) chart2.destroy();

  chart1 = new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "",
          data: values1,
          borderColor: "#4da3ff",
          backgroundColor: "rgba(77,163,255,0.15)",
          tension: 0.25,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: {
            color: "#4da3ff",
            maxTicksLimit: 6,
            font: { size: 12, family: "Inter, system-ui, -apple-system" }
          },
          grid: { color: "rgba(255,255,255,0.03)" }
        },
        y: {
          min: 0,
          max: 4,
          ticks: {
            color: "#4da3ff",
            font: { size: 12, family: "Inter, system-ui, -apple-system" }
          },
          grid: { color: "rgba(255,255,255,0.03)" }
        }
      }
    }
  });

  chart2 = new Chart(ctx2, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "",
          data: values2,
          borderColor: "#ffb347",
          backgroundColor: "rgba(255,179,71,0.15)",
          tension: 0.25,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: {
            color: "#ffb347",
            maxTicksLimit: 6,
            font: { size: 12, family: "Inter, system-ui, -apple-system" }
          },
          grid: { color: "rgba(255,255,255,0.03)" }
        },
        y: {
          min: 0,
          max: 10,
          ticks: {
            color: "#ffb347",
            font: { size: 12, family: "Inter, system-ui, -apple-system" }
          },
          grid: { color: "rgba(255,255,255,0.03)" }
        }
      }
    }
  });
}

function setupRangeButtons() {
  const buttons = document.querySelectorAll(".range-buttons button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentHours = parseInt(btn.dataset.range, 10);
      fetchData(currentHours);
    });
  });

  const defaultBtn = document.querySelector(
    `.range-buttons button[data-range="${POINTS_DEFAULT_HOURS}"]`
  );
  if (defaultBtn) defaultBtn.classList.add("active");
}

function setupAutoRefresh() {
  setInterval(() => {
    fetchData(currentHours);
  }, REFRESH_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  setupRangeButtons();
  setupAutoRefresh();
  fetchData(currentHours);
});

