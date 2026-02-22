const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const { loginRequired, verificarPermissao } = require('../middleware/auth');
const conexoes = require('../utils/db');
const { Console } = require('console');
const moment = require('moment');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const APPknex = conexoes.APP;
const DTWknex = conexoes.DTW;
const STEknex = conexoes.STE;
const TRIMknex = conexoes.TRIM;
const TRIMPknex = conexoes.TRIMP;

const API_BASE_URL_NF = process.env.API_BASE_URL_NF || 'https://app.grupotelles.com:8010/api';

function verificarAutenticacao(req, res, next) {
  if (req.session.logged_in) {
    next();
  } else {
    res.redirect('/comercial/login');
  }
}

function converterDadosColunas(dados) {
  if (!Array.isArray(dados) || dados.length === 0) {
    return { colunas: [], dadosFormatados: [] };
  }

  const colunas = Object.keys(dados[0]);

  const dadosFormatados = dados.map(linha => {
    const novo = {};
    colunas.forEach(coluna => {
      let valor = linha[coluna];
      if (valor === null || valor === undefined) valor = '';
      if (typeof valor === 'string') valor = valor.replace(/\r\n/g, ' ').trim();
      if (valor instanceof Date) valor = valor.toLocaleString('pt-BR');
      novo[coluna] = valor;
    });
    return novo;
  });

  return { colunas, dadosFormatados };
}

module.exports = { converterDadosColunas };

router.get('/login', (req, res) => {
  res.render('index_comercial/login', {
    erro: null,
    detalhe: null
  });
});

router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const apiUrl = 'https://app.grupotelles.com:8010/api/autenticar-AD';

  try {
    const response = await axios.post(apiUrl, { usuario, senha }, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const data = response.data;

    if (data?.error) {
      return res.render('index_comercial/login', {
        erro: 'Usuário ou senha inválidos',
        detalhe: data.error
      });
    }

    req.session.logged_in = true;
    req.session.username = usuario.toUpperCase(); 
    req.session.usuario = usuario.toUpperCase();   // 🔥 Esta linha resolve o problema!

    res.redirect('/comercial/');
  } catch (err) {
    console.error('? Erro ao autenticar na API AD:', err.message);
    res.render('index_comercial/login', {
      erro: 'Falha na autenticação',
      detalhe: err.message
    });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('? Erro ao destruir sessão:', err);
      return res.status(500).send('Erro ao sair');
    }
    res.redirect('/comercial/login');
  });
});

router.get('/forcar-erro', (req, res) => {
  res.render('index_comercial/erro',  {
    titulo: 'Erro de Teste',
    mensagem: 'Essa é uma simulação de erro.',
    detalhe: 'Detalhes técnicos fictícios.'
  });
});

function verificarArquivosEObterCliente(cnpj, nf) {
  const notaPath = `C:/Temp/nota${cnpj}/nota${nf}.pdf`;
  const boletoPath = `C:/Temp/boleto${cnpj}/boleto${nf}.pdf`;

  const temNota = fs.existsSync(notaPath);
  const temBoleto = fs.existsSync(boletoPath);

  return new Promise(async (resolve, reject) => {
    try {
      const query = `
        SELECT TOP 1 Cliente 
        FROM [VW Baixar NF Santelisa] 
        WHERE [CNPJ/CPF] = '${cnpj}' AND NF = '${nf}'
      `;
      const resultado = await DTWknex.raw(query);
      const cliente = resultado?.[0]?.Cliente || 'Não encontrado';

      resolve({
        cliente: { Cliente: cliente },
        temNota,
        temBoleto,
        linkNota: temNota ? `${API_BASE_URL_NF}/arquivo?directory=${encodeURIComponent(notaPath)}&download=1` : '',
        linkBoleto: temBoleto ? `${API_BASE_URL_NF}/arquivo?directory=${encodeURIComponent(boletoPath)}&download=1` : ''
      });
    } catch (e) {
      reject(e);
    }
  });
}
router.get('/', verificarAutenticacao, async (req, res) => {
  try {
    const usuario = req.session.username.toLowerCase();
    const pode_acessar = true; // ou await verificarPermissao(usuario);
    res.render('index_comercial/index', { usuario, pode_acessar });
  } catch (error) {
    console.error('? Erro ao carregar a página inicial:', error);
    res.status(500).render('erro', {
      titulo: 'Erro ao carregar página',
      mensagem: 'Ocorreu um erro inesperado ao tentar carregar a página inicial.',
      detalhe: error.message
    });
  }
});

router.post('/observacoes-comerciais', async (req, res, next) => {
  const { pedido, observacao } = req.body;
  const usuario = req.session?.username || 'desconhecido'; // <- Aqui pegando correto da sessão

  if (!pedido || !observacao) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  try {
    const existente = await STEknex('ObservacoesComerciais').where('Pedido', pedido).first();

    if (existente) {
      await STEknex('ObservacoesComerciais')
        .where('Pedido', pedido)
        .update({
          Observacao: observacao,
          UsuarioAlteracao: usuario,
          DataAlteracao: STEknex.fn.now()
        });
    } else {
      await STEknex('ObservacoesComerciais').insert({
        Pedido: pedido,
        Observacao: observacao,
        Usuario: usuario,
        DataRegistro: STEknex.fn.now()
      });
    }

    const dataAtual = new Date().toLocaleString('pt-BR'); // <- Padrão brasileiro já no formato
    res.json({ status: 'ok', usuario, data_alteracao: dataAtual }); // <- 🔥 envia usuário e hora
  } catch (error) {
    console.error('❌ Erro ao salvar observação comercial:', error);
    res.status(500).json({ status: 'erro', mensagem: 'Erro interno ao salvar observação.' });
  }
});

