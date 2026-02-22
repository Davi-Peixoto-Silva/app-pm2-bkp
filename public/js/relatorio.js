function habilitarEdicao(id) {
  const input = document.getElementById('obs_' + id);
  
  if (input) {
    input.disabled = false;

    // Encontra o container pai (a div com classe .d-flex)
    const container = input.closest('.d-flex');

    // Busca os botões dentro deste container específico usando as classes
    const btnEditar = container.querySelector('.btn-editar');
    const btnSalvar = container.querySelector('.btn-salvar');

    // Troca a visibilidade
    if (btnEditar) btnEditar.classList.add('d-none');
    if (btnSalvar) btnSalvar.classList.remove('d-none');

    input.focus(); // Foca no campo para digitação
  }
}

async function confirmarESalvar(id) {
  const input = document.getElementById('obs_' + id);
  if (!input) {
    console.error('Input não encontrado para o ID:', id);
    return;
  }

  const valor = input.value.trim();
  const pedido = id.split('_')[0];
  const container = input.closest('.d-flex');
  const editarBtn = container.querySelector('.btn-outline-primary');
  const salvarBtn = container.querySelector('.btn-success');

  if (!valor) {
    toast('Digite uma observação antes de salvar.', 'warning');
    return;
  }

  if (!confirm(`Deseja salvar a observação para o pedido ${pedido}?`)) {
    return;
  }

  if (salvarBtn) {
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>'; // Ícone de "carregando"
  }

  try {
    const response = await fetch('/comercial/observacoes-comerciais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido, observacao: valor })
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'ok') {
      // Apenas modifica os elementos existentes, sem recriar o HTML
      input.disabled = true;
      editarBtn.classList.remove('d-none');
      salvarBtn.classList.add('d-none');
      salvarBtn.disabled = false; // Reabilita para a próxima edição
      salvarBtn.innerHTML = '<i class="bi bi-save"></i>'; // Restaura o ícone

      toast(`?? Observação salva por <strong>${data.usuario || 'desconhecido'}</strong> em <strong>${data.data_alteracao || ''}</strong>`, 'success');

    } else {
      throw new Error(data.mensagem || 'Erro desconhecido do servidor.');
    }

  } catch (err) {
    console.error('? Erro no fetch:', err);
    toast('? Erro ao salvar: ' + err.message, 'danger');

    // Restaura o botão de salvar em caso de falha
    if (salvarBtn) {
      salvarBtn.disabled = false;
      salvarBtn.innerHTML = '<i class="bi bi-save"></i>';
    }
  }
}

function aplicarFiltro() {
  $.fn.dataTable.ext.search = [];

  const coluna = parseInt(document.getElementById('colunaFiltro').value);
  const operador = document.getElementById('operadorFiltro').value;
  const valor = document.getElementById('valorFiltro').value.trim();

  $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
    const cell = $(settings.aoData[dataIndex].anCells[coluna]);
    const rawValue = cell.find('input').length ? cell.find('input').val() : cell.text();
    const cellValue = (rawValue || '').trim().toLowerCase();
    const val = valor.toLowerCase();

    if (operador === 'vazio') return cellValue === '';
    if (operador === 'contém') return cellValue.includes(val);
    if (!valor) return true;

    const num = parseFloat(cellValue.replace(',', '.'));
    const comp = parseFloat(val.replace(',', '.'));

    switch (operador) {
      case '=': return cellValue == val || num == comp;
      case '<': return num < comp;
      case '>': return num > comp;
      case '<=': return num <= comp;
      case '>=': return num >= comp;
      case '<>': return cellValue != val && num != comp;
      default: return true;
    }
  });

  $('#tabelaRelatorio').DataTable().draw();
}

function resetarFiltro() {
  $.fn.dataTable.ext.search = [];
  document.getElementById('valorFiltro').value = '';
  $('#tabelaRelatorio').DataTable().search('').draw();
  atualizarListaSuspensa();
  atualizarResultadoCalculo();
}

function calcularModa(arr) {
  if (arr.length === 0) return 0;
  const frequencia = {};
  let maxFreq = 0, moda = arr[0];
  arr.forEach(num => {
    frequencia[num] = (frequencia[num] || 0) + 1;
    if (frequencia[num] > maxFreq) {
      maxFreq = frequencia[num];
      moda = num;
    }
  });
  return moda;
}

