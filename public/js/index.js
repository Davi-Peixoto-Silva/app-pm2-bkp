const zoomLevels = {};
let contadorInterval;

// 🔵 Ajusta zoom em algum iframe, se precisar
function ajustarZoom(id, delta) {
  zoomLevels[id] = (zoomLevels[id] || 0.9) + delta;
  zoomLevels[id] = Math.max(0.3, Math.min(2, zoomLevels[id])); // Limita entre 0.3x e 2x
  document.getElementById(id).style.transform = `scale(${zoomLevels[id]})`;
}

// 🔵 Mostra o loading na tela inteira
function esconderLoading() {
  clearTimeout(contadorInterval);
  const loadingModal = document.getElementById('loadingModal');
  if (loadingModal) {
    loadingModal.style.display = 'none';
  }
}

// ✅ Sempre declare primeiro
function mostrarLoading() {
  const loadingModal = document.getElementById('loadingModal');
  if (loadingModal) {
    loadingModal.style.display = 'flex';
    
    // Timeout de segurança
    contadorInterval = setTimeout(() => {
      esconderLoading();
      alert('⏳ O carregamento demorou demais. Tente novamente.');
    }, 120000);
  }
}

// 🔵 Função para abrir modal dinâmico (com campos)
function abrirModalDinamico(config) {
  document.getElementById('modalDinamicoLabel').textContent = config.titulo || 'Consulta';

  const form = document.getElementById('formModalDinamico');
  form.action = config.action || '#';
  form.method = config.method || 'POST';

  const body = document.getElementById('modalDinamicoBody');
  body.innerHTML = '';

  config.campos.forEach(campo => {
    // ? Não recria o campo oculto "colunaData" (já existe no HTML)
    if (campo.id === 'colunaData') return;

    const formGroup = document.createElement('div');
    formGroup.classList.add('col-md-6', 'mb-3');

    const label = document.createElement('label');
    label.setAttribute('for', campo.id);
    label.textContent = campo.label;

    let input;
    if (campo.type === 'select') {
      input = document.createElement('select');
      input.className = 'form-control';
      input.name = campo.name;
      input.id = campo.id;
      campo.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = campo.type;
      input.className = 'form-control';
      input.name = campo.name;
      input.id = campo.id;
      input.placeholder = campo.placeholder || '';
      if (campo.required) input.required = true;
      if (campo.value) input.value = campo.value;
    }

    // ?? Liga evento de mudança
    input.addEventListener('change', (e) => {
      if (typeof config.onChange === 'function') {
        config.onChange(campo.id, e.target.value, form);
      }
    });

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    body.appendChild(formGroup);
  });

  const modalElement = document.getElementById('modalDinamico');
  const modal = new bootstrap.Modal(modalElement);
  modal.show();

  // ? Dispara o "change" do select após o modal abrir
  modalElement.addEventListener('shown.bs.modal', () => {
    const tipoSelect = form.querySelector('#tipoRelatorio');
    if (tipoSelect && tipoSelect.value) {
      console.log('? Disparando change após abertura do modal');
      tipoSelect.dispatchEvent(new Event('change'));
    } else {
      console.warn('?? tipoRelatorio está vazio ao abrir o modal.');
    }
  }, { once: true });
}

function mostrarErroModal(mensagem) {
  const body = document.getElementById('modalDinamicoBody');
  let alerta = document.getElementById('erroModal');

  if (!alerta) {
    alerta = document.createElement('div');
    alerta.id = 'erroModal';
    alerta.className = 'alert alert-danger mt-2';
    body.insertBefore(alerta, body.firstChild);
  }

  alerta.textContent = mensagem;
}


// document.addEventListener('DOMContentLoaded', () => {
//   const linksDropdown = document.querySelectorAll('.dropdown-menu a');

//   linksDropdown.forEach(link => {
//     link.addEventListener('click', function (e) {
//       const href = this.getAttribute('href');

