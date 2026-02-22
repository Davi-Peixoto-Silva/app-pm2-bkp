const ordemMaquinas = [
  "Onduladeira", "TOMASONI 02", "TOMASONI", "SUNDEMBA", "TOM CV", "AMAR", "DIV", "DIV.S."
];

function prepareData(data, manutencoes) {
  const graficosData = [];
  const startDate = document.getElementById('startDateHidden')?.value;
  const endDate = document.getElementById('endDateHidden')?.value;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  Object.keys(data).forEach(maquina => {
    const valores = data[maquina];
    if (!valores.length) return;

    const todasDatas = [];
    let atual = new Date(start);
    while (atual <= end) {
      todasDatas.push(new Date(atual.getTime()));
      atual.setDate(atual.getDate() + 1);
    }

    const mapaDados = {};
    valores.forEach(item => {
      const dt = new Date(item.Dt_Entrega.split('T')[0]);
      const chave = dt.toISOString().split('T')[0];
      mapaDados[chave] = {
        Peso_Liq: item.Peso_Liq,
        Capacidade: item.Capacidade
      };
    });

    const labels = [];
    const pesoLiq = [];
    const capacidade = [];
    const acimaCapacidade = [];
    const backgroundColors = [];

    todasDatas.forEach(dt => {
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      // Criamos o label base primeiro
      let labelFormatado = `${diasSemana[dt.getDay()]}, ${String(dt.getDate()).padStart(2, '0')}/${meses[dt.getMonth()]}`;

      const chave = dt.toISOString().split('T')[0];
      const keyManut = `${chave}|${maquina}`;

      // Adicionamos o ícone se houver manutenção
      if (manutencoes && manutencoes[keyManut]) {
        labelFormatado += ' 🛠️'; 
      }
      labels.push(labelFormatado);

      if (mapaDados[chave]) {
        const pl = mapaDados[chave].Peso_Liq;
        const cap = mapaDados[chave].Capacidade;
        pesoLiq.push(pl);
        capacidade.push(cap);
        acimaCapacidade.push(Math.max(pl - cap, 0));
      } else {
        pesoLiq.push(0);
        capacidade.push(valores[0].Capacidade || 100);
        acimaCapacidade.push(0);
      }

      // Removemos a lógica de cor. A cor será sempre a mesma.
      backgroundColors.push('rgba(54, 162, 235, 0.7)');
      
    });

    graficosData.push({ maquina, labels, pesoLiq, capacidade, acimaCapacidade, backgroundColors });
  });

  graficosData.sort((a, b) => {
    const indexA = ordemMaquinas.indexOf(a.maquina);
    const indexB = ordemMaquinas.indexOf(b.maquina);
    return (indexA === -1 ? Infinity : indexA) - (indexB === -1 ? Infinity : indexB);
  });

  return graficosData;
}