router.get('/consulta-saldo-exp', verificarAutenticacao, async (req, res, next) => {
  try {
    const dados = await STEknex.select('*').from('vw_ConsultaSaldoExpAPP');
    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorio', {
      produtos: dados,
      colunas,
      aba: 'Expedição',
      titulo: 'Saldo Expedição - TRIMBOX'
    });
  } catch (error) {
    console.error('❌ Erro ao consultar saldo de expedição:', error);
    next(error);  // chama o middleware final de erro
  }
});

router.get('/consulta-saldo-exp-diferenca', verificarAutenticacao, async (req, res, next) => {
  try {
    const dados = await STEknex.select('*').from('VW_SaldoTRIM_DataSul').orderBy('StatusQtd');
    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Expedição',
      titulo: 'Expedição: TRIMBOX x DATASUL - Saldo'
    });
  } catch (error) {
    console.error('❌ Erro ao consultar saldo de expedição (diferença):', error);
    next(error);
  }
});

router.get('/consulta-saldo-aparas-diferenca', verificarAutenticacao, async (req, res, next) => {
  try {
    const dados = await DTWknex.select('*').from('VW_ConsultaAparasAPP');
    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Aparas',
      titulo: 'Aparas: TRIMPAPER x DATASUL - Saldo'
    });
  } catch (error) {
    console.error('❌ Erro ao consultar saldo de aparas:', error);
    next(error);
  }
});

router.get('/consulta-saldo-bobina-diferenca', verificarAutenticacao, async (req, res, next) => {
  try {
    const dados = await DTWknex.select('*').from('VW_ConsultaBobinaAPP');
    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Bobinas',
      titulo: 'Bobinas: TRIMPAPER x DATASUL - Saldo'
    });
  } catch (error) {
    console.error('❌ Erro ao consultar saldo de bobinas:', error);
    next(error);
  }
});

router.all('/consultar-saldo-estoque', verificarAutenticacao, async (req, res, next) => {
  try {
    const item = req.method === 'POST' ? req.body.item : req.query.item;
    const deposito = req.method === 'POST' ? req.body.deposito : req.query.deposito;

    let query = DTWknex.select('*').from('VW_ConsultaSaldoAPP');
    if (item) query.where('Item', 'like', `%${item}%`);
    if (deposito) query.where('Deposito', 'like', `%${deposito}%`);

    const dados = await query;
    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorio', {
      produtos: dados,
      colunas,
      aba: 'Estoque',
      titulo: 'Saldo Estoque DATASUL'
    });
  } catch (error) {
    console.error('❌ Erro ao consultar saldo de estoque:', error);
    next(error);
  }
});

router.all('/consultar-posicao-estoque-bobina', verificarAutenticacao, async (req, res, next) => {
  try {
    const data = req.body.dataPosicaoEstoque || req.query.dataPosicaoEstoque;
    if (!data) return res.render('index_comercial/erro', { error: 'Data não fornecida.' });

    const data_formatada = moment(data).format('YYYY-MM-DD HH:mm:ss');

    await STEknex.raw(`EXEC dbo.ps_RelatBobinasEstoqueDataQualquer '${data_formatada}'`);
    const response = await STEknex.raw('SELECT * FROM dbo.vw_RelBobsEmEstoqueDataQualquerAPP');

    const colunas = response.length ? Object.keys(response[0]) : [];
    res.render('tb_comercial/relatorios', {
      produtos: response,
      colunas,
      aba: 'Estoque',
      titulo: 'Posição de Estoque Bobina - TRIMPAPER'
    });
  } catch (e) {
    next(e);
  }
});

router.all('/consultar-posicao-estoque-aparas', verificarAutenticacao, async (req, res, next) => {
  try {
    const data = req.body.dataPosicaoEstoque || req.query.dataPosicaoEstoque;
    if (!data) return res.render('index_comercial/erro', { error: 'Data não fornecida.' });

    const data_formatada = moment(data).format('YYYY-MM-DD HH:mm:ss');

    await STEknex.raw(`EXEC dbo.ps_RelatAparasEstoqueDataQualquer '${data_formatada}'`);
    const response = await STEknex.raw('SELECT * FROM dbo.VW_RelAparasEstoqueNaData');

    const colunas = response.length ? Object.keys(response[0]) : [];
    res.render('tb_comercial/relatorios', {
      produtos: response,
      colunas,
      aba: 'Estoque',
      titulo: 'Posição de Estoque Aparas - TRIMPAPER'
    });
  } catch (e) {
    next(e);
  }
});

router.all('/consultar-posicao-estoque-acabado', verificarAutenticacao, async (req, res, next) => {
  try {
    const data = req.body.dataPosicaoEstoque || req.query.dataPosicaoEstoque;
    if (!data) return res.render('index_comercial/erro', { error: 'Data não fornecida.' });

    const data_formatada = moment(data).format('YYYY-MM-DD HH:mm:ss');

    await STEknex.raw(`EXEC dbo.ps_RelatExpedicaoEstoqueDataQualquer '${data_formatada}'`);
    const response = await STEknex.raw('SELECT * FROM dbo.VW_RelExpedicaoEstoqueNaData');

    const colunas = response.length ? Object.keys(response[0]) : [];
    res.render('tb_comercial/relatorios', {
      produtos: response,
      colunas,
      aba: 'Estoque',
      titulo: 'Posição de Estoque Expedição - TRIMBOX'
    });
  } catch (e) {
    next(e);
  }
});

router.all('/consultar-posicao-estoque-acabado-hist', verificarAutenticacao, async (req, res, next) => {
  try {
    const data = req.body.dataPosicaoEstoque || req.query.dataPosicaoEstoque;
    if (!data) return res.render('index_comercial/erro', { error: 'Data não fornecida.' });

    const data_formatada = moment(data).format('YYYY-MM-DD HH:mm:ss');

    await STEknex.raw(`EXEC dbo.ps_RelatExpedicaoEstoqueDataQualquer '${data_formatada}'`);
    const response = await STEknex.raw('SELECT * FROM dbo.vw_ComparativoEstoqueAcabado ORDER BY Status, OP;');

    const colunas = response.length ? Object.keys(response[0]) : [];
    res.render('tb_comercial/relatorios', {
      produtos: response,
      colunas,
      aba: 'Estoque',
      titulo: `Comparativo Estoque Expedição ('${data}')- TRIMBOX`
    });
  } catch (e) {
    next(e);
  }
});

router.get('/status-maquina/:maquinaId', async (req, res, next) => {
  const { maquinaId } = req.params;

  try {
    const maquinas = {
      VW_Onduladeira01: 'Onduladeira 01',
      VW_Onduladeira02: 'Onduladeira 02',
      VW_TomasoniFlex: 'Tomasoni Flexo',
      VW_Tomasoni02: 'Tomasoni Flexo 02',
      VW_TomasoniCV: 'Tomasoni CV',
      VW_Sundemba: 'SunDemba',
      VW_AMAR: 'Amarrado',
      VW_DIV: 'Acessório',
      VW_GRAMP1: 'Grampeadeira',
      VW_DIVS: 'Simplex'
    };

    const maq = maquinas[maquinaId];
    if (!maq) {
      return res.status(404).render('index_comercial/erro', {
        codigo: 404,
        mensagem: 'Máquina não encontrada.',
        detalhe: `Máquina solicitada: ${maquinaId}`
      });
    }

    const dados = await STEknex.select('*').from(`[${maquinaId}]`);
    const colunas = dados.length > 0 ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Status da Máquina',
      titulo: `Status da Máquina - ${maq}`
    });

  } catch (error) {
    console.error('❌ Erro ao consultar status-maquina:', error);
    res.status(500).render('index_comercial/erro', {
      codigo: 500,
      mensagem: 'Erro ao consultar status da máquina.',
      detalhe: error.message
    });
  }
});

// NOVA ROTA: Para buscar detalhes da manutenção
router.post('/detalhes-manutencao', async (req, res, next) => {
  try {
    const { date, machine } = req.body;

    if (!date || !machine) {
        return res.status(400).json({ error: 'Data e máquina são obrigatórias.' });
    }

    // Ajusta o nome da máquina se for 'Onduladeira' para corresponder ao banco ('OND')
    const machineQuery = machine === 'Onduladeira' ? 'OND' : machine;

    const query = `
        SELECT 
            CONVERT(VARCHAR(10), Data, 103) AS Data,
            Maquina,
            Maquina as Equipamento,
            DescricaoProg AS Descricao,
            Situacao AS Tipo,
            Tempo,
            Situacao
        FROM vw_Calendario_Manutencao
        WHERE 
            CONVERT(DATE, Data) = ? AND
            Maquina = ?
    `;
    const bindings = [date, machineQuery];

    const dados = await STEknex.raw(query, bindings);
    res.json({ data: dados });

  } catch (error) {
    console.error('Erro ao consultar detalhes da manutenção:', error);
    next(error);
  }
});

router.get('/grafico-cm', async (req, res, next) => {
  try {
    res.render('tb_comercial/grafico-cm', {
      dados: {},
      manutencoes: {}, // ✅ incluído
      filtros_aplicados: {
        startDate: '',
        endDate: '',
        filtro: '',
        entrega: '',
        ativo: '',
        familia: '',
        atraso: ''
      }
    });
  } catch (error) {
    console.error('❌ Erro ao carregar gráfico-cm (GET):', error);
    res.status(500).render('index_comercial/erro', {
      codigo: 500,
      mensagem: 'Erro ao carregar a tela de gráfico de carga por máquina.',
      detalhe: error.message
    });
  }
});

