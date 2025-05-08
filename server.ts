import express from 'express';
import next from 'next';
import https from 'https';
import fs from 'fs';

const port = 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem'),
};

app.prepare().then(() => {
    const server = express();

    server.all('*', (req, res) => {
        return handle(req, res);
    });

    https.createServer(httpsOptions, server).listen(port, () => {
        console.log(`> Ready on https://localhost:${port}`);
    });
});