import 'reflect-metadata';
import app from './app';
import { AppDataSource } from './config/db';
import { startEventConsumers } from './queue/consumers';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3001;

AppDataSource.initialize()
  .then(() => {
    console.log('✅ Conexión a PostgreSQL establecida');
    startEventConsumers();
    app.listen(PORT, () => {
      console.log(`🚀 MS-Auth corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error al conectar la base de datos:', err);
  });