router.post('/grafico-cm', async (req, res) => {
  try {
    // 1. Captura o novo filtro 'tipoData' do corpo da requisição
    let { startDate, endDate, filtroSelect, tipoEntrega, familia, ativo, atraso, tipoData } = req.body;

    // Define 'entrega' como o tipo de data padrão se nenhum for selecionado
    tipoData = tipoData || 'entrega';

    // Valores padrão para outros filtros
    ativo = ativo ?? 'Sim';
    atraso = atraso ?? 'Todas';

    if (!startDate || !endDate) {
      return res.status(400).render('index_comercial/erro', {
        codigo: 400,
        mensagem: 'As datas inicial e final são obrigatórias.'
      });
    }

    // 2. Adiciona o novo filtro ao objeto para retorná-lo à view
    const filtros_aplicados = { startDate, endDate, filtro: filtroSelect, entrega: tipoEntrega, familia, ativo, atraso, tipoData };

    // 3. Determina qual coluna de data usar na query
    const dateColumn = tipoData === 'comercial' ? 'Data_Comercia' : 'Dt_Entrega';

    // Array para os parâmetros da query (bindings)
    const bindings = [startDate, endDate];

    // 4. Modifica a query para usar a coluna de data dinâmica
    let query = `
      WITH AggregatedData AS (
        SELECT
          /* Usamos a variável para selecionar a data e a renomeamos para Dt_Entrega
             para manter a compatibilidade com o resto do código (JS e processamento) */
          CONVERT(varchar, ${dateColumn}, 23) AS Dt_Entrega,
          Maquina1 AS Maquina,
          SUM(ISNULL(Peso_Liq, 0)) AS Peso_Liq,
          AVG(ISNULL(CapacidadeConv, 0)) AS CapacidadeConv,
          AVG(ISNULL(CapacidadeOnd, 0)) AS CapacidadeOnd
        FROM DATASULSTE.dbo.[VW Carga Maquina APP Grafico]
        /* A cláusula WHERE também usa a coluna de data dinâmica */
        WHERE ${dateColumn} BETWEEN ? AND ?
          AND Maquina1 IS NOT NULL
          AND Maquina1 NOT IN ('BALANCAREFGO', 'BARBAN', 'COLMAN', 'COLADEIRA', 'CV', 'Onduladeira', 'OUTROS', 'RISCADOR')
    `;

    // Adiciona os filtros dinamicamente e de forma segura
    if (ativo) {
      query += ` AND Ativo = ?`;
      bindings.push(ativo);
    }
    if (filtroSelect && filtroSelect !== 'Implantado') {
      query += ` AND Filtro = ?`;
      bindings.push(filtroSelect);
    }
    if (tipoEntrega && tipoEntrega !== 'CIF + FOB') {
      query += ` AND CIF_FOB = ?`;
      bindings.push(tipoEntrega);
    }
    if (familia && familia !== 'Todas') {
      query += ` AND Familia_trim = ?`;
      bindings.push(familia);
    }
    if (atraso && atraso !== 'Todas') {
      query += ` AND Atraso = ?`;
      bindings.push(atraso);
    }

    // O GROUP BY também deve usar a coluna de data dinâmica
    query += `
        GROUP BY CONVERT(varchar, ${dateColumn}, 23), Maquina1
      ),
      Onduladeira AS (
        SELECT Dt_Entrega, 'Onduladeira' AS Maquina, SUM(Peso_Liq) AS Peso_Liq, AVG(CapacidadeOnd) AS Capacidade
        FROM AggregatedData
        WHERE CapacidadeOnd > 0
        GROUP BY Dt_Entrega
      ),
      Conversao AS (
        SELECT Dt_Entrega, Maquina, Peso_Liq, CapacidadeConv AS Capacidade
        FROM AggregatedData
      ),
      FinalData AS (
        SELECT * FROM Onduladeira
        UNION ALL
        SELECT * FROM Conversao
      )
      SELECT * FROM FinalData
      ORDER BY
      CASE Maquina
        WHEN 'Onduladeira' THEN 1
        WHEN 'TOMASONI 02' THEN 2
        WHEN 'TOMASONI' THEN 3
        WHEN 'SUNDEMBA' THEN 4
        WHEN 'TOM CV' THEN 5
        WHEN 'AMAR' THEN 6
        WHEN 'DIV' THEN 7
        WHEN 'DIV.S.' THEN 8
        WHEN 'MP 1' THEN 9
        ELSE 10
      END, Dt_Entrega;
    `;

    // Executa a query com os bindings
    const dados = await STEknex.raw(query, bindings);

    if (!dados || dados.length === 0) {
      return res.status(404).render('index_comercial/erro', {
        codigo: 404,
        mensagem: 'Nenhum dado encontrado com os filtros fornecidos.',
        filtros_aplicados: filtros_aplicados // Envia os filtros de volta
      });
    }

    // Estrutura os dados para o gráfico
    const dados_maquinas = {};
    for (const item of dados) {
      const maquina = item.Maquina;
      if (!dados_maquinas[maquina]) {
        dados_maquinas[maquina] = [];
      }
      dados_maquinas[maquina].push({
        Dt_Entrega: item.Dt_Entrega,
        Peso_Liq: item.Peso_Liq,
        Capacidade: item.Capacidade
      });
    }

    // Busca por manutenções
    const manutencaoQuery = `
      SELECT 
        CONVERT(VARCHAR(10), Data, 120) AS Dt_Entrega,
        CASE Maquina WHEN 'OND' THEN 'Onduladeira' ELSE Maquina END AS Maquina,
        SUM(Tempo) AS Tempo
      FROM vw_Calendario_Manutencao
      WHERE Situacao = 'Programada e não Realizada'
      GROUP BY Data, Maquina
    `;
    const manutencaoResult = await STEknex.raw(manutencaoQuery);
    const manutencoes = {};
    for (const item of manutencaoResult) {
        const chave = `${item.Dt_Entrega}|${item.Maquina}`;
        manutencoes[chave] = item.Tempo;
    }

    res.render('tb_comercial/grafico-cm', {
      dados: dados_maquinas,
      manutencoes: manutencoes,
      filtros_aplicados
    });

  } catch (error) {
    console.error('? Erro ao processar gráfico-cm (POST):', error);
    res.status(500).render('index_comercial/erro', {
      codigo: 500,
      mensagem: 'Erro ao gerar gráfico de carga por máquina.',
      detalhe: error.message
    });
  }
});