//       if (href && href !== '#' && (!this.target || this.target === '_self')) {
//         // 🔵 Se for link real (não #), mostra loading
//         mostrarLoading();
//       }
//       // 🔴 Se for href="#" (abre modal), NÃO faz nada aqui
//     });
//   });

//   // Botões de abrir modais específicos (não mostra loading ainda)
//   document.getElementById('openModalSaldoExp')?.addEventListener('click', () => abrirModal('dateModalConsultaSaldoEstoque'));
//   document.getElementById('openModalConsultaPedidos')?.addEventListener('click', () => abrirModal('dateModalConsultaPedido'));
//   document.getElementById('openModalNotasFiscais')?.addEventListener('click', () => abrirModal('dateModalConsultaNotasInadimplencia'));
//   document.getElementById('openModalGeral')?.addEventListener('click', () => abrirModal('relatorioModal'));
// });

document.getElementById('formModalDinamico')?.addEventListener('submit', function (e) {
  const colunaData = document.getElementById('colunaData')?.value;
  console.log('?? colunaData:', colunaData || '[VAZIA]');

  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');

  if (startDateInput && endDateInput) {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (startDate && endDate && startDate > endDate) {
      e.preventDefault();
      mostrarErroModal('A Data Final não pode ser menor que a Data Inicial.');
      return;
    }
  }

  mostrarLoading(); // ? Continua mesmo que colunaData esteja vazia
});

document.getElementById('openModalCM')?.addEventListener('click', () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const formatDate = (date) => date.toISOString().split('T')[0];

  abrirModalDinamico({
    titulo: 'Gráfico de Carga por Máquina',
    action: '/comercial/grafico-cm',
    campos: [
      { type: 'date', id: 'startDate', name: 'startDate', label: 'Data Inicial:', required: true, value: formatDate(startOfMonth) },
      { type: 'date', id: 'endDate', name: 'endDate', label: 'Data Final:', required: true, value: formatDate(endOfMonth) }
    ]
  });
});

document.getElementById('formModalDinamico')?.addEventListener('submit', function (e) {
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');

  if (startDateInput && endDateInput) {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (startDate && endDate && startDate > endDate) {
      e.preventDefault();
      mostrarErroModal('A Data Final não pode ser menor que a Data Inicial.');
    }
  }
});

document.getElementById('openModalFaturamentoCompleto')?.addEventListener('click', () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  // const formatDate = (date) => date.toISOString().split('T')[0];

  function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  

  abrirModalDinamico({
    titulo: 'Relatório Detalhado de Faturamento',
    action: '/comercial/relatorio-faturamento',
    campos: [
      { type: 'date', id: 'startDate', name: 'startDate', label: 'Data Inicial:', required: true, value: formatDate(startOfMonth) },
      { type: 'date', id: 'endDate', name: 'endDate', label: 'Data Final:', required: true, value: formatDate(endOfMonth) }
    ]
  });
});

document.getElementById('openModalSaldoEstoque')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consultar Saldo de Estoque',
    action: '/comercial/consultar-saldo-estoque',
    campos: [
      { type: 'text', id: 'item', name: 'item', label: 'Item (código ou parte):', placeholder: 'Ex: 1010001' },
      { type: 'text', id: 'deposito', name: 'deposito', label: 'Depósito:', placeholder: 'Ex: EXP' }
    ]
  });
});

document.getElementById('openModalEstoqueBobina')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consultar Posição de Estoque - Bobina',
    action: '/comercial/consultar-posicao-estoque-bobina',
    campos: [
      {
        type: 'datetime-local',
        id: 'dataPosicaoEstoque',
        name: 'dataPosicaoEstoque',
        label: 'Data/Hora da Posição:',
        required: true,
        value: new Date().toISOString().slice(0, 16)
      }
    ]
  });
});

