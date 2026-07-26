import express from 'express';
import cors from 'cors';
import './db.js';
import { router } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`FX Macro API listening on http://localhost:${PORT}`);
});