// Rota para buscar detalhes dos pedidos (sem alteração)
router.post('/detalhes-pedido', async (req, res, next) => {
  try {
    const { date, machine, filtro, entrega, familia, ativo, atraso } = req.body;

    // Constrói a query de forma segura para evitar SQL Injection
    let query = `
      SELECT 
        c.PedCliente,
        c.Item,
        LEFT(c.Referencia, 30) AS Referencia,
        LEFT(c.Cliente, 30) AS Cliente,
        c.CIF_FOB,
        c.Qtd_Pedido,
        CONVERT(FLOAT, c.Peso_Liq) AS Peso_Liq,
        CONVERT(VARCHAR, [DT_Implantação], 103) AS DT_Implantacao,
        c.[Entrege_x _Geração] AS Entrege_x_Geracao,
        c.Maquina1,
        c.Maquina2
      FROM DATASULSTE.dbo.[VW Carga Maquina APP Detalhes] c
      WHERE CONVERT(DATE, c.Dt_Entrega) = ?
    `;
    const bindings = [date];

    if (machine && machine !== 'Onduladeira') {
      query += ` AND c.Maquina1 = ?`;
      bindings.push(machine);
    }
    if (ativo) {
      query += ` AND c.Ativo = ?`;
      bindings.push(ativo);
    }
    if (filtro && filtro !== 'Implantado') {
      query += ` AND c.Filtro = ?`;
      bindings.push(filtro);
    }
    if (entrega && entrega !== 'CIF + FOB') {
      query += ` AND c.CIF_FOB = ?`;
      bindings.push(entrega);
    }
    if (familia && familia !== 'Todas') {
      query += ` AND c.Familia_Trim = ?`;
      bindings.push(familia);
    }
    if (atraso && atraso !== 'Todas') {
      query += ` AND c.Atraso = ?`;
      bindings.push(atraso);
    }

    query += ' ORDER BY c.PedCliente, c.Item';

    const dados = await STEknex.raw(query, bindings);
    res.json({ data: dados });

  } catch (error) {
    console.error('Erro ao consultar detalhes do pedido:', error);
    next(error);
  }
});

router.get('/consulta-saldo-exp-datasul', verificarAutenticacao, async (req, res, next) => {
  try {
    const querySql = `
      SELECT 
        s.ItemComDescricao AS Item,
        s.UnidadeMedida Unid,
        ROUND(CONVERT(FLOAT, ISNULL(s.QuantidadeAtual, 0)), 2) AS [Qtd],
        ROUND(ISNULL(CONVERT(FLOAT, p.PesoLiq * s.QuantidadeAtual), 0), 2) AS Peso,
        s.Deposito,
        s.descFamiliaComercial AS Familia,
        s.Situacao
      FROM [VW Saldo Estoque] s
      LEFT JOIN TRIMBOX.DATASULSTE.dbo.vw_PesoDatasul p ON s.Item = p.Item
      WHERE (s.Empresa IN (7))
        AND (s.Estabelecimento IN ('P02'))
        AND (s.Deposito IN ('EXP'))
        AND (s.Situacao IN ('Ativo'))
        AND (s.QuantidadeAtual > 0)
    `;

    const dados = await DTWknex.raw(querySql);
    const colunas = dados.length > 0 ? Object.keys(dados[0]) : [];
    
    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Expedição',
      titulo: 'Saldo Expedição - DataSul'
    });

  } catch (error) {
    console.error('❌ Erro ao consultar saldo expedição datasul:', error);
    next(error); // Agora o next está declarado corretamente
  }
});

router.post('/relatorio-faturamento', verificarAutenticacao, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body;

    const dataIni = new Date(startDate + 'T00:00:00');
    const dataFim = new Date(endDate + 'T00:00:00');

    const mesUnico = (
      dataIni.getFullYear() === dataFim.getFullYear() &&
      dataIni.getMonth() === dataFim.getMonth()
    );

    // Executa procedures
    await DTWknex.raw(`EXEC sp_GerarRelatorioFaturamento ?, ?`, [startDate, endDate]);
    await STEknex.raw(`EXEC sp_GerarRelatorioFaturamento ?, ?`, [startDate, endDate]);

    // Consulta o resultado salvo
    const [resultado] = await DTWknex.select('*').from('RelatorioFaturamentoMensal');
    const relatorio = resultado || {};

    // Resumo diário
    const resumo = await DTWknex('vw_ResumoFaturamentoPorDia')
      .whereBetween('Data', [startDate, endDate])
      .orderBy('Data', 'asc');

    const tituloComparativo = mesUnico ? 'Mês Anterior' : 'Ano Anterior';

    // Valores comparativos
    const faturamentoAnterior = mesUnico
      ? Number(relatorio.FaturamentoMesAnterior) || 0
      : Number(relatorio.FaturamentoAnterior) || 0;

    const pesoAnterior = mesUnico
      ? Number(relatorio.PesoMesAnterior) || 0
      : Number(relatorio.PesoAnterior) || 0;

    const precoMedioAnterior = mesUnico
      ? Number(relatorio.PrecoMedioMesAnterior) || 0
      : Number(relatorio.PrecoMedioAnterior) || 0;

    const carteiraAnterior = mesUnico
      ? Number(relatorio.CarteiraMesAnterior) || 0
      : Number(relatorio.CarteiraAnterior) || 0;

    const carteiraAtual = Number(relatorio.CarteiraAtual) || 0;

    // KPIs principais
    const faturamento = Number(relatorio.Faturamento) || 0;
    const peso = Number(relatorio.Peso) || 0;
    const precoMedio = Number(relatorio.PrecoMedio) || 0;
    const metaValor = Number(relatorio.MetaValor) || 0;
    const metaVolume = Number(relatorio.MetaVolume) || 0;
    const metaPrecoMedio = Number(relatorio.MetaPrecoMedio) || 0;

    const kpis = {
      faturamento,
      volume: peso,
      precoMedio,
      metaValor,
      metaVolume,
      metaPrecoMedio,
      mesAnteriorValor: faturamentoAnterior,
      mesAnteriorPeso: pesoAnterior,
      precoMedioMesAnterior: precoMedioAnterior,
      carteira: carteiraAtual,
      carteiraAnterior,
      pctFaturamento: metaValor > 0 ? (faturamento / metaValor) * 100 : 0,
      pctFaturamentoMeta: metaValor > 0 ? ((faturamento - metaValor) / metaValor) * 100 : 0,
      pctVolume: metaVolume > 0 ? (peso / metaVolume) * 100 : 0,
      pctPesoMeta: metaVolume > 0 ? ((peso - metaVolume) / metaVolume) * 100 : 0,
      pctPrecoMedio: precoMedioAnterior > 0 ? ((precoMedio - precoMedioAnterior) / precoMedioAnterior) * 100 : 0,
      pctPrecoMedioMeta: metaPrecoMedio > 0 ? ((precoMedio - metaPrecoMedio) / metaPrecoMedio) * 100 : 0,
      evolucaoFaturamento: faturamentoAnterior > 0 ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100 : 0,
      evolucaoPeso: pesoAnterior > 0 ? ((peso - pesoAnterior) / pesoAnterior) * 100 : 0,
      evolucaoPreco: precoMedioAnterior > 0 ? ((precoMedio - precoMedioAnterior) / precoMedioAnterior) * 100 : 0,
      evolucaoCarteira: carteiraAnterior > 0 ? ((carteiraAtual - carteiraAnterior) / carteiraAnterior) * 100 : 0
    };

    // Resumo logístico com condicional para anterior ou mês anterior
    const resumoLogistica = {
      atual: {
        qtdEmbarques: Number(relatorio.QtdEmbarquesAtual) || 0,
        qtdClientes: Number(relatorio.ClientesAtuais) || 0,
        qtdSKUs: Number(relatorio.SKUsAtuais) || 0,
        toneladas: Number(relatorio.ToneladasAtual) || 0,
        embarquesDia: Number(relatorio.EmbarquesPorDiaAtual) || 0,
        diasUteis: Number(relatorio.QtdDiasUteisAtual) || 0,
      },
      anterior: mesUnico
        ? {
            qtdEmbarques: Number(relatorio.QtdEmbarquesMesAnterior) || 0,
            qtdClientes: Number(relatorio.ClientesMesAnterior) || 0,
            qtdSKUs: Number(relatorio.SKUsMesAnterior) || 0,
            toneladas: Number(relatorio.ToneladasMesAnterior) || 0,
            embarquesDia: Number(relatorio.EmbarquesPorDiaMesAnterior) || 0,
            diasUteis: Number(relatorio.QtdDiasUteisMesAnterior) || 0,
          }
        : {
            qtdEmbarques: Number(relatorio.QtdEmbarquesAnterior) || 0,
            qtdClientes: Number(relatorio.ClientesAnteriores) || 0,
            qtdSKUs: Number(relatorio.SKUsAnteriores) || 0,
            toneladas: Number(relatorio.ToneladasAnterior) || 0,
            embarquesDia: Number(relatorio.EmbarquesPorDiaAnterior) || 0,
            diasUteis: Number(relatorio.QtdDiasUteisAnterior) || 0,
          }
    };

    const formatarData = (isoDate) => {
      const [ano, mes, dia] = isoDate.split('-');
      return `${dia}/${mes}/${ano}`;
    };

    const titulo = `${formatarData(startDate)} a ${formatarData(endDate)}`;

    res.render('tb_comercial/painel_faturamento', {
      titulo,
      dadosFaturamento: [],
      colunas: [],
      resumo,
      kpis,
      resumoLogistica,
      tituloComparativo
    });

  } catch (error) {
    console.error('? Erro no relatório de faturamento:', error);
    next(error);
  }
});

