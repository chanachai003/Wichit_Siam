import dotenv from 'dotenv';
// โหลด env
dotenv.config();

import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// สร้าง __dirname (สำคัญมากใน ES Module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// init app
const app = express();

// CORS config
const allowedOrigins = new Set([
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://wichitsiam-frontend.vercel.app',
    ...(process.env.CORS_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
]);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
}));
app.use(express.json());

// serve uploads (สำคัญมาก)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
    res.json({ message: 'Wichit Siam API is running' });
});

// import routes
import authRoutes from './routes/auth.js';
import photoRoutes from './routes/photos.js';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err);

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            message: 'Invalid JSON'
        });
    }

    if (err.name === 'MulterError') {
        return res.status(400).json({ message: err.message });
    }

    if (err.message === 'Only image files allowed') {
        return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Internal Server Error' });
});

// start server
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});