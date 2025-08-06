const express = require('express');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');

const app = express();
const port = 3000;

// 1-minute countdown = 60 seconds
const countdownDuration = 60;

app.get('/countdown.gif', (req, res) => {
    const encoder = new GIFEncoder(500, 150);
    res.setHeader('Content-Type', 'image/gif');
    encoder.createReadStream().pipe(res);

    encoder.start();
    encoder.setRepeat(0); // loop forever
    encoder.setDelay(1000); // 1 second per frame
    encoder.setQuality(10);

    const canvas = createCanvas(500, 150);
    const ctx = canvas.getContext('2d');

    for (let i = countdownDuration; i >= 0; i--) {
        let diff = i;

        const days = String(Math.floor(diff / (24 * 3600))).padStart(2, '0');
        diff %= 24 * 3600;
        const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
        diff %= 3600;
        const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
        const seconds = String(diff % 60).padStart(2, '0');

        const timeText = `${days} : ${hours} : ${minutes} : ${seconds}`;

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Countdown digits
        ctx.fillStyle = '#FF7A00';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(timeText, 250, 70);

        // Labels
        ctx.font = '13px Arial';
        const labels = ['Days', 'Hours', 'Minutes', 'Seconds'];
        const positions = [100, 180, 270, 360];

        for (let j = 0; j < labels.length; j++) {
            ctx.fillText(labels[j], positions[j], 110);
        }

        encoder.addFrame(ctx);
    }

    encoder.finish();
});

app.listen(port, () => {
    console.log(`Countdown server running at http://localhost:${port}/countdown.gif`);
});