router.post('/consulta_carg', verificarAutenticacao, async (req, res, next) => {
  try {
    const dt_inicio = req.body.startDate || '';
    const dt_fim = req.body.endDate || '';
    const cliente = req.body.cliente || '';
    const produto = req.body.produto || '';
    const representante = req.body.representante || '';
    const pedido = req.body.pedido || '';
    const agendamento = req.body.agendamento || '';
    const triangular = req.body.triangular || '';
    const status = req.body.status || '';

    let query = `
      SELECT * FROM DATASULSTE.dbo.vw_CargaMaquinaAPPIntegracao
      WHERE Entrega BETWEEN '${dt_inicio}' AND '${dt_fim}'
    `;

    if (cliente) {
      query += ` AND Cliente LIKE '%${cliente}%'`;
    }
    if (produto) {
      query += ` AND Item LIKE '%${produto}%'`;
    }
    if (representante) {
      query += ` AND Represen LIKE '%${representante}%'`;
    }
    if (pedido) {
      query += ` AND Pedido LIKE '%${pedido}%'`;
    }
    if (agendamento) {
      query += ` AND Agendamento LIKE '%${agendamento}%'`;
    }
    if (triangular) {
      query += ` AND Triangular LIKE '%${triangular}%'`;
    }
    if (status) {
      query += ` AND [Status Pedido] LIKE '%${status}%'`;
    }
    
    const resultado = await STEknex.raw(query);
    const dados = resultado || [];
    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorio', {
      produtos: dados,
      colunas,
      aba: 'CM',
      titulo: 'Carga Máquina'
    });
  } catch (e) {
    next(e);
  }
});

function limparNumero(nf) {
  return nf.replace(/[^\d]/g, ''); // mantém apenas números
}