document.getElementById('openModalEstoqueAparas')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consultar Posição de Estoque - Aparas',
    action: '/comercial/consultar-posicao-estoque-aparas',
    campos: [
      {
        type: 'datetime-local',
        id: 'dataPosicaoEstoque',
        name: 'dataPosicaoEstoque',
        label: 'Data/Hora da Posição:',
        required: true,
        value: new Date().toISOString().slice(0, 16)
      }
    ]
  });
});

document.getElementById('openModalEstoqueAcabado')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consultar Posição de Estoque - Acabado',
    action: '/comercial/consultar-posicao-estoque-acabado',
    campos: [
      {
        type: 'datetime-local',
        id: 'dataPosicaoEstoque',
        name: 'dataPosicaoEstoque',
        label: 'Data/Hora da Posição:',
        required: true,
        value: new Date().toISOString().slice(0, 16)
      }
    ]
  });
});

document.getElementById('openModalPosicaoEstoqueExpedicaoHistorico')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Comparativo Estoque x Atual',
    action: '/comercial/consultar-posicao-estoque-acabado-hist',
    campos: [
      {
        type: 'datetime-local',
        id: 'dataPosicaoEstoque',
        name: 'dataPosicaoEstoque',
        label: 'Data/Hora da Posição:',
        required: true,
        value: new Date().toISOString().slice(0, 16)
      }
    ]
  });
});

document.getElementById('openModalCargaMaquina')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consulta de Carga por Máquina',
    action: '/comercial/consulta_carg',
    campos: [
      {
        type: 'date',
        id: 'startDate',
        name: 'startDate',
        label: 'Data Inicial:',
        required: true,
        value: new Date(new Date().setDate(1)).toISOString().split('T')[0]
      },
      {
        type: 'date',
        id: 'endDate',
        name: 'endDate',
        label: 'Data Final:',
        required: true,
        value: new Date().toISOString().split('T')[0]
      },
      { type: 'text', id: 'cliente', name: 'cliente', label: 'Cliente:', placeholder: 'Nome ou parte' },
      { type: 'text', id: 'produto', name: 'produto', label: 'Produto:', placeholder: 'Código ou referência' },
      { type: 'text', id: 'representante', name: 'representante', label: 'Representante:', placeholder: 'Código ou nome' },
      { type: 'text', id: 'pedido', name: 'pedido', label: 'Pedido:', placeholder: 'Número do pedido' },

      {
        type: 'select',
        id: 'agendamento',
        name: 'agendamento',
        label: 'Agendamento de Entrega:',
        options: [
          { value: '', label: 'Todos' },
          { value: 'Sim', label: 'Sim' },
          { value: 'Não', label: 'Não' }
        ]
      },
      {
        type: 'select',
        id: 'triangular',
        name: 'triangular',
        label: 'Triangular:',
        options: [
          { value: '', label: 'Todos' },
          { value: 'Sim', label: 'Sim' },
          { value: 'Não', label: 'Não' }
        ]
      },
      {
        type: 'select',
        id: 'status',
        name: 'status',
        label: 'Status Pedido:',
        options: [
          { value: '', label: 'Todos' },
          { value: 'Pedido Validado', label: 'Pedido Validado' },
          { value: 'Em Produção', label: 'Em Produção' },
          { value: 'Programado', label: 'Programado' },
          { value: 'Ondulado', label: 'Ondulado' },
          { value: 'Convertido', label: 'Convertido' },
          { value: 'Na Expedição', label: 'Na Expedição' },
          { value: 'Expedido', label: 'Expedido' },
          { value: 'Disponível para Faturamento', label: 'Disponível para Faturamento' },
          { value: 'Faturado', label: 'Faturado' }
        ]
      }
    ]
  });
});