function atualizarResultadoCalculo() {
  const tipo = document.getElementById('tipoCalculo')?.value || 'soma';
  const indexColunaCalculo = parseInt(document.getElementById('colunaCalculo')?.value || 0);
  const table = $('#tabelaRelatorio').DataTable();
  let total = 0, count = 0, valores = [];

  table.rows({ search: 'applied' }).every(function () {
    const cell = $(this.node()).find('td').eq(indexColunaCalculo);
    const valor = cell.find('input, select').length ? cell.find('input, select').val() : cell.text();
    const num = parseFloat((valor || '').replace(',', '.'));

    if (!isNaN(num)) {
      total += num;
      count++;
      valores.push(num);
    }
  });

  let resultado = 0;
  if (tipo === 'soma') resultado = total;
  else if (tipo === 'média') resultado = count ? total / count : 0;
  else if (tipo === 'contagem') resultado = count;
  else if (tipo === 'máximo') resultado = valores.length ? Math.max(...valores) : 0;
  else if (tipo === 'mínimo') resultado = valores.length ? Math.min(...valores) : 0;
  else if (tipo === 'moda') resultado = calcularModa(valores);

  document.getElementById('somaResultado').innerHTML = `<strong>${tipo.charAt(0).toUpperCase() + tipo.slice(1)}:</strong> ${resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function atualizarColunaCalculo() {
  const table = $('#tabelaRelatorio').DataTable();
  const select = document.getElementById('colunaCalculo');
  if (!select) return;

  select.innerHTML = '';
  const headerRow = $('#tabelaRelatorio thead tr').first();

  table.columns().every(function (index) {
    let isNumerico = true;
    this.nodes().to$().each(function () {
      let texto = ($(this).find('input, select').length ? $(this).find('input, select').val() : $(this).text()).trim();
      if (texto && isNaN(texto.replace(',', '.'))) {
        isNumerico = false;
        return false;
      }
    });

    if (isNumerico) {
      const th = headerRow.find('th').eq(index);
      const nome = th.find('span').text().trim() || `Coluna ${index}`;
      const option = new Option(nome, index);
      select.add(option);
    }
  });
}

function limparFiltroColunaCabecalho(index) {
  const $filtro = $(`#input-filtro-${index}`);
  const table = $('#tabelaRelatorio').DataTable();

  if ($filtro.length) {
    $filtro.val(null).trigger('change');
    table.column(index).search('').draw();
  }

  atualizarVisibilidadeBotoesFiltro();
  atualizarResultadoCalculo();
}

function atualizarVisibilidadeBotoesFiltro() {
  const table = $('#tabelaRelatorio').DataTable();
  $('#tabelaRelatorio thead tr.filtros th').each(function (index) {
    const input = document.getElementById(`input-filtro-${index}`);
    const botao = document.getElementById(`btn-limpar-${index}`);
    if (!input || !botao) return;

    const hasSelect2Value = $(input).hasClass('select2-hidden-accessible') && ($(input).val()?.length > 0);
    if (hasSelect2Value) {
      botao.classList.remove('d-none');
    } else {
      botao.classList.add('d-none');
    }
  });
}

function preencherTodosDatalists(table) {
  table.columns().every(function (index) {
    const datalist = document.getElementById('datalist_' + index);
    if (!datalist) return;

    const uniqueValues = new Set();

    this.nodes().to$().each(function () {
      let texto = $(this).find('input').length 
        ? $(this).find('input').val().trim() 
        : $(this).text().trim();
      if (texto) uniqueValues.add(texto);
    });

    datalist.innerHTML = '';
    Array.from(uniqueValues).sort().forEach(valor => {
      const option = document.createElement('option');
      option.value = valor;
      datalist.appendChild(option);
    });
  });
}

