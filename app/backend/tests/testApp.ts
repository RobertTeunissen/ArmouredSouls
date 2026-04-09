import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import robotRoutes from '../src/routes/robots';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/robots', robotRoutes);

export default app;