document.getElementById('openModalNotasFiscais')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consulta de Notas – Filtros',
    action: '/comercial/consultar_notas',
    campos: [
      { type: 'text', id: 'cliente', name: 'cliente', label: 'Cliente:', placeholder: 'Código ou Nome' },
      { type: 'text', id: 'representante', name: 'representante', label: 'Representante:', placeholder: 'Código ou Nome' },
      { type: 'text', id: 'nf', name: 'nf', label: 'Nota Fiscal:', placeholder: 'Nº Nota Fiscal' },
      { type: 'text', id: 'cnpj', name: 'cnpj', label: 'CNPJ/CPF:', placeholder: 'CNPJ/CPF' },
      {
        type: 'select',
        id: 'inadimplente',
        name: 'inadimplente',
        label: 'Inadimplente:',
        options: [
          { value: '', label: 'Todos' },
          { value: 'Sim', label: 'Sim' },
          { value: 'Não', label: 'Não' }
        ]
      },
      {
        type: 'select',
        id: 'status',
        name: 'status',
        label: 'Status da Nota:',
        options: [
          { value: '', label: 'Todos' },
          { value: 'Pendente', label: 'Pendente' },
          { value: 'Pago', label: 'Pago' }
        ]
      }
    ]
  });

});

document.getElementById('openModalGeral')?.addEventListener('click', async () => {
  try {
    console.log('?? Iniciando carregamento de relatórios...');
    const response = await fetch('/comercial/relatorios_disponiveis');

    if (!response.ok) {
      console.error(`? Erro HTTP ${response.status}:`, await response.text());
      alert('Erro ao buscar relatórios. Código de status: ' + response.status);
      return;
    }

    const relatorios = await response.json();
    console.log('?? Resposta recebida:', relatorios);

    if (!Array.isArray(relatorios) || relatorios.length === 0) {
      console.warn('?? Nenhum relatório disponível.');
      alert('Nenhum relatório disponível.');
      return;
    }

    const options = relatorios.map(r => ({
      value: r.TabelaView,
      label: r.NomeRelatorio,
      data_inicio: r.DataInicioSugerida,
      data_fim: r.DataFimSugerida,
      coluna_data: r.ColunaData
    }));
    console.log('?? Opções mapeadas:', options);

    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    abrirModalDinamico({
      titulo: 'Relatórios Disponíveis',
      action: '/comercial/report/relatorio',
      method: 'POST',
      campos: [
        {
          type: 'select',
          id: 'tipoRelatorio',
          name: 'tipoRelatorio',
          label: 'Relatório:',
          options,
          required: true
        },
        {
          type: 'date',
          id: 'dataInicio',
          name: 'dataInicio',
          label: 'Data Início:',
          value: primeiroDia,
          required: true
        },
        {
          type: 'date',
          id: 'dataFim',
          name: 'dataFim',
          label: 'Data Fim:',
          value: ultimoDia,
          required: true
        },
        {
          type: 'hidden',
          id: 'colunaData',
          name: 'colunaData'
        }
      ],
      onChange: (fieldId, value, formElement) => {
        if (fieldId === 'tipoRelatorio') {
          const rel = options.find(r => r.value === value);
          if (rel) {
            console.log(`?? Alterando datas com base no relatório '${rel.label}'`);
            formElement.querySelector('#dataInicio').value = rel.data_inicio;
            formElement.querySelector('#dataFim').value = rel.data_fim;
            formElement.querySelector('#colunaData').value = rel.coluna_data;
            console.log('?? ColunaData definida para:', rel.coluna_data);
          } else {
            console.warn('?? Relatório não encontrado nas opções.');
          }
        }
      }
    });

    setTimeout(() => {
      const formElement = document.querySelector('#modalDinamico form');
      const tipoSelect = formElement?.querySelector('#tipoRelatorio');
      if (tipoSelect && tipoSelect.value) {
        console.log('?? Disparando evento "change" para tipoRelatorio...');
        tipoSelect.dispatchEvent(new Event('change'));
      } else {
        console.warn('?? Não foi possível disparar evento "change" - tipoRelatorio indefinido.');
      }
    }, 200);

  } catch (error) {
    console.error('? Erro inesperado ao carregar relatórios:', error);
    alert('Erro inesperado ao buscar relatórios. Veja o console para detalhes.');
  }
});