function toast(msg, tipo = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${tipo} border-0 show mb-2`;
  toastEl.role = 'alert';
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  container.appendChild(toastEl);

  setTimeout(() => toastEl.remove(), 5000);
}

function preencherFiltrosDinamicos(table) {
  table.columns().every(function (index) {
    const filtro = document.getElementById('input-filtro-' + index);
    if (!filtro || filtro.tagName !== 'SELECT') return;

    // Limpa opções antigas
    filtro.innerHTML = '';

    const uniqueValues = new Set();

    this.nodes().to$().each(function () {
      let texto = $(this).find('input').length
        ? $(this).find('input').val().trim()
        : $(this).text().trim();

      if (texto) uniqueValues.add(texto);
    });

    // Adiciona as opções
    Array.from(uniqueValues).sort().forEach(valor => {
      const option = document.createElement('option');
      option.value = valor;
      option.textContent = valor;
      filtro.appendChild(option);
    });

    // Aplica Select2
    $(filtro).select2({
      placeholder: "",
      width: '100%',
      allowClear: true,
      closeOnSelect: false,
      dropdownAutoWidth: true
    });

    // ? Evento para filtrar na tabela ao selecionar
    $(filtro).on('change', function () {
      const selectedValues = $(this).val() || [];
      if (selectedValues.length === 0) {
        table.column(index).search('').draw();
      } else {
        const regex = selectedValues.map(val => escapeRegExp(val)).join('|');
        table.column(index).search(regex, true, false).draw();
      }
      atualizarResultadoCalculo();
    });
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inicializarFiltros() {
  $('#tabelaRelatorio thead tr.filtros th').each(function (index) {
    const filtro = $(this).find('select, input');
    filtro.attr('data-index', index);

    filtro.on('click', function (e) {
      e.stopPropagation();
    });

    filtro.on('change keyup', function () {
      const table = $('#tabelaRelatorio').DataTable();

      if (this.tagName === 'SELECT') {
        aplicarFiltroMultiplo(index);
      } else {
        const valorFiltro = this.value.trim();
        table.column(index).search(valorFiltro).draw();
      }

      atualizarVisibilidadeBotoesFiltro();
      atualizarResultadoCalculo();
      atualizarFiltrosDinamicos(table);
    });
  });

  $('.filtro-coluna').each(function () {
    const isMultiple = this.hasAttribute('multiple');
    $(this).select2({
      placeholder: "",
      width: '100%',
      allowClear: true,
      closeOnSelect: !isMultiple ? true : false,
      dropdownAutoWidth: true
    });
  });
}

function atualizarFiltrosDinamicos(table) {
  table.columns().every(function (index) {
    const filtro = document.getElementById('input-filtro-' + index);
    if (!filtro || filtro.tagName !== 'SELECT') return;

    const valoresSelecionados = $(filtro).val() || [];

    const isMultiple = filtro.hasAttribute('multiple');
    filtro.innerHTML = '';
    if (isMultiple) filtro.setAttribute('multiple', 'multiple');

    const uniqueValues = new Set();

    table.rows({ search: 'applied' }).every(function () {
      const cell = $(this.node()).find('td').eq(index);
      let texto = cell.find('input').length
        ? cell.find('input').val().trim()
        : cell.text().trim();
      if (texto) uniqueValues.add(texto);
    });

    Array.from(uniqueValues).sort().forEach(valor => {
      const option = document.createElement('option');
      option.value = valor;
      option.textContent = valor;
      filtro.appendChild(option);
    });

    $(filtro).off('change').select2('destroy');
    $(filtro).select2({
      placeholder: "",
      width: '100%',
      allowClear: true,
      closeOnSelect: !isMultiple ? true : false,
      dropdownAutoWidth: true
    });

    const novosValores = valoresSelecionados.filter(val => {
      return Array.from(filtro.options).some(opt => opt.value === val);
    });
    $(filtro).val(novosValores).trigger('change');

    $(filtro).on('change', function () {
      const selectedValues = $(this).val() || [];
      if (selectedValues.length === 0) {
        table.column(index).search('').draw();
      } else {
        const regex = selectedValues.map(val => escapeRegExp(val)).join('|');
        table.column(index).search(regex, true, false).draw();
      }

      atualizarVisibilidadeBotoesFiltro();
      atualizarResultadoCalculo();
    });
  });
}

function aplicarFiltroMultiplo(index) {
  const selectedValues = $(`#input-filtro-${index}`).val() || [];

  const table = $('#tabelaRelatorio').DataTable();
  
  if (selectedValues.length === 0) {
    table.column(index).search('').draw();
  } else {
    const regex = selectedValues.map(val => escapeRegExp(val)).join('|');
    table.column(index).search(regex, true, false).draw(); // regex ativado
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Protege caracteres especiais
}

/**
 * Função corrigida para exportação (Copiar, PDF, etc.)
 * Agora ela consegue ler valores de campos <select> e <input>, além do texto normal.
 */
function exportarCorpo(data, row, column, node) {
  const cell = $(node); // 'node' é a célula da tabela (<td>)
  const select = cell.find('select');
  const input = cell.find('input');
  let valor;

  if (select.length > 0) {
    // Se encontrar um <select>, pega o valor da opção selecionada
    valor = select.val();
  } else if (input.length > 0) {
    // Se encontrar um <input>, pega o seu valor
    valor = input.val();
  } else {
    // Caso contrário, pega o texto da célula
    valor = cell.text().trim();
  }
  
  // Mantém a formatação de número se aplicável
  if (valor && !isNaN(String(valor).replace(',', '.'))) {
    valor = parseFloat(String(valor).replace(',', '.')).toLocaleString('pt-BR');
  }
  
  return valor;
}

function exportarCabecalho(data, columnIdx) {
  const th = $('#tabelaRelatorio thead tr:first th').eq(columnIdx);
  const span = th.find('span');
  return span.length ? span.text().trim() : $(th).text().trim();
}

function preencherDatalistsFiltrados(table) {
  table.columns().every(function (index) {
    const datalist = document.getElementById('datalist_' + index);
    if (!datalist) return;

    const uniqueValues = new Set();

    table.rows({ search: 'applied' }).every(function () {
      const cell = $(this.node()).find('td').eq(index);
      let texto = cell.find('input').length
        ? cell.find('input').val().trim()
        : cell.text().trim();
      if (texto) uniqueValues.add(texto);
    });

    datalist.innerHTML = '';
    Array.from(uniqueValues).sort().forEach(valor => {
      const option = document.createElement('option');
      option.value = valor;
      datalist.appendChild(option);
    });
  });
}

function forcarAtualizarFiltros() {
  const table = $('#tabelaRelatorio').DataTable();
  atualizarFiltrosDinamicos(table);
}

// ?? FUNÇÃO NOVA: Troca o select pelo input ao selecionar "Outros"
function observacaoMudou(selectElement) {
  const container = selectElement.closest('.d-flex');
  const id = container.getAttribute('data-id'); // Obtém o ID da linha (Pedido_Index)
  const input = document.getElementById('obs_input_' + id); // ID do input

  // Se "Outros" for selecionado, mostra o input e esconde o select
  if (selectElement.value === 'Outros') {
    selectElement.classList.add('d-none');
    input.classList.remove('d-none');
    input.value = ''; // Limpa para digitação livre (se for um novo "Outros")
    input.focus();
  } else {
    // Se voltar para uma opção predefinida, mostra o select e esconde o input
    input.classList.add('d-none');
    selectElement.classList.remove('d-none');
  }
}


$(document).ready(function () {
  const table = $('#tabelaRelatorio').DataTable({
    language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json" },
    scrollX: true,
    pageLength: 10,
    lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
    colReorder: true,
    colResize: { handleWidth: 10 },
    fixedHeader: true, // <- Adicione isso
    order: [[2, 'desc']],
    dom: '<"top d-flex justify-content-between align-items-center"lpf>rt<"bottom ip"><"clear">',
    buttons: [
      {
        extend: 'copy',
        className: 'btn btn-outline-light btn-sm',
        exportOptions: { columns: ':visible', format: { body: exportarCorpo, header: exportarCabecalho } }
      },
      {
        extend: 'csv',
        className: 'btn btn-outline-light btn-sm',
        exportOptions: { columns: ':visible', format: { body: exportarCorpo, header: exportarCabecalho } }
      },
      // {
      //   extend: 'excel',
      //   className: 'btn btn-outline-light btn-sm',
      //   exportOptions: { columns: ':visible', format: { body: exportarCorpo, header: exportarCabecalho } }
      // },
      {
        extend: 'pdf',
        className: 'btn btn-outline-light btn-sm',
        exportOptions: { columns: ':visible', format: { body: exportarCorpo, header: exportarCabecalho } },
        customize: function (doc) {
          doc.defaultStyle.fontSize = 7;
          doc.styles.tableHeader.fontSize = 8;
          doc.styles.tableHeader.alignment = 'center';
          doc.styles.tableBodyEven.alignment = 'center';
          doc.styles.tableBodyOdd.alignment = 'center';
        }
      },
      {
        extend: 'print',
        className: 'btn btn-outline-light btn-sm',
        exportOptions: { columns: ':visible', format: { body: exportarCorpo, header: exportarCabecalho } }
      }
    ],
    initComplete: function () {
      inicializarFiltros(); // ? esta chamada é essencial
      preencherFiltrosDinamicos(this.api()); // ?? Chama a função correta para preencher + ativar filtro
      atualizarColunaCalculo();
      atualizarResultadoCalculo();
      forcarAtualizarFiltros();
    },
    columnDefs: [
      {
        targets: 0,
        render: function (data, type, row, meta) {
          if (type === 'filter' || type === 'sort') {
            const temp = document.createElement('div');
            temp.innerHTML = data;
            const input = temp.querySelector('input');
            return input ? input.value : data;
          }
          return data;
        }
      },
      {
        targets: [5, 6, 7, 8],
        render: function (data, type, row) {
          if (type === 'display' || type === 'filter') {
            return typeof data === 'string' ? data.replace(/<\/?[^>]+(>|$)/g, '') : data;
          }
          return data;
        }
      }
    ]
  });

  table.buttons().container().appendTo('.dataTables_filter');

  $('#colunaCalculo, #tipoCalculo').on('change', atualizarResultadoCalculo);
  atualizarVisibilidadeBotoesFiltro();
  atualizarResultadoCalculo();

    // ?? AQUI: toda vez que filtrar, desenhar, mudar, atualiza dinamicamente
    // forcarAtualizarFiltros();

});