async function executaApiNF(cnpj, nf) {
  const nfLimpo = limparNumero(nf);
  const url = `${API_BASE_URL_NF}/baixar_nf?cnpj_cpf=${cnpj}&nf=${nfLimpo}&emp=7`;

  console.log('?? URL gerada:', url);

  try {
    const resposta = await axios.get(url, {
      timeout: 10000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    if (resposta.status !== 200) {
      console.error('? API retornou status:', resposta.status);
    } else {
      console.log('? executaApiNF executada com sucesso');
    }
  } catch (erro) {
    console.error('? Erro ao executar executaApiNF:', erro.message);
    throw erro;
  }
}

async function baixarArquivo(diretorio, download = 1) {
  const url = `${API_BASE_URL_NF}/arquivo?directory=${encodeURIComponent(diretorio)}&download=${download}`;

  try {
    const resposta = await axios.get(url, {
      responseType: 'stream',
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const destino = './nota_baixada.pdf';
    const writer = fs.createWriteStream(destino);
    resposta.data.pipe(writer);

    console.log(`? Arquivo salvo em: ${destino}`);
  } catch (erro) {
    console.error('? Falha ao baixar arquivo:', erro.message);
  }
}

router.get('/baixar_pdf/:cnpj/:nf', verificarAutenticacao, async (req, res, next) => {
  try {
    const { cnpj, nf } = req.params;
    const nfLimpo = nf.replace(/[^\d]/g, ''); // ou use sua função limparNumero()

    console.info('?? NF solicitada:', nfLimpo);

    // Verifica se já existem os arquivos locais
    let resultado = await verificarArquivosEObterCliente(cnpj, nfLimpo);

    // Se não existe nota, tenta executar a API para baixar
    if (!resultado.temNota) {
      await executaApiNF(cnpj, nfLimpo);

      // Aguarda até que o arquivo esteja disponível (verifica a cada 1s, por até 15s)
      let tentativas = 0;
      const maxTentativas = 15;

      while (!resultado.temNota && tentativas < maxTentativas) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // espera 1 segundo
        resultado = await verificarArquivosEObterCliente(cnpj, nfLimpo);
        tentativas++;
        console.log(`?? Tentativa ${tentativas} - Nota disponível: ${resultado.temNota}`);
      }
    }

    // Renderiza com os dados finais (após esperar se necessário)
    res.render('tb_comercial/download', {
      cliente: resultado.cliente,
      cnpj,
      numero: nfLimpo,
      tem_nota: resultado.temNota ? 'Sim' : 'Não',
      tem_boleto: resultado.temBoleto ? 'Sim' : 'Não',
      link_nota: resultado.linkNota,
      link_boleto: resultado.linkBoleto
    });
  } catch (e) {
    console.error('? Erro em /baixar_pdf:', e.message);
    next(e);
  }
});

router.get('/download_arquivo', verificarAutenticacao, (req, res) => {
  const filePath = req.query.path;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Arquivo não encontrado.');
  }

  res.download(filePath);
});

router.post('/baixar_pdf_manual', verificarAutenticacao, (req, res) => {
  const { cnpj, nf } = req.body;
  return res.redirect(`/comercial/baixar_pdf/${cnpj}/${nf}`);
});

router.post('/consultar_notas', verificarAutenticacao, async (req, res, next) => {
  try {
    const { cliente, representante, nf, cnpj, inadimplente, status } = req.body;

    let query = DTWknex('VW Baixar NF Santelisa').select('*');

    if (cliente) query.where('Cliente', 'like', `%${cliente}%`);
    if (representante) query.where('Repres', 'like', `%${representante}%`);
    if (nf) query.where('NF', 'like', `%${nf}%`);
    if (cnpj) query.where('CNPJ/CPF', 'like', `%${cnpj}%`);
    if (inadimplente) query.where('Inadimplente', 'like', `%${inadimplente}%`);
    if (status) query.where('StatusNota', 'like', `%${status}%`);

    const resultado = await query.limit(100);
    const colunas = resultado.length ? Object.keys(resultado[0]) : [];

    res.render('tb_comercial/lista_notas', {
      notas: resultado,
      titulo: 'Notas Fiscais Encontradas',
      colunas
    });

  } catch (e) {
    next(e);
  }
});

router.get('/relatorios_disponiveis', async (req, res) => {
  try {
    const relatorios = await STEknex('APPRelatoriosDisponiveis')
      .select('NomeRelatorio', 'TabelaView', 'ColunaData')
      .where({ Ativo: 1, APP: 'APP Comercial' });

    const today = new Date();
    const first_day = new Date(today.getFullYear(), today.getMonth(), 1);
    const last_day = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const resultado = relatorios.map(r => {
      let colunaData = r.ColunaData;

      // Remove colchetes, mas mantém nomes com espaço ou _
      if (colunaData) {
        colunaData = colunaData.replace(/\[|\]/g, '').trim();
      }

      return {
        ...r,
        ColunaData: colunaData,
        DataInicioSugerida: first_day.toISOString().split('T')[0],
        DataFimSugerida: last_day.toISOString().split('T')[0]
      };
    });

    res.json(resultado);
  } catch (e) {
    console.error('? Erro ao buscar relatórios:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/report/relatorio', async (req, res) => {
  const { tipoRelatorio, dataInicio, dataFim, colunaData } = req.body;

  if (!tipoRelatorio) {
    return res.status(400).render('index_comercial/erro', {
      codigo: 400,
      mensagem: 'O tipo de relatório é obrigatório.'
    });
  }

  try {
    const nomeQuery = await STEknex('APPRelatoriosDisponiveis')
      .select('NomeRelatorio')
      .where({ TabelaView: tipoRelatorio })
      .first();

    const nomeRelatorio = nomeQuery?.NomeRelatorio || 'Relatório';
    let dados;

    if (colunaData && colunaData.trim() !== '' && dataInicio && dataFim) {
      dados = await STEknex
        .select('*')
        .from(tipoRelatorio)
        .whereBetween(colunaData, [dataInicio, dataFim]);
    } else {
      dados = await STEknex
        .select('*')
        .from(tipoRelatorio);
    }

    if (!dados.length) {
      return res.render('index_comercial/erro', {
        codigo: 404,
        mensagem: 'Nenhum dado encontrado para o relatório selecionado.'
      });
    }

    // ? Remove colunaData apenas se ela foi usada
    const dadosSemColunaData = colunaData
      ? dados.map(row => {
          const { [colunaData]: omitido, ...resto } = row;
          return resto;
        })
      : dados;

    const colunas = Object.keys(dadosSemColunaData[0]);

    const startBR = dataInicio ? moment(dataInicio).format('DD/MM/YYYY') : '';
    const endBR = dataFim ? moment(dataFim).format('DD/MM/YYYY') : '';
    const periodo = (startBR && endBR && colunaData) ? `${startBR} a ${endBR}` : 'Sem filtro de período';

    res.render('tb_comercial/relatorios', {
      produtos: dadosSemColunaData,
      colunas,
      aba: 'Consulta Armazenada',
      titulo: nomeRelatorio,
      periodo
    });

  } catch (e) {
    console.error('? Erro ao gerar relatório:', e);
    res.status(500).render('index_comercial/erro', {
      codigo: 500,
      mensagem: 'Erro ao gerar relatório.',
      detalhe: e.message
    });
  }
});

router.post('/consulta_item', verificarAutenticacao, async (req, res, next) => {
  try {
    const { cliente, produto, repres } = req.body;

    let query = STEknex('vw_Busca_Avancada_APP').select('*');

    if (cliente) query.where('Cliente', 'like', `%${repres}%`);
    if (produto) query.where('Produto', 'like', `%${produto}%`);
    if (repres) query.where('Repres', 'like', `%${repres}%`);

    console.info(query);

    const dados = await query.limit(100); // Limite de segurança
    console.info(dados);

    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Itens',
      titulo: 'Busca de Itens - TRIMBOX'
    });

  } catch (e) {
    next(e);
  }
});

router.post('/status_item', verificarAutenticacao, async (req, res, next) => {
  try {
    const { cliente, item, pedido } = req.body;

    let query = STEknex('vw_Status_OP_Item_Pedido').select('*');

    if (cliente) query.where('Cliente', 'like', `%${cliente}%`);
    if (item) query.where('Item', 'like', `%${item}%`);
    if (pedido) query.where('Pedido', 'like', `%${pedido}%`);

    console.info(query);

    const dados = await query.limit(100); // Limite de segurança
    console.info(dados);

    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Itens',
      titulo: 'Consultar Status dos Itens/Pedido - TRIMBOX'
    });

  } catch (e) {
    next(e);
  }
});

router.post('/Consulta-Peso-Pedido', verificarAutenticacao, async (req, res, next) => {
  try {
    const { item, pedido } = req.body;

    let query = STEknex('VW_ConsultaPesoPedido').select('*');

    if (item) query.where('Item', 'like', `%${item}%`);
    if (pedido) query.where('Pedido', 'like', `%${pedido}%`);

    console.info(query);

    const dados = await query.limit(100); // Limite de segurança
    console.info(dados);

    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'Pedido',
      titulo: 'Peso cadastro x Peso Real (Pedido) - TRIMBOX'
    });

  } catch (e) {
    next(e);
  }
});