document.getElementById('openModalitem')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consulta de Itens – Filtros',
    action: '/comercial/consulta_item',
    campos: [
      { type: 'text', id: 'cliente', name: 'cliente', label: 'Cliente:', placeholder: 'Nome' },
      { type: 'text', id: 'produto', name: 'produto', label: 'Produto:', placeholder: 'Produto' },
      { type: 'text', id: 'repres', name: 'repres', label: 'Repressentante:', placeholder: 'Repressentante' },
      
    ]
  });

});

document.getElementById('openModalPesoPedido')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Peso cadastro x Peso Real (Pedido) – Filtros',
    action: '/comercial/Consulta-Peso-Pedido',
    campos: [
      { type: 'text', id: 'pedido', name: 'pedido', label: 'Pedido:', placeholder: 'Pedido' },
      { type: 'text', id: 'item', name: 'item', label: 'Item:', placeholder: 'Item' },
      
    ]
  });

});

document.getElementById('openModalitemStatus')?.addEventListener('click', () => {
  abrirModalDinamico({
    titulo: 'Consulta de Itens – Filtros',
    action: '/comercial/status_item',
    campos: [
      { type: 'text', id: 'cliente', name: 'cliente', label: 'Cliente:', placeholder: 'Nome' },
      { type: 'text', id: 'item', name: 'item', label: 'Item:', placeholder: 'Item' },
      { type: 'text', id: 'pedido', name: 'pedido', label: 'Pedido:', placeholder: 'Pedido' },
      
    ]
  });

});

document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('.dropdown-menu a');

  links.forEach(link => {
    link.addEventListener('click', function (e) {
      const href = this.getAttribute('href');

      if (href && href !== '#' && (!this.target || this.target === '_self')) {
        // Mostra o loading antes de navegar
        mostrarLoading();

        // Pequeno atraso para garantir que o overlay apareça antes de mudar de página
        setTimeout(() => {
          window.location.href = href;
        }, 100);
        
        // Impede a navegação instantânea
        e.preventDefault();
      }
    });
  });
});

document.getElementById('openModalResumoProducao')?.addEventListener('click', () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  abrirModalDinamico({
    titulo: 'Relatório de Produção por Máquina',
    action: '/comercial/relatorio-producao',
    campos: [
      {
        type: 'date',
        id: 'startDate',
        name: 'startDate',
        label: 'Data Inicial:',
        required: true,
        value: formatDate(startOfMonth)
      },
      {
        type: 'date',
        id: 'endDate',
        name: 'endDate',
        label: 'Data Final:',
        required: true,
        value: formatDate(endOfMonth)
      }
    ]
  });
});

// CÓDIGO CORRIGIDO PARA USAR A NOVA ROTA DEDICADA

document.getElementById('openModalFGV')?.addEventListener('click', () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  abrirModalDinamico({
    titulo: 'Relatório FGV - Santelisa',
    
    // MUDANÇA 1: Apontar para a SUA NOVA ROTA
    action: '/comercial/report/fgv-santelisa', 
    
    // MUDANÇA 2: O método precisa ser GET, como a sua nova rota espera
    method: 'GET', 
    
    campos: [
      { 
        type: 'date', 
        id: 'dataInicio', 
        name: 'dataInicio',
        label: 'Data Inicial:', 
        required: true, 
        value: formatDate(startOfMonth) 
      },
      { 
        type: 'date', 
        id: 'dataFim', 
        name: 'dataFim',
        label: 'Data Final:', 
        required: true, 
        value: formatDate(endOfMonth) 
      }
      // MUDANÇA 3: Removemos os campos ocultos, pois a nova rota não precisa deles.
    ]
  });
});
