const express = require('express');
const { createCanvas } = require('canvas');

const app = express();
const port = 3000;

const targetDate = new Date(Date.UTC(2025, 8, 13, 7, 0, 0)); // Sept 13, 2025, 7:00 UTC

app.get('/countdown.gif', (req, res) => {
    const now = new Date();
    let diff = Math.max(0, Math.floor((targetDate - now) / 1000));

    const days = String(Math.floor(diff / (24 * 3600))).padStart(2, '0');
    diff %= 24 * 3600;
    const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
    diff %= 3600;
    const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
    const seconds = String(diff % 60).padStart(2, '0');

    const canvas = createCanvas(400, 120);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Orange countdown numbers
    ctx.fillStyle = '#FF7A00';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';

    const positions = [50, 150, 250, 350];

    ctx.fillText(days, positions[0], 50);
    ctx.fillText(hours, positions[1], 50);
    ctx.fillText(minutes, positions[2], 50);
    ctx.fillText(seconds, positions[3], 50);

    // Labels below
    ctx.font = '16px Arial';
    ctx.fillText('Days', positions[0], 90);
    ctx.fillText('Hours', positions[1], 90);
    ctx.fillText('Minutes', positions[2], 90);
    ctx.fillText('Seconds', positions[3], 90);

    res.setHeader('Content-Type', 'image/png');
    canvas.createPNGStream().pipe(res);
});

app.listen(port, () => {
    console.log(`Countdown server running on http://localhost:${port}`);
});
