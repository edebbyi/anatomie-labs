// app.js
async function fetchData() {
    const response = await fetch('/.netlify/functions/airtable');
    const raw = await response.json();
  
    const grouped = {};
    raw.forEach(({ structure, time, percentile }) => {
      if (!grouped[structure]) grouped[structure] = [];
      grouped[structure].push({ x: new Date(time), y: percentile });
    });
  
    return grouped;
  }
  
  function generateColor(index) {
    const palette = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
      '#C9CBCF', '#A4DE02', '#F45B69', '#00A8E8'
    ];
    return palette[index % palette.length];
  }
  
  function drawChart(groupedData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const datasets = Object.keys(groupedData).map((structure, i) => ({
      label: `Structure ${structure}`,
      data: groupedData[structure],
      borderColor: generateColor(i),
      fill: false,
      tension: 0.4
    }));
  
    new Chart(ctx, {
      type: 'line',
      data: {
        datasets,
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Prompt Structure Performance'
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'week'
            },
            title: {
              display: true,
              text: 'Week'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Percentile Rank'
            },
            min: 0,
            max: 1
          }
        }
      }
    });
  
    renderLegend(groupedData);
    renderCards();
  }
  
  function renderLegend(grouped) {
    const legend = document.getElementById('legendList');
    legend.innerHTML = '';
  
    Object.keys(grouped).forEach((structure, i) => {
      const color = generateColor(i);
      const item = document.createElement('li');
      item.innerHTML = `<span class="legend-color" style="background:${color}"></span> Structure ${structure}`;
      legend.appendChild(item);
    });
  }
  
  async function renderCards() {
    const response = await fetch('/.netlify/functions/airtable');
    const data = await response.json();
  
    const list = document.getElementById('recordList');
    list.innerHTML = '';
    data.forEach(r => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <strong>Structure ${r.structure ?? 'Unknown'}</strong><br>
        <strong>Skeleton:</strong> ${r.skeleton ?? ''}<br>
        <strong>Trend:</strong> ${r.trend ?? ''}<br>
        <strong>Score:</strong> ${r.z_score ?? ''}<br>
        <strong>Percentile:</strong> ${r.percentile ?? ''}<br>
      `;
      list.appendChild(div);
    });
  }
  
  fetchData().then(drawChart);  