const express = require('express');
const pm2 = require('pm2');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const { exec } = require('child_process');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8006;
// const API_KEY = process.env.API_KEY;
const gitExec = process.env.GIT_PATH;

// --- 1. CONFIGURAÇÃO DE LOGS DE AUDITORIA ---
// Grava em arquivo local todas as ações críticas (restart, stop, update)
const loggerAudit = (action, target, status, details = '') => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ACTION: ${action} | TARGET: ${target} | STATUS: ${status} | ${details}\n`;
    fs.appendFileSync('audit_api.log', logEntry);
};


const listPorts = () => {
  return new Promise((resolve, reject) => {
    exec('netstat -ano -p TCP', (err, stdout) => {
      if (err) return reject(err);

      const lines = stdout.split('\n').slice(4);
      const ports = [];

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(':')) {
          const port = parts[1].split(':').pop();
          ports.push({
            protocol: parts[0],
            localAddress: parts[1],
            foreignAddress: parts[2],
            state: parts[3],
            pid: parts[4]
          });
        }
      });

      resolve(ports);
    });
  });
};

const getProcessByPid = (pid) => {
  return new Promise((resolve) => {
    exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const [name] = stdout.replace(/"/g, '').split(',');
      resolve(name || null);
    });
  });
};


// --- 2. MIDDLEWARES GLOBAIS ---
app.use(cors());
app.use(bodyParser.json());
// Morgan: Loga todas as requisições HTTP no console da API
app.use(morgan('[:date[iso]] :method :url :status - :response-time ms'));

/* ============================================================
   ?? 3. CONFIGURAÇÃO DO SWAGGER (DEFINIÇÕES DE RETORNO)
============================================================ */
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'PM2 God Mode API - Grupo Telles',
    version: '2.8.0',
    description: `
