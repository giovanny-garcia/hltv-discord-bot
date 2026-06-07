import type { TestGraphInput } from "./types.js";

/** Renders a line chart image URL without adding npm chart dependencies. */
export function buildBalanceChartUrl(data: TestGraphInput): string {
  const config = {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: data.metric,
          data: data.values,
          fill: false,
          borderColor: "rgb(52, 152, 219)",
          backgroundColor: "rgba(52, 152, 219, 0.2)",
          tension: 0.25,
          pointRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: true },
        title: { display: true, text: data.title },
      },
      scales: {
        y: { beginAtZero: false },
      },
    },
  };

  return `https://quickchart.io/chart?w=640&h=320&c=${encodeURIComponent(JSON.stringify(config))}`;
}
