const express = require('express');
const session = require('express-session');
const fs = require('fs');
const https = require('https');
const path = require('path');
const flash = require('connect-flash');
require('dotenv').config();

const app = express();

// 🔗 Importa rotas
const comercialRoutes = require('./routes/comercial');

// 🔐 Certificados HTTPS
const certPath = path.join(__dirname, 'certificado');
const sslOptions = {
  key: fs.readFileSync(path.join(certPath, process.env.SSL_KEY || 'grupotelles_com.key')),
  cert: fs.readFileSync(path.join(certPath, process.env.SSL_CERT || 'grupotelles_com.pem'))
};

// 🔒 Sessão segura
app.use(session({
  secret: 'App@2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,          // Obrigatório com HTTPS
    sameSite: 'none',      // Permite cookies em cross-site
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 dias
  }
}));

app.use(flash());


const verificaPermissaoNF = require('./permissao/verificaPermissaoNF');
app.use(verificaPermissaoNF); // ? AGORA pode usar

// ⚙️ Configurações Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🛣️ Rotas
app.use('/comercial', comercialRoutes);

// ?? ROTA DA DOCUMENTAÇÃO (doc.ejs)
// Como o arquivo está em views/tb_comercial/doc.ejs
app.get('/comercial/documentacao', (req, res) => {
  if (req.session.logged_in) {
    res.render('tb_comercial/doc', { 
      usuario: req.session.usuario || 'Usuário',
      permissaoNF: req.session.permissaoNF || false,
      pode_acessar: true,
      title: 'Manual do Sistema'
    });
  } else {
    res.redirect('/comercial/login');
  }
});

// 🏠 Rota principal
app.get('/', (req, res) => {
  if (req.session.logged_in) {
    res.redirect('/comercial');
  } else {
    res.redirect('/comercial/login');
  }
});

// 404 - Página não encontrada
app.use((req, res) => {
  res.status(404).render('index_comercial/404');
});

// ❌ Middleware para 404 - Rota não encontrada
app.use((req, res, next) => {
  res.status(404).render('404', { titulo: 'Página não encontrada' }); // precisa de views/404.ejs
});

// Middleware de erro global (último da cadeia)
app.use((err, req, res, next) => {
  console.error('? Erro capturado:', err.stack);

  if (res.headersSent) {
    return next(err);
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
    return res.status(500).json({
      status: 'erro',
      mensagem: err.message || 'Erro interno no servidor'
    });
  }

  res.status(err.status || 500).render('index_comercial/erro', {
    codigo: err.status || 500,                         // ? Esta linha é essencial
    mensagem: err.message || 'Erro inesperado no sistema.'
  });
});

// 🚀 Inicialização do servidor HTTPS
const PORT = process.env.PORT || 5000;
const hostname = require('os').hostname();

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`🚀 Servidor HTTPS iniciado: https://${hostname}.grupotelles.com:${PORT}`);
});
