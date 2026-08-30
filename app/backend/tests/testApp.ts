import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import robotRoutes from '../src/routes/robots';
import { errorHandler } from '../src/middleware/errorHandler';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/robots', robotRoutes);

// Spec #51: `errorHandler` is what turns a thrown AppError into the standard
// `{ error, code, details }` body. Without it Express's default handler sends the
// correct status with an EMPTY body, so any assertion on `body.error` or `body.code`
// read `undefined` while the status looked right. This app is shared by several
// suites, all of which were affected.
app.use(errorHandler);

export default app;
