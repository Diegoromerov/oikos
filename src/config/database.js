const { Sequelize } = require('sequelize');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

let sequelize;

if (process.env.NODE_ENV === 'test') {
  const { newDb } = require('pg-mem');
  const pgMem = newDb();
  const pg = pgMem.adapters.createPg();
  sequelize = new Sequelize('postgres://', {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false
  });
} else if (connectionString) {
  sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: false
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'beauty_db',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'postgres',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      logging: false
    }
  );
}

const testSequelizeConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Sequelize: Conexión exitosa a la base de datos.');
    return true;
  } catch (error) {
    console.error('❌ Sequelize: Error de conexión:', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  testSequelizeConnection
};
