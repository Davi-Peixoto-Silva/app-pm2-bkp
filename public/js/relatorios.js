/* ==========================================================================
   FUNÇÕES DE INTERFACE E EDICÃO (MANTIDAS DO SEU CÓDIGO ORIGINAL)
   ========================================================================== */

function habilitarEdicao(id) {
  const input = document.getElementById('obs_' + id);
  if (input) {
    input.disabled = false;
    
    // Busca o pai e os botões de forma segura
    const container = input.closest('.d-flex');
    const btnEditar = container.querySelector('.btn-outline-primary'); 
    const btnSalvar = container.querySelector('.btn-success');

    if (btnEditar) btnEditar.classList.add('d-none');
    if (btnSalvar) btnSalvar.classList.remove('d-none');
    
    input.focus();
  }
}

async function confirmarESalvar(id) {
  const input = document.getElementById('obs_' + id);
  if (!input) return;

  const valor = input.value.trim();
  const pedido = id.split('_')[0];
  
  // Captura os elementos de interface
  const container = input.closest('.d-flex');
  const btnEditar = container.querySelector('.btn-outline-primary');
  const btnSalvar = container.querySelector('.btn-success');

  if (!valor) {
    toast('Digite uma observação antes de salvar.', 'warning');
    return;
  }

  if (!confirm(`Deseja salvar a observação para o pedido ${pedido}?`)) {
    return;
  }

  // Estado de carregamento
  if (btnSalvar) {
    btnSalvar.disabled = true;
    const iconeOriginal = btnSalvar.innerHTML; 
    btnSalvar.innerHTML = '<i class="bi bi-hourglass-split"></i>';
  }

  try {
    const response = await fetch('/comercial/observacoes-comerciais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido, observacao: valor })
    });

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

    const data = await response.json();

    if (data.status === 'ok') {
      // SUCESSO
      input.disabled = true;
      
      btnSalvar.classList.add('d-none'); 
      btnEditar.classList.remove('d-none'); 
      
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="bi bi-save"></i>'; 

      toast(`✅ Observação salva por <strong>${data.usuario || 'desconhecido'}</strong>`, 'success');

      atualizarResultadoCalculo();
      
      // Atualiza o valor interno do DataTables
      const table = $('#tabelaRelatorio').DataTable();
      const cell = table.cell(input.closest('td'));
      cell.invalidate(); 
      
    } else {
      throw new Error(data.mensagem || 'Erro ao salvar');
    }

  } catch (err) {
    console.error('❌ Erro:', err);
    toast('Erro ao salvar: ' + err.message, 'danger');
    
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="bi bi-save"></i>';
    }
  }
}

/* ==========================================================================
   FUNÇÕES DE FILTROS E CÁLCULOS
   ========================================================================== */

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
    const valor = cell.find('input').length ? cell.find('input').val() : cell.text();
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
  const theadRows = $('#tabelaRelatorio thead tr');
  const headerRow = theadRows.eq(0); 

  table.columns().every(function (index) {
    let isNumerico = true;
    this.nodes().to$().each(function () {
      let texto = $(this).find('input').length
        ? $(this).find('input').val().trim()
        : $(this).text().trim();

      if (texto && isNaN(texto.replace(',', '.'))) {
        isNumerico = false;
        return false;
      }
    });

    if (isNumerico) {
      const th = headerRow.find('th').eq(index);
      const span = th.find('span');
      const nome = span.length ? span.text().trim() : (th.text().trim() || `Coluna ${index}`);

      const option = document.createElement('option');
      option.value = index;
      option.textContent = nome;
      select.appendChild(option);
    }
  });
}

function limparFiltroColunaCabecalho(index) {
  const filtro = document.getElementById('input-filtro-' + index);
  const botao = document.getElementById('btn-limpar-' + index);
  const table = $('#tabelaRelatorio').DataTable();

  if (filtro) {
    if (filtro.tagName === 'SELECT') {
      const $filtro = $(filtro);
      $filtro.next('.select2-container').find('.select2-selection__clear').remove();

      if ($filtro.hasClass('select2-hidden-accessible')) {
        $filtro.select2('destroy');
      }

      $(filtro).val(null);
      table.column(index).search('').draw();

      setTimeout(() => {
        $(filtro).select2({
          placeholder: "",
          width: '100%',
          allowClear: false,
          closeOnSelect: false,
          dropdownAutoWidth: true
        });
      }, 0);
    } else {
      filtro.value = '';
      table.column(index).search('').draw();
    }
  }

  if (botao) {
    botao.classList.add('d-none');
  }

  atualizarResultadoCalculo();
  atualizarVisibilidadeBotoesFiltro();
  preencherDatalistsFiltrados(table);
}