router.post('/relatorio-producao', verificarAutenticacao, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body;

    const dataIni = new Date(startDate + 'T00:00:00');
    const dataFim = new Date(endDate + 'T00:00:00');

    // Executa a procedure que salva os dados ordenados com Seq
    await STEknex.raw(`EXEC dbo.sp_GerarResumoProducao ?, ?`, [startDate, endDate]);

    // Consulta dados da produção já ordenados corretamente
    const dados = await STEknex('RelatorioProducaoMensal')
      .whereBetween('PeriodoInicio', [startDate, endDate])
      .orderBy('Seq', 'asc');

    const colunas = dados.length > 0 ? Object.keys(dados[0]) : [];

    // KPIs gerais
    const totalProducao = dados.reduce((soma, row) => soma + (row.TotalProducao || 0), 0);
    const totalHoras = dados.reduce((soma, row) => soma + (row.TotalHoras || 0), 0);
    const totalParadas = dados.reduce((soma, row) => soma + (row.TotalParadas || 0), 0);
    const diasTotais = dados.reduce((soma, row) => soma + (row.DiasTrabalhados || 0), 0);

    const comparativoProd = dados.reduce((soma, row) => soma + (row.ComparativoProducao || 0), 0);
    const comparativoParadas = dados.reduce((soma, row) => soma + (row.ComparativoParadas || 0), 0);

    const kpis = {
      totalProducao,
      totalHoras,
      totalParadas,
      diasTotais,
      produtividadeMedia: totalHoras > 0 ? totalProducao / totalHoras : 0,
      percentualParadas: totalHoras > 0 ? totalParadas / totalHoras : 0,
      comparativoProd,
      comparativoParadas
    };

    const formatarData = (isoDate) => {
      const [ano, mes, dia] = isoDate.split('-');
      return `${dia}/${mes}/${ano}`;
    };

    const titulo = `Produção de ${formatarData(startDate)} a ${formatarData(endDate)}`;

    res.render('tb_comercial/painel_producao', {
      titulo,
      dadosProducao: dados,
      colunas,
      kpis
    });

  } catch (error) {
    console.error('? Erro no relatório de produção:', error);
    next(error);
  }
});

// NOVA ROTA PARA CONSULTAR A VIEW VW_FGV_Santelisa POR PERÍODO
router.get('/report/fgv-santelisa', verificarAutenticacao, async (req, res, next) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const dados = await STEknex
    .select('*')
    .from('VW_FGV_Santelisa')
    .whereBetween('Data', [dataInicio, dataFim]); // Usa a coluna 'Data' da sua view
    const colunas = dados.length ? Object.keys(dados[0]) : [];

    res.render('tb_comercial/relatorios', {
      produtos: dados,
      colunas,
      aba: 'FGV',
      titulo: 'FGV: Santelisa'
    });
  } catch (error) {
    console.error('❌ Erro ao consultar FGV:', error);
    next(error);
  }
});

module.exports = router;