function renderChart(ctx, labels, pesoLiq, capacidade, acimaCapacidade, backgroundColors, maquina, manutencoes) {
  const formatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const totalPesoLiq = pesoLiq.reduce((sum, val) => sum + val, 0);
  const totalCapacidade = capacidade.reduce((sum, val, i) => {
    const label = labels[i];
    // Ignora domingos na soma da capacidade total
    if (label.startsWith('Dom')) return sum;
    return sum + val;
  }, 0);
  const totalDisponivel = capacidade.reduce((sum, val, i) => {
    const label = labels[i];
    // Ignora domingos na soma da capacidade disponível
    if (label.startsWith('Dom')) return sum;
    return sum + (val - pesoLiq[i]);
  }, 0);

  // A contagem de dias com manutenção continua igual, pois se baseia na existência do ícone
  const qtdManutencao = labels.filter(label => label.includes('🛠️')).length;

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Peso Líquido",
          data: pesoLiq,
          backgroundColor: backgroundColors, // Agora sempre terá a mesma cor
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        },
        {
          label: "Acima Capacidade",
          data: acimaCapacidade,
          backgroundColor: "rgba(255, 99, 132, 0.7)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        },
        {
          label: "Capacidade",
          data: capacidade,
          type: "line",
          borderColor: "rgba(255, 206, 86, 0.9)",
          borderWidth: 2,
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 5,
          datalabels: { display: false },
          borderDash: [4, 4]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 1.0,
      plugins: {
        legend: { position: "top" },
        title: {
          display: true,
          font: { size: 14 },
          padding: { top: 10, bottom: 10 },
          text: `${maquina} - Peso Líquido: ${formatter.format(totalPesoLiq)} Ton | Capacidade: ${formatter.format(totalCapacidade)} Ton | Disponível: ${formatter.format(totalDisponivel)} Ton | Manut.: ${qtdManutencao} dia(s)`
        },
        datalabels: {
          color: 'black',
          font: { size: 12 },
          formatter: (value) => value > 0 ? formatter.format(value) : '',
          display: ctx => ctx.dataset.type !== 'line',
          anchor: ctx => ctx.dataset.label === 'Acima Capacidade' ? 'end' : 'center',
          align: ctx => ctx.dataset.label === 'Acima Capacidade' ? 'start' : 'center'
        },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.7)",
          titleFont: { size: 10 },
          bodyFont: { size: 10 },
          footerFont: { size: 10, weight: 'bold' },
          callbacks: {
            footer: function(tooltipItems) {
              const label = tooltipItems[0].label;
              if (label.includes('🛠️')) {
                return 'Manutenção Programada';
              }
              return '';
            }
          }
        }
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const chart = elements[0].element.$context.chart;
          const label = chart.data.labels[elements[0].index];
          // Removemos o ícone antes de mandar para a função de detalhes
          fetchDetails(label.replace(' 🛠️', ''), maquina);
        }
      },
      scales: {
        x: {
          type: 'category',
          stacked: true,
          ticks: {
            font: { size: 9 },
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45,
            callback: function(value) {
              return this.getLabelForValue(value);
            }
          },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { font: { size: 9 } },
          title: { display: true, text: "Toneladas", font: { size: 10 } }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

function renderCharts(data, manutencoes) {
  const graficosData = prepareData(data, manutencoes);
  const graficosDiv = document.getElementById('graficos');
  graficosDiv.innerHTML = "";

  graficosData.forEach(({ maquina, labels, pesoLiq, capacidade, acimaCapacidade, backgroundColors }) => {
    const container = document.createElement('div');
    container.style.marginBottom = '50px';
    const canvas = document.createElement('canvas');
    canvas.id = `grafico-${maquina}`;
    container.appendChild(canvas);
    graficosDiv.appendChild(container);

    const ctx = canvas.getContext('2d');
    renderChart(ctx, labels, pesoLiq, capacidade, acimaCapacidade, backgroundColors, maquina, manutencoes);
  });
}

function fetchDetails(dataLabel, maquina) {
  try {
    console.log("Label recebido:", dataLabel);

    const [diaSemana, dataTexto] = dataLabel.split(', ');
    const [dia, mesAbrev] = dataTexto.split('/');

    const meses = { Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5, Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11 };
    const mesNumero = meses[mesAbrev];

    const anoAtual = new Date().getFullYear();
    const dataISO = new Date(anoAtual, mesNumero, parseInt(dia)).toISOString().split('T')[0];

    console.log("Data ISO para enviar:", dataISO);

    const payload = {
      date: dataISO,
      machine: maquina,
      filtro: document.querySelector('[name="filtroSelect"]').value,
      entrega: document.querySelector('[name="tipoEntrega"]').value,
      familia: document.querySelector('[name="familia"]').value,
      ativo: document.querySelector('[name="ativo"]').value,
      atraso: document.querySelector('[name="atraso"]').value
    };

    fetch('/comercial/detalhes-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(response => {
      if (response.data.length > 0) {
        document.getElementById('detailsModalLabel').textContent = `Detalhes: ${dataLabel} - ${maquina}`;
        populateModal(response.data);
        const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
        modal.show();
      } else {
        alert("Nenhum detalhe encontrado para esta data.");
      }
    })
    .catch(error => {
      console.error("Erro ao buscar detalhes:", error);
      alert("Erro ao buscar detalhes.");
    });

  } catch (error) {
    console.error("Erro no fetchDetails:", error.message);
    alert("Erro ao processar a data.");
  }
}

function populateModal(data) {
  if ($.fn.DataTable.isDataTable('#tabelaDetalhes')) {
    $('#tabelaDetalhes').DataTable().clear().destroy();
  }

  const tbody = document.getElementById('detailsTableBody');
  tbody.innerHTML = "";

  let totalPeso = 0;
  let totalQuantidade = 0;

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${item.PedCliente || ''}">${item.PedCliente || ''}</td>
      <td title="${item.Item || ''}">${item.Item || ''}</td>
      <td title="${item.Referencia || ''}">${item.Referencia || ''}</td>
      <td title="${item.Cliente || ''}">${item.Cliente || ''}</td>
      <td title="${item.CIF_FOB || ''}">${item.CIF_FOB || ''}</td>
      <td class="text-end" title="${item.Qtd_Pedido || ''}">${item.Qtd_Pedido ? parseFloat(item.Qtd_Pedido).toLocaleString('pt-BR') : '-'}</td>
      <td class="text-end" title="${item.Peso_Liq || ''}">${item.Peso_Liq ? parseFloat(item.Peso_Liq).toLocaleString('pt-BR') : '-'}</td>
      <td title="${item.DT_Implantacao || ''}">${item.DT_Implantacao || ''}</td>
      <td title="${item.Entrege_x_Geracao || ''}">${item.Entrege_x_Geracao || ''}</td>
      <td title="${item.Maquina1 || ''}">${item.Maquina1 || ''}</td>
      <td title="${item.Maquina2 || ''}">${item.Maquina2 || ''}</td>
    `;
    tbody.appendChild(tr);

    totalPeso += parseFloat(item.Peso_Liq || 0);
    totalQuantidade += parseFloat(item.Qtd_Pedido || 0);
  });

  document.getElementById('totalQtdPedido').textContent = totalQuantidade.toLocaleString('pt-BR');
  document.getElementById('totalPeso').textContent = totalPeso.toLocaleString('pt-BR');

  $('#tabelaDetalhes').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'copy', text: 'Copiar', className: 'btn btn-outline-primary btn-sm' },
      { extend: 'csv', text: 'CSV', className: 'btn btn-outline-success btn-sm' },
      { extend: 'excel', text: 'Excel', className: 'btn btn-outline-success btn-sm' },
      { extend: 'print', text: 'Imprimir', className: 'btn btn-outline-dark btn-sm' }
    ],
    language: {
      url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
    },
    pageLength: 10,
    responsive: true,
    ordering: true,
    searching: false
  });
}

document.getElementById('searchInput')?.addEventListener('input', function () {
  const filter = this.value.toLowerCase();
  const rows = document.querySelectorAll('#detailsTableBody tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(filter) ? "" : "none";
  });

  atualizarTotaisFiltrados();
});

document.getElementById('btnClearSearch')?.addEventListener('click', () => {
  const searchInput = document.getElementById('searchInput');
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
});

function atualizarTotaisFiltrados() {
  let totalPeso = 0;
  let totalQuantidade = 0;
  const rows = document.querySelectorAll('#detailsTableBody tr');

  rows.forEach(row => {
    if (row.style.display !== 'none' && !row.classList.contains('table-success')) {
      const qtdPedido = row.children[5]?.textContent.replace(/\./g, '').replace(',', '.') || "0";
      const peso = row.children[6]?.textContent.replace(/\./g, '').replace(',', '.') || "0";
      totalQuantidade += parseFloat(qtdPedido);
      totalPeso += parseFloat(peso);
    }
  });

  document.getElementById('totalQtdPedido').textContent = totalQuantidade.toLocaleString('pt-BR');
  document.getElementById('totalPeso').textContent = totalPeso.toLocaleString('pt-BR');
}

// Renderiza os gráficos se houver dados
if (dadosMaquinas && Object.keys(dadosMaquinas).length > 0) {
  renderCharts(dadosMaquinas, manutencoes);
} else {
  console.warn("Nenhum dado para montar os gráficos.");
}