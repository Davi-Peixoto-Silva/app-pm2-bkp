document.addEventListener('DOMContentLoaded', () => {
    const botao = document.getElementById('openModalResumoProducao');
    console.log('?? Botão produção encontrado?', botao);
  
    if (botao) {
      botao.addEventListener('click', () => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
        const formatDate = (date) => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };
  
        abrirModalDinamico({
          titulo: 'Relatório de Produção por Máquina',
          action: '/relatorio-producao',
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
    }
  });
  