// ... sve isto kao pre, samo dodato:

chart1 = new Chart(ctx1, {
  type: "line",
  data: { labels, datasets: [...] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: 2,
    plugins: { legend: { display: false } },   // <— UKLONJENA LEGENDA
    scales: {
      x: { ticks: {...}, grid: {...} },
      y: { min: 0, max: 4, ticks: {...}, grid: {...} }
    }
  }
});

// isto i za chart2