Interface de gerenciamento total para processos Node.js (PM2),
automação de deploys via Git, auditoria de ações críticas
e diagnóstico avançado de portas TCP no servidor.
    `
  },

  /* =========================
     ?? SEGURANÇA
  ========================== */
  // security: [{ ApiKeyAuth: [] }],

  components: {
  //   securitySchemes: {
  //     ApiKeyAuth: {
  //       type: 'apiKey',
  //       in: 'header',
  //       name: 'x-api-key'
  //     }
  //   },

    /* =========================
       ?? SCHEMAS
    ========================== */
    schemas: {
      Processo: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 0 },
          name: { type: 'string', example: 'api-financeiro' },
          status: { type: 'string', example: 'online' },
          cpu: { type: 'string', example: '0.5%' },
          memory: { type: 'string', example: '45.20 MB' },
          restarts: { type: 'integer', example: 3 },
          uptime: { type: 'integer', example: 16728392 },
          path: { type: 'string', example: 'D:\\SHARES\\Santelisa\\api' },
          folder: { type: 'string', example: 'api' }
        }
      },

      LogResponse: {
        type: 'object',
        properties: {
          logs: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },

      AuditLogResponse: {
        type: 'object',
        properties: {
          logs: {
            type: 'array',
            items: {
              type: 'string',
              example: '[2025-12-24T14:00:00Z] ACTION: UPDATE | TARGET: 0 | STATUS: SUCESSO'
            }
          }
        }
      },

      GenericSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Ação executada com sucesso' }
        }
      },

      /* =========================
         ?? PORTAS
      ========================== */
      PortInfo: {
        type: 'object',
        properties: {
          protocol: { type: 'string', example: 'TCP' },
          localAddress: { type: 'string', example: '0.0.0.0:8003' },
          foreignAddress: { type: 'string', example: '0.0.0.0:0' },
          state: { type: 'string', example: 'LISTENING' },
          pid: { type: 'integer', example: 17468 },
          process: { type: 'string', example: 'node.exe' }
        }
      },

      PortCheckResponse: {
        type: 'object',
        properties: {
          used: { type: 'boolean', example: true },
          port: { type: 'integer', example: 8003 },
          details: {
            type: 'array',
            items: { $ref: '#/components/schemas/PortInfo' }
          }
        }
      },

      Pm2PortResponse: {
        type: 'object',
        properties: {
          pm2: { type: 'boolean', example: true },
          id: { type: 'integer', example: 0 },
          name: { type: 'string', example: 'api-financeiro' },
          status: { type: 'string', example: 'online' }
        }
      }
    }
  },

  /* =========================
     ?? ROTAS
  ========================== */
  paths: {

/* ---------- AÇÕES GERAIS ---------- */
    '/save': {
      post: {
        tags: ['Ações'],
        summary: 'Salva o estado atual dos processos PM2 (pm2 save)',
        description: 'Gera um dump da lista de processos atuais para que sejam restaurados automaticamente em caso de reinicialização do servidor.',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericSuccess' }
              }
            }
          },
          500: {
            description: 'Erro interno ao tentar salvar as configurações do PM2.'
          }
        }
      }
    },
    
    '/describe/{id}': {
      get: {
        tags: ['Monitoramento'],
        summary: 'Detalhes completos de um processo PM2',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Processo' }
              }
            }
          },
          404: { description: 'Processo não encontrado' }
        }
      }
    },
    
    /* ---------- MONITORAMENTO ---------- */
    '/list': {
      get: {
        tags: ['Monitoramento'],
        summary: 'Lista todos os processos PM2',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Processo' }
                }
              }
            }
          }
        }
      }
    },

    '/describe/{id}': {
      get: {
        tags: ['Monitoramento'],
        summary: 'Detalhes completos de um processo PM2',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Objeto PM2 detalhado' },
          404: { description: 'Processo não encontrado' }
        }
      }
    },

    /* ---------- LOGS ---------- */
    '/logs/{id}': {
      get: {
        tags: ['Logs'],
        summary: 'Últimas linhas do log PM2',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } },
          { in: 'query', name: 'lines', schema: { type: 'integer', default: 100 } },
          { in: 'query', name: 'type', schema: { type: 'string', enum: ['out', 'err'] } }
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LogResponse' }
              }
            }
          }
        }
      }
    },

    '/view-audit': {
      get: {
        tags: ['Logs'],
        summary: 'Histórico de auditoria da API',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuditLogResponse' }
              }
            }
          }
        }
      }
    },

    /* ---------- PROCESSOS ---------- */
    '/process/{action}': {
      post: {
        tags: ['Ações'],
        summary: 'Executa ações no PM2',
        parameters: [
          {
            in: 'path',
            name: 'action',
            required: true,
            schema: {
              type: 'string',
              enum: ['restart', 'stop', 'delete', 'reload', 'update']
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer' },
                  repoUrl: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericSuccess' }
              }
            }
          }
        }
      }
    },

    /* ---------- PORTAS ---------- */
    '/ports': {
      get: {
        tags: ['Portas'],
        summary: 'Lista todas as portas TCP em uso',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PortInfo' }
                }
              }
            }
          }
        }
      }
    },

    '/ports/{port}': {
      get: {
        tags: ['Portas'],
        summary: 'Verifica se uma porta está em uso',
        parameters: [
          { in: 'path', name: 'port', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PortCheckResponse' }
              }
            }
          }
        }
      },

      delete: {
        tags: ['Portas'],
        summary: 'Finaliza o processo que está usando a porta',
        description: '?? Ação destrutiva – mata o PID diretamente',
        parameters: [
          { in: 'path', name: 'port', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenericSuccess' }
              }
            }
          }
        }
      }
    },

    '/ports/{port}/pm2': {
      get: {
        tags: ['Portas'],
        summary: 'Verifica se a porta pertence a um processo PM2',
        parameters: [
          { in: 'path', name: 'port', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pm2PortResponse' }
              }
            }
          }
        }
      }
    }
  }
};


app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

/* ============================================================
   ?? 4. MIDDLEWARE DE AUTENTICAÇÃO
============================================================ */
// app.use((req, res, next) => {
//     if (req.path.startsWith('/docs')) return next();
//     const key = req.headers['x-api-key'];
//     if (!key || key !== API_KEY) {
//         return res.status(403).json({ error: 'Acesso negado. API Key inválida.' });
//     }
//     next();
// });

// --- HELPER PM2 ---
const withPm2 = (callback, res) => {
    pm2.connect((err) => {
        if (err) {
            console.error("? Erro PM2:", err);
            if (res) return res.status(500).json({ error: 'Erro ao conectar ao PM2' });
            return;
        }
        callback();
    });
};

/* ============================================================
   ?? 5. ROTAS DA API
============================================================ */

// LISTAR PROCESSOS
app.get('/list', (req, res) => {
    withPm2(() => {
        pm2.list((err, list) => {
            if (err) return res.status(500).json({ error: err.message });
            const processes = list.map(proc => ({
                id: proc.pm_id,
                name: proc.name,
                status: proc.pm2_env.status,
                cpu: (proc.monit.cpu || 0) + '%',
                memory: (proc.monit.memory / 1024 / 1024).toFixed(2) + ' MB',
                restarts: proc.pm2_env.restart_time,
                path: proc.pm2_env.pm_cwd || 'N/A',
                uptime: proc.pm2_env.pm_uptime,
                folder: (proc.pm2_env.pm_cwd || '').split(/[\\/]/).filter(Boolean).pop() || '---'
            }));
            res.json(processes);
        });
    }, res);
});

// LER LOGS DO PM2 (OTIMIZADO)
app.get('/logs/:id', (req, res) => {
    const linesToRead = parseInt(req.query.lines) || 100;
    const type = req.query.type || 'out';

    withPm2(() => {
        pm2.describe(req.params.id, (err, list) => {
            if (err || !list || list.length === 0) return res.status(404).json({ error: 'App não encontrado' });
            const proc = list[0];
            const logPath = type === 'err' ? proc.pm2_env.pm_err_log_path : proc.pm2_env.pm_out_log_path;

            if (!fs.existsSync(logPath)) return res.json({ logs: ['Arquivo de log não encontrado.'] });

            // Leitura simples das últimas linhas (para arquivos muito grandes, usar streams)
            fs.readFile(logPath, 'utf8', (err, data) => {
                if (err) return res.status(500).json({ error: 'Falha ao ler log' });
                const lines = data.trim().split('\n');
                res.json({ logs: lines.slice(Math.max(lines.length - linesToRead, 0)) });
            });
        });
    }, res);
});

// AÇÕES DE PROCESSO + AUDITORIA
app.post('/process/:action', (req, res) => {
  const { action } = req.params;
  const target = req.body.id;
  const repoUrl = req.body.repoUrl;

  if (target === undefined) return res.status(400).json({ error: 'Informe o ID.' });

  withPm2(() => {
      if (action === 'update') {
          pm2.describe(target, (dErr, list) => {
              if (dErr || !list.length) {
                  return res.status(404).json({ error: 'App não encontrado' });
              }

              // Essa linha garante que funciona para QUALQUER aplicação, pegando a pasta correta do ID
              const pasta = list[0].pm2_env.pm_cwd;
              const temGit = fs.existsSync(path.join(pasta, '.git'));

              // Ajustamos a função para ignorar erros se não houver o que salvar
              const executarComando = (comando, callback, ignorarErro = false) => {
                  exec(comando, { cwd: pasta }, (err, stdout, stderr) => {
                      if (err && !ignorarErro) {
                          console.error(`ERRO CMD (${comando}):`, err);
                          return res.status(500).json({
                              error: err.message,
                              details: stderr
                          });
                      }
                      callback(stdout);
                  });
              };

              const finalizarUpdate = () => {
                  loggerAudit('UPDATE', target, 'INFO', 'Rodando npm install...');
                  executarComando('npm install', () => {
                      pm2.restart(target, (rErr) => {
                          if (rErr) return res.status(500).json({ error: rErr.message });

                          loggerAudit('UPDATE', target, 'SUCESSO', 'Versão salva e PM2 reiniciado');
                          res.json({
                              success: true,
                              message: 'Projeto salvo no Git, pacotes atualizados e serviço reiniciado com sucesso!'
                          });
                      });
                  }, true); // Ignora erro de npm install se não for necessário
              };

              // =========================
              // CASO NÃO TENHA .GIT ?? CLONE INICIAL
              // =========================
              if (!temGit && repoUrl) {
                  loggerAudit('CLONE', target, 'INICIANDO', repoUrl);
                  executarComando(`"${gitExec}" clone ${repoUrl} .`, () => {
                      executarComando(`"${gitExec}" branch -r`, (branches) => {
                          const branch = branches.includes('origin/main') ? 'main' : 'master';
                          executarComando(`"${gitExec}" checkout ${branch}`, finalizarUpdate);
                      });
                  });
              }
              
              // =========================
              // CASO TENHA .GIT ?? SALVAR (COMMIT) E ENVIAR
              // =========================
              else if (temGit) {
                  loggerAudit('UPDATE', target, 'INICIANDO', 'Salvando versão local no Git...');

                  // 1. Prepara todos os arquivos modificados
                  executarComando(`"${gitExec}" add .`, () => {
                      
                      // 2. Cria o commit com a data exata da ação
                      const dataFormatada = new Date().toLocaleString('pt-BR').replace(/[\/:]/g, '-');
                      const msgCommit = `"Auto-backup via Painel PM2 em ${dataFormatada}"`;
                      
                      // ignorarErro=true aqui, porque se não houver arquivo modificado, o git commit gera um 'erro' que podemos ignorar
                      executarComando(`"${gitExec}" commit -m ${msgCommit}`, () => {
                          
                          // 3. (Opcional) Envia para o repositório remoto. 
                          // Ignora erro caso o servidor não tenha permissão de push no momento.
                          executarComando(`"${gitExec}" push origin HEAD`, () => {
                              finalizarUpdate();
                          }, true);

                      }, true);
                  });
              } else {
                  res.status(400).json({ error: "Pasta sem .git e sem repoUrl fornecido." });
              }
          });
          return;
      }

      // Ações padrão: restart, stop, delete, reload
      if (typeof pm2[action] !== 'function') return res.status(400).json({ error: 'Ação inválida' });
      pm2[action](target, (err) => {
          if (err) return res.status(500).json({ error: err.message });
          loggerAudit(action, target, 'SUCESSO');
          res.json({ success: true, message: `Ação ${action} concluída` });
      });
  }, res);
});
// VER LOG DE AUDITORIA DA PRÓPRIA API
app.get('/view-audit', (req, res) => {
    if (!fs.existsSync('audit_api.log')) return res.json({ logs: [] });
    const data = fs.readFileSync('audit_api.log', 'utf8');
    res.json({ logs: data.trim().split('\n').reverse().slice(0, 100) });
});

app.get('/ports', async (req, res) => {
  try {
    const ports = await listPorts();

    const detailed = await Promise.all(
      ports.map(async p => ({
        ...p,
        process: await getProcessByPid(p.pid)
      }))
    );

    res.json(detailed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/ports/:port', async (req, res) => {
  const port = req.params.port;

  const ports = await listPorts();
  const found = ports.filter(p => p.localAddress.endsWith(`:${port}`));

  if (!found.length) {
    return res.json({ used: false, port });
  }

  const detailed = await Promise.all(
    found.map(async p => ({
      ...p,
      process: await getProcessByPid(p.pid)
    }))
  );

  res.json({ used: true, port, details: detailed });
});

app.delete('/ports/:port', async (req, res) => {
  const port = req.params.port;

  const ports = await listPorts();
  const found = ports.find(p => p.localAddress.endsWith(`:${port}`));

  if (!found) {
    return res.status(404).json({ error: 'Porta não está em uso' });
  }

  exec(`taskkill /PID ${found.pid} /F`, (err) => {
    if (err) {
      loggerAudit('KILL_PORT', port, 'ERRO', err.message);
      return res.status(500).json({ error: 'Falha ao matar processo' });
    }

    loggerAudit('KILL_PORT', port, 'SUCESSO', `PID ${found.pid}`);
    res.json({ success: true, port, pid: found.pid });
  });
});

app.get('/ports/:port/pm2', async (req, res) => {
  const port = req.params.port;

  withPm2(() => {
    pm2.list(async (err, list) => {
      if (err) return res.status(500).json({ error: err.message });

      const match = list.find(p =>
        JSON.stringify(p.pm2_env).includes(`:${port}`)
      );

      if (!match) {
        return res.json({ pm2: false });
      }

      res.json({
        pm2: true,
        id: match.pm_id,
        name: match.name,
        status: match.pm2_env.status
      });
    });
  }, res);
});


// --- SALVAR ESTADO DO PM2 (pm2 save) ---
app.post('/save', (req, res) => {
    withPm2(() => {
        // O método dump() é a API interna do PM2 para o comando 'pm2 save'
        pm2.dump((err, result) => {
            if (err) {
                console.error("Erro ao salvar PM2:", err);
                return res.status(500).json({ error: 'Falha ao salvar a lista do PM2.' });
            }
            
            // Registra na sua auditoria
            loggerAudit('SAVE', 'ALL', 'SUCESSO', 'Configurações do PM2 salvas (dump)');
            
            res.json({ 
                success: true, 
                message: 'Estado do PM2 salvo! Os apps voltarão automaticamente se o servidor reiniciar.' 
            });
        });
    }, res);
});


// DETALHAR PROCESSO PM2
app.get('/describe/:id', (req, res) => {
  const id = req.params.id;

  withPm2(() => {
      pm2.describe(id, (err, list) => {
          if (err) {
              return res.status(500).json({ error: err.message });
          }

          if (!list || list.length === 0) {
              return res.status(404).json({ error: 'Processo não encontrado' });
          }

          const proc = list[0];

          res.json({
              id: proc.pm_id,
              name: proc.name,
              status: proc.pm2_env.status,
              version: proc.pm2_env.version || 'N/A',
              script: proc.pm2_env.pm_exec_path,
              cwd: proc.pm2_env.pm_cwd,
              args: proc.pm2_env.args,
              node_version: proc.pm2_env.node_version,
              restart_time: proc.pm2_env.restart_time,
              created_at: proc.pm2_env.created_at,
              uptime: proc.pm2_env.pm_uptime,
              instances: proc.pm2_env.instances,
              watch: proc.pm2_env.watch,
              env: proc.pm2_env.env
          });
      });
  }, res);
});


/* ============================================================
   ??? 6. INICIALIZAÇÃO
============================================================ */
try {
    const httpsOptions = {
        key: fs.readFileSync('./certificado/gt.key'),
        cert: fs.readFileSync('./certificado/gt.pem'),
        passphrase: process.env.SSL_PASSPHRASE
    };
    https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`? API SEGURA EM: https://localhost:${PORT}`);
    });
} catch (e) {
    console.warn("?? SSL não encontrado. Rodando em HTTP.");
    app.listen(PORT, () => console.log(`?? API EM: http://localhost:${PORT}`));
}