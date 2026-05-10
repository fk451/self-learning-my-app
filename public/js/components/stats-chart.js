/**
 * Canvas Tabanlı Basit Grafik Component
 */
const StatsChart = {
  drawBarChart(canvasId, labels, datasets, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Retina desteği
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Temizle
    ctx.clearRect(0, 0, width, height);

    // Renk
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';

    // Maksimum değer
    const allValues = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allValues, 1) * 1.1;

    // Grid çizgileri
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      const val = Math.round(maxVal - (maxVal / 4) * i);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillText(val, padding.left - 8, y + 4);
    }

    // Barlar
    const groupWidth = chartWidth / labels.length;
    const barWidth = Math.min(groupWidth * 0.6 / datasets.length, 30);
    const groupOffset = (groupWidth - barWidth * datasets.length) / 2;

    datasets.forEach((dataset, di) => {
      ctx.fillStyle = dataset.color || '#6366f1';

      dataset.data.forEach((val, i) => {
        const x = padding.left + i * groupWidth + groupOffset + di * barWidth;
        const barHeight = (val / maxVal) * chartHeight;
        const y = padding.top + chartHeight - barHeight;

        // Yuvarlak köşeli bar
        const radius = Math.min(4, barWidth / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, padding.top + chartHeight);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      });
    });

    // X ekseni etiketleri
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '11px Inter, sans-serif';

    labels.forEach((label, i) => {
      const x = padding.left + i * groupWidth + groupWidth / 2;
      ctx.fillText(label, x, height - 10);
    });
  },

  drawDonut(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.6;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Henüz veri yok', centerX, centerY);
      return;
    }

    let startAngle = -Math.PI / 2;

    data.forEach(d => {
      const sliceAngle = (d.value / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();

      startAngle += sliceAngle;
    });

    // Ortadaki toplam
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(total, centerX, centerY + 2);
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Toplam', centerX, centerY + 20);
  }
};