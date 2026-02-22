document.addEventListener('DOMContentLoaded', () => {
  // Toggle Resumo Logístico
  const btnResumo = document.getElementById('btnResumoLogistica');
  const containerResumo = document.getElementById('resumoLogisticaContainer');

  if (btnResumo && containerResumo) {
    btnResumo.addEventListener('click', () => {
      const visivel = containerResumo.style.display === 'block';
      containerResumo.style.display = visivel ? 'none' : 'block';
      btnResumo.innerHTML = visivel
        ? '<i class="bi bi-truck"></i> Mostrar Resumo Logístico'
        : '<i class="bi bi-truck"></i> Ocultar Resumo Logístico';
    });
  }

  // Toggle Evolução por Dia
  const btnFaturamento = document.getElementById('btnResumoFaturamento');
  const containerFaturamento = document.getElementById('resumoFaturamentoContainer');

  if (btnFaturamento && containerFaturamento) {
    btnFaturamento.addEventListener('click', () => {
      const visivel = containerFaturamento.style.display === 'block';
      containerFaturamento.style.display = visivel ? 'none' : 'block';
      btnFaturamento.innerHTML = visivel
        ? '<i class="bi bi-calendar3"></i> Mostrar Evolução por Dia'
        : '<i class="bi bi-calendar3"></i> Ocultar Evolução por Dia';
    });
  }

  // Função segura para formatar data sem afetar fuso horário
  const formatarDataBR = (dataIso) => {
    return dataIso?.split('T')[0]?.split('-').reverse().join('/') || '';
  };

  // Processamento da tabela resumo de faturamento
  const tabelaBody = document.querySelector('#tabelaResumo tbody');
  const mediaEl = document.getElementById('mediaPrecoMedio');
  const mediaFaturamentoEl = document.getElementById('mediaFaturamento');
  const mediaPesoEl = document.getElementById('mediaPeso');
  const maiorEl = document.getElementById('maiorPrecoMedio');
  const menorEl = document.getElementById('menorPrecoMedio');

  if (tabelaBody && Array.isArray(resumo)) {
    let totalPrecoMedio = 0;
    let totalFaturamento = 0;
    let totalPeso = 0;
    let count = 0;
    let maior = -Infinity;
    let menor = Infinity;

    resumo.forEach((linha) => {
      const data = formatarDataBR(linha.Data);
      const faturamento = parseFloat(linha.Faturamento || 0);
      const peso = parseFloat(linha.PesoLiquido || 0);
      const precoMedio = peso > 0 ? faturamento / peso : 0;

      if (peso > 0) {
        totalPrecoMedio += precoMedio;
        totalFaturamento += faturamento;
        totalPeso += peso;
        count++;
        maior = Math.max(maior, precoMedio);
        menor = Math.min(menor, precoMedio);
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${data}</td>
        <td>R$ ${faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td>${peso.toLocaleString('pt-BR')}</td>
        <td>R$ ${precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      `;
      tabelaBody.appendChild(tr);
    });

    const media = count > 0 ? totalPrecoMedio / count : 0;
    const mediaFaturamento = count > 0 ? totalFaturamento / count : 0;
    const mediaPeso = count > 0 ? totalPeso / count : 0;

    if (mediaEl) mediaEl.textContent = `R$ ${media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (mediaFaturamentoEl) mediaFaturamentoEl.textContent = `R$ ${mediaFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (mediaPesoEl) mediaPesoEl.textContent = `${mediaPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (maiorEl) maiorEl.textContent = `R$ ${maior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (menorEl) menorEl.textContent = `R$ ${menor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  // Inicializar DataTables nas duas tabelas
  $('#tabelaResumo').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'copy', text: 'Copiar' },
      { extend: 'excel', text: 'Excel' },
      { extend: 'pdf', text: 'PDF' },
      { extend: 'print', text: 'Imprimir' }
    ],
    language: {
      url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
    },
    paging: false,
    searching: false,
    ordering: false
  });

  $('#tabelaResumoLog').DataTable({
    dom: 'Bfrtip',
    buttons: [
      { extend: 'copy', text: 'Copiar' },
      { extend: 'excel', text: 'Excel' },
      { extend: 'pdf', text: 'PDF' },
      { extend: 'print', text: 'Imprimir' }
    ],
    language: {
      url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
    },
    paging: false,
    searching: false,
    ordering: false
  });

  // Atualiza o título da página com datas formatadas corretamente
  const tituloEl = document.querySelector('h2');
  if (typeof startDate !== 'undefined' && typeof endDate !== 'undefined' && tituloEl) {
    const titulo = `Painel Faturamento (${formatarDataBR(startDate)} a ${formatarDataBR(endDate)})`;
    tituloEl.textContent = titulo;
  }
});

