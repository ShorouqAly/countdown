const express = require('express');
const { createCanvas } = require('canvas');

const app = express();
const port = 3000;

const targetDate = new Date(Date.UTC(2025, 8, 13, 7, 0, 0));

app.get('/countdown', (req, res) => {
    const now = new Date();
    let diff = Math.max(0, Math.floor((targetDate - now) / 1000));

    const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
    diff %= 3600;
    const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
    const seconds = String(diff % 60).padStart(2, '0');

    const canvas = createCanvas(300, 100);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 300, 100);

    // Text style
    ctx.fillStyle = '#FF7A00';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';

    ctx.fillText(`${hours}:${minutes}:${seconds}`, 150, 60);

    res.setHeader('Content-Type', 'image/png');
    canvas.createPNGStream().pipe(res);
});

app.listen(port, () => {
    console.log(`Countdown server running on http://localhost:${port}`);
});