function atualizarVisibilidadeBotoesFiltro() {
  const table = $('#tabelaRelatorio').DataTable();
  $('#tabelaRelatorio thead tr.filtros th').each(function (index) {
    const input = document.getElementById('input-filtro-' + index);
    const botao = document.getElementById('btn-limpar-' + index);
    if (!input || !botao) return;

    const filtroInput = input.value.trim();
    const filtroDataTable = table.column(index).search();

    if (filtroInput !== '' || filtroDataTable !== '') {
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

    filtro.innerHTML = '';
    const uniqueValues = new Set();

    this.nodes().to$().each(function () {
      let texto = $(this).find('input').length
        ? $(this).find('input').val().trim()
        : $(this).text().trim();
      if (texto) uniqueValues.add(texto);
    });

    Array.from(uniqueValues).sort().forEach(valor => {
      const option = document.createElement('option');
      option.value = valor;
      option.textContent = valor;
      filtro.appendChild(option);
    });

    $(filtro).select2({
      placeholder: "",
      width: '100%',
      allowClear: true,
      closeOnSelect: false,
      dropdownAutoWidth: true
    });

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

    filtro.on('click', function (e) { e.stopPropagation(); });

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
    $(this).select2({
      placeholder: "",
      width: '100%',
      allowClear: true,
      closeOnSelect: false,
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
      closeOnSelect:false,
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
    table.column(index).search(regex, true, false).draw();
  }

  atualizarVisibilidadeBotoesFiltro();
  atualizarResultadoCalculo();

  setTimeout(() => {
    atualizarFiltrosDinamicos(table);
    $('.filtro-coluna').each(function () {
      if ($(this).hasClass('select2-hidden-accessible')) {
        $(this).select2('destroy');
        $(this).select2({
          placeholder: "",
          width: '100%',
          allowClear: true,
          closeOnSelect: false,
          dropdownAutoWidth: true
        });
      }
    });
  }, 0);
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

/* ==========================================================================
   FUNÇÕES DE EXPORTAÇÃO AJUSTADAS (CORREÇÃO DE FORMATO)
   ========================================================================== */

function exportarCorpo(data, row, column, node) {
  const $node = $(node);
  
  // 1. Pega o valor (Input ou Texto)
  const input = $node.find('input');
  let valor = input.length ? input.val() : $node.text();

  if (typeof valor !== 'string') return valor;

  // 2. Limpeza básica (remove quebras de linha e espaços extras)
  valor = valor.replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/g, " ").trim();

  // --- PROTEÇÕES ANTI-DESCONFIGURAÇÃO ---

  // 3. PROTEÇÃO DE DATA: 
  // Se o valor parecer uma data (DD/MM/AAAA), devolve ele intacto.
  // Regex verifica formato XX/XX/XXXX
  if (valor.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    return valor; 
  }

  // 4. PROTEÇÃO DE INTEIROS (IDs, Pedidos, Anos):
  // Se for apenas números sem vírgula ou ponto (ex: "2025" ou "12345"), devolve intacto.
  // Evita que o Ano 2025 vire 2.025,00
  if (valor.match(/^\d+$/)) {
    return valor;
  }

  // 5. FORMATAÇÃO DE VALORES DECIMAIS:
  // Só entra aqui se tiver cara de decimal (tem vírgula ou ponto no meio)
  // Ex: "1.200,50" ou "10,90"
  // Remove pontos de milhar para converter corretamente para Float
  let valorParaConversao = valor.replace(/\./g, '').replace(',', '.');

  if (!isNaN(valorParaConversao) && valorParaConversao.trim() !== '') {
    const numero = parseFloat(valorParaConversao);
    
    // Se o número original tinha casas decimais ou vírgula, mantemos a formatação PT-BR
    // Se quiser exportar "cru" para o Excel somar mais fácil, use: return numero.toString().replace('.', ',');
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Se não for nada disso, devolve o texto original
  return valor;
}

function exportarCabecalho(data, columnIdx, node) {
  // 1. Verifica se o "node" (a célula th) existe
  if (!node) return '';

  // 2. VERIFICAÇÃO CRÍTICA:
  // Pega o índice da linha pai (tr). Se for maior que 0, é a linha de filtro.
  // Retornamos vazio para não duplicar o texto no Excel.
  if ($(node).parent().index() !== 0) {
    return ''; 
  }

  // 3. Se for a primeira linha (índice 0), pega o texto correto
  const $node = $(node);
  
  // Tenta pegar o texto de dentro do span (onde está seu título), 
  // caso contrário pega o texto da célula inteira, mas limpa espaços.
  const span = $node.find('span.fw-bold'); // Fui mais específico na classe
  let texto = span.length ? span.text() : $node.text();
  
  // 4. Limpeza final (remove quebras de linha e espaços duplos)
  return texto.replace(/(\r\n|\n|\r)/gm, "").trim();
}

/* ==========================================================================
   INICIALIZAÇÃO DO DATATABLE
   ========================================================================== */
/* ==========================================================================
   INICIALIZAÇÃO DO DATATABLE (BLOCO COMPLETO)
   ========================================================================== */

$(document).ready(function () {
  const table = $('#tabelaRelatorio').DataTable({
    language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json" },
    scrollX: true,
    pageLength: 10,
    lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
    colReorder: true,
    fixedHeader: true,
    order: [[2, 'desc']], // Certifique-se que a coluna 2 (índice) existe e é a desejada para ordenação inicial
    dom: '<"top d-flex justify-content-between align-items-center"lpf>rt<"bottom ip"><"clear">',
    
    // --- CONFIGURAÇÃO DOS BOTÕES ---
    buttons: [
      {
        extend: 'copyHtml5',
        text: '<i class="bi bi-clipboard"></i> Copiar',
        className: 'btn btn-outline-light btn-sm',
        exportOptions: { 
            columns: ':visible', 
            format: { body: exportarCorpo, header: exportarCabecalho } 
        }
      },
      {
        extend: 'csvHtml5',
        text: '<i class="bi bi-filetype-csv"></i> CSV',
        className: 'btn btn-outline-light btn-sm',
        fieldSeparator: ';', // Define ponto e vírgula para Excel PT-BR
        bom: true,           // Adiciona BOM para corrigir caracteres acentuados
        exportOptions: { 
            columns: ':visible', 
            format: { body: exportarCorpo, header: exportarCabecalho } 
        },
        // FUNÇÃO DE LIMPEZA DO CSV: Remove a linha vazia gerada pelos filtros do cabeçalho
        customize: function (csv) {
            var lines = csv.split('\n');
            // Remove a segunda linha (índice 1) se houver mais de uma linha
            if (lines.length > 1) {
              lines.splice(1, 1); 
            }
            return lines.join('\n');
        }
      },
      {
        extend: 'pdfHtml5',
        text: '<i class="bi bi-file-earmark-pdf"></i> PDF',
        className: 'btn btn-outline-light btn-sm',
        orientation: 'landscape',
        exportOptions: { 
            columns: ':visible', 
            format: { body: exportarCorpo, header: exportarCabecalho } 
        },
        customize: function (doc) {
          doc.defaultStyle.fontSize = 7;
          doc.styles.tableHeader.fontSize = 8;
          doc.styles.tableHeader.alignment = 'center';
          // Centraliza todas as células do corpo da tabela
          if(doc.content[1] && doc.content[1].table) {
             doc.content[1].table.body.forEach(function(row) {
                row.forEach(function(cell) {
                   cell.alignment = 'center';
                });
             });
          }
        }
      },
      {
        extend: 'print',
        text: '<i class="bi bi-printer"></i> Imprimir',
        className: 'btn btn-outline-light btn-sm',
        exportOptions: { 
            columns: ':visible', 
            format: { body: exportarCorpo, header: exportarCabecalho } 
        }
      }
    ],
    
    // --- INICIALIZAÇÃO DOS FILTROS E CÁLCULOS ---
    initComplete: function () {
      inicializarFiltros(); 
      preencherFiltrosDinamicos(this.api()); 
      atualizarColunaCalculo();
      atualizarResultadoCalculo();
      forcarAtualizarFiltros();
    },
    
    // --- DEFINIÇÕES DE COLUNAS (SORT vs DISPLAY) ---
    columnDefs: [
      {
        targets: '_all',
        render: function (data, type, row, meta) {
          // Para ORDENAÇÃO e FILTRO: Remove tags HTML (pega texto limpo ou valor do input)
          if (type === 'sort' || type === 'filter') {
            if (typeof data === 'string' && data.includes('<input')) {
                 const match = data.match(/value=["']?([^"'>]+)["']?/);
                 return match ? match[1] : '';
            }
            return typeof data === 'string' ? data.replace(/<\/?[^>]+(>|$)/g, '') : data;
          }
          // Para VISUALIZAÇÃO (DISPLAY): Mantém o HTML (inputs, botões, etc)
          if (type === 'display') {
            return data; 
          }
          return data;
        }
      }
    ]
  });

  // --- POSICIONAMENTO E EVENTOS ---
  
  // Move os botões para dentro do container de filtro do DataTables (layout)
  table.buttons().container().appendTo('.dataTables_filter');

  // Adiciona listeners para recalcular quando o usuário muda o tipo de cálculo ou coluna
  $('#colunaCalculo, #tipoCalculo').on('change', atualizarResultadoCalculo);
  
  // Atualiza botões de limpar filtro e recalcula valores iniciais
  atualizarVisibilidadeBotoesFiltro();
  atualizarResultadoCalculo();
});
