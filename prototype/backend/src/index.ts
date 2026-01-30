import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import facilityRoutes from './routes/facility';
import robotRoutes from './routes/robots';
import weaponRoutes from './routes/weapons';
import weaponInventoryRoutes from './routes/weaponInventory';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Armoured Souls API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/robots', robotRoutes);
app.use('/api/weapons', weaponRoutes);
app.use('/api/weapon-inventory', weaponInventoryRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
