const express = require('express');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');

const app = express();
const port = 3000;

// Target: Sept 13, 2025, 9:00 AM CET = 7:00 AM UTC
const targetDate = new Date(Date.UTC(2025, 8, 13, 7, 0, 0));

app.get('/countdown.gif', (req, res) => {
    const now = new Date();
    const totalSeconds = Math.max(0, Math.floor((targetDate - now) / 1000));
    const duration = Math.min(totalSeconds, 180); // Max 60 frames (60 seconds)

    const width = 340; // Adjusted tightly
    const height = 80;

    const encoder = new GIFEncoder(width, height);
    res.setHeader('Content-Type', 'image/gif');
    encoder.createReadStream().pipe(res);

    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(1000);
    encoder.setQuality(10);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i <= duration; i++) {
        let diff = totalSeconds - i;

        const days = String(Math.floor(diff / (24 * 3600))).padStart(2, '0');
        diff %= 24 * 3600;
        const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
        diff %= 3600;
        const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
        const seconds = String(diff % 60).padStart(2, '0');

        const timeParts = [days, hours, minutes, seconds];
        const labels = ['Days', 'Hours', 'Minutes', 'Seconds'];

        // Clear background (white)
        ctx.fillStyle = '#ffffff';
        ctx.clearRect(0, 0, width, height);
        ctx.fillRect(0, 0, width, height);

        // Digits
        ctx.fillStyle = '#FF7A00';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';

        const positions = [55, 135, 215, 295]; // X positions for numbers
        for (let j = 0; j < 4; j++) {
            ctx.fillText(timeParts[j], positions[j], 48);
        }

        // Colons
        ctx.fillText(':', 95, 48);
        ctx.fillText(':', 175, 48);
        ctx.fillText(':', 255, 48);

        // Labels
        ctx.font = '14px Arial';
        for (let j = 0; j < 4; j++) {
            ctx.fillText(labels[j], positions[j], 72);
        }

        encoder.addFrame(ctx);
    }

    encoder.finish();
});

app.listen(port, () => {
    console.log(`Countdown server running at http://localhost:${port}/countdown.gif`);
});
