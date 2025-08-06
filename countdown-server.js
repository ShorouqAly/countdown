const express = require('express');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');

const app = express();
const port = process.env.PORT || 3000;

// Target: Sept 13, 2025 at 9:00 AM CET (7:00 UTC)
const targetDate = new Date(Date.UTC(2025, 8, 13, 7, 0, 0));

app.get('/countdown.gif', (req, res) => {
    const width = 300;
    const height = 100;
    const encoder = new GIFEncoder(width, height);

    res.setHeader('Content-Type', 'image/gif');
    encoder.createReadStream().pipe(res);

    encoder.start();
    encoder.setRepeat(0);     // 0 = loop forever
    encoder.setDelay(1000);   // 1 frame per second
    encoder.setQuality(10);

    for (let i = 0; i < 3 * 60; i++) { // 3 minutes of frames
        const now = new Date();
        let diff = Math.max(0, Math.floor((targetDate - now) / 1000) - i);

        const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
        diff %= 3600;
        const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
        const seconds = String(diff % 60).padStart(2, '0');

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Text style
        ctx.fillStyle = '#FF7A00';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${hours}:${minutes}:${seconds}`, width / 2, height / 2 + 10);

        encoder.addFrame(ctx);
    }

    encoder.finish();
});

app.listen(port, () => {
    console.log(`Countdown GIF server running at http://localhost:${port}/countdown.gif`);
});
