require('dotenv').config(); // Carrega variáveis do .env
const knex = require('knex');

// Função genérica para criar conexões
function criarConexao({ host, user, password, database }) {
  return knex({
    client: 'mssql',
    connection: {
      host,
      user,
      password,
      database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 120000
      }
    },
    pool: { min: 2, max: 10 }
  });
}

// Criação das conexões usando variáveis de ambiente
const APP = criarConexao({
  host: process.env.APP_HOST,
  user: process.env.APP_USER,
  password: process.env.APP_PASS,
  database: process.env.APP_DB
});

const DTW = criarConexao({
  host: process.env.DTW_HOST,
  user: process.env.DTW_USER,
  password: process.env.DTW_PASS,
  database: process.env.DTW_DB
});

const STE = criarConexao({
  host: process.env.STE_HOST,
  user: process.env.STE_USER,
  password: process.env.STE_PASS,
  database: process.env.STE_DB
});

const TRIM = criarConexao({
  host: process.env.TRIM_HOST,
  user: process.env.TRIM_USER,
  password: process.env.TRIM_PASS,
  database: process.env.TRIM_DB
});

const TRIMP = criarConexao({
  host: process.env.TRIMP_HOST,
  user: process.env.TRIMP_USER,
  password: process.env.TRIMP_PASS,
  database: process.env.TRIMP_DB
});

module.exports = { APP, DTW, STE, TRIM, TRIMP };
