const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// Instância de axios que ignora SSL inválido (uso interno apenas)
const axiosInseguro = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// Caminho do arquivo de log
const logFile = path.join(__dirname, '..', 'log', 'api.log');

// Função para logar também em arquivo
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}\n`;

  // Cria pasta se não existir
  const dir = path.dirname(logFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  fs.appendFile(logFile, fullMessage, (err) => {
    if (err) console.error('[LOG] Falha ao escrever no log:', err.message);
  });
}

// Autenticação via Active Directory (API)
async function loginAD(usuario, senha) {
  try {
    const response = await axiosInseguro.post(`${config.API_BASE_URL}/autenticar-AD`, {
      usuario,
      senha
    });

    if (response.status !== 200 || response.data?.error) {
      const msg = `[LOGIN AD] Erro de autenticação para ${usuario}: ${JSON.stringify(response.data)}`;
      console.warn(msg);
      logToFile(msg);
      return { error: true, detail: response.data?.message || 'Falha na autenticação' };
    }

    const sucesso = `[LOGIN AD] Sucesso para ${usuario}`;
    console.log(sucesso);
    logToFile(sucesso);

    return response.data;
  } catch (err) {
    const msg = `[LOGIN AD] Erro de conexão para ${usuario}: ${err.message}`;
    console.error(msg);
    logToFile(msg);
    return { error: true, detail: err.message };
  }
}

// Lista arquivos PDF de uma pasta (via API)
async function listarArquivosAPI(diretorio) {
  const url = `${config.API_BASE_URL}/listar_arquivos?directory=${encodeURIComponent(diretorio)}`;
  try {
    const response = await axiosInseguro.get(url);

    if (response.status !== 200 || !response.data) {
      const msg = `[LISTAR ARQUIVOS] Resposta inválida ao listar: ${diretorio} - Status: ${response.status}`;
      console.warn(msg);
      logToFile(msg);
      return [];
    }

    return response.data.arquivos || [];
  } catch (err) {
    const msg = `[LISTAR ARQUIVOS] Erro ao acessar ${diretorio}: ${err.message}`;
    console.error(msg);
    logToFile(msg);
    return [];
  }
}

// Gera URL para visualização de arquivo
async function visualizarArquivoAPI(caminho) {
  const url = `${config.API_BASE_URL}/arquivo?directory=${encodeURIComponent(caminho)}&download=0`;
  const msg = `[VISUALIZAR ARQUIVO] Gerando URL para: ${caminho}`;
  console.log(msg);
  logToFile(msg);
  return url;
}

module.exports = {
  loginAD,
  listarArquivosAPI,
  visualizarArquivoAPI
};
