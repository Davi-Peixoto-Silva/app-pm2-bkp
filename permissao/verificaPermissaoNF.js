// permissao/verificaPermissaoNF.js
const fs = require('fs');
const path = require('path');

const arquivoUsuarios = path.join(__dirname, 'usuarios_permitidos.txt');

function verificaPermissaoNF(req, res, next) {
  let usuariosPermitidos = [];

  try {
    const conteudo = fs.readFileSync(arquivoUsuarios, 'utf-8');
    usuariosPermitidos = conteudo
      .split('\n')
      .map(linha => linha.trim().toLowerCase())
      .filter(linha => linha.length > 0);
  } catch (erro) {
    console.error('Erro ao ler lista de usuários permitidos:', erro.message);
  }

  const usuarioAtual = (req.session?.username || '').toLowerCase();
  res.locals.permissaoNF = usuariosPermitidos.includes(usuarioAtual);

  next();
}

module.exports = verificaPermissaoNF;
