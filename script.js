// Variáveis e Constantes
const VEICULOS_TERRESTRES = { '4x4': { consumo_km_l: 10 }, 'Carro': { consumo_km_l: 12 }, 'Moto': { consumo_km_l: 32 } };
const MOTORES_FLUVIAIS = { '13 HP': { litros_hora: 5, km_hora: 20 }, '15 HP': { litros_hora: 5, km_hora: 20 }, '25 HP': { litros_hora: 10, km_hora: 30 }, '40 HP': { litros_hora: 25, km_hora: 40 }, '60 HP': { litros_hora: 30, km_hora: 45 }, '90 HP': { litros_hora: 40, km_hora: 45 }, '115 HP': { litros_hora: 45, km_hora: 50 }, '150 HP': { litros_hora: 55, km_hora: 50 }, '200 HP': { litros_hora: 75, km_hora: 60 }, '250 HP': { litros_hora: 90, km_hora: 65 } };
let dadosCompletos = [];
let viagensRegistadas = [];
let simulacoesGuardadas = [];
let viagemAtualParaCalculo = null;
let costsChart = null;

// Funções da aplicação
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    const typeClasses = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500' };
    toast.classList.add(typeClasses[type] || typeClasses.info);
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 5000);
    }
}

function normalizeHeader(h) {
    const header = h.trim().toLowerCase().replace(/_/g, '');
    if (['agência', 'agencia'].includes(header)) return 'agencia';
    if (['município', 'municipio'].includes(header)) return 'municipio';
    if (['setor', 'geocodigo'].includes(header)) return 'geocodigo';
    if (['distanciasede'].includes(header)) return 'distancia_sede';
    if (['trajetodiario'].includes(header)) return 'trajeto_diario';
    if (['numeroestabelecimentos'].includes(header)) return 'estabelecimentos';
    return header;
}

function popularAgencias(agenciaSelect) {
    agenciaSelect.innerHTML = '<option value="">-- Escolha uma agência --</option>';
    [...new Set(dadosCompletos.map(item => item.agencia))].filter(Boolean).sort().forEach(agencia => {
        agenciaSelect.appendChild(new Option(agencia, agencia));
    });
    if (agenciaSelect.options.length > 0) {
        agenciaSelect.selectedIndex = 0;
        atualizarMunicipios(agenciaSelect);
    }
}

function atualizarMunicipios(agenciaSelect) {
    const municipioSelect = document.getElementById('municipio-select');
    const geocodigosContainer = document.getElementById('geocodigos-container');
    const setoresContainerWrapper = document.getElementById('setores-container-wrapper');
    const municipioContainer = document.getElementById('municipio-container');

    const agenciaSelecionada = agenciaSelect.value;
    municipioSelect.innerHTML = '<option value="">-- Escolha um município --</option>';
    geocodigosContainer.innerHTML = '<p class="text-gray-400 text-center mt-4">Selecione um município para ver os setores.</p>';
    setoresContainerWrapper.classList.add('disabled-section');
    if (!agenciaSelecionada) {
        municipioContainer.classList.add('disabled-section');
        return;
    }
    [...new Set(dadosCompletos.filter(item => item.agencia === agenciaSelecionada).map(item => item.municipio))].filter(Boolean).sort().forEach(municipio => {
        municipioSelect.appendChild(new Option(municipio, municipio));
    });
    municipioContainer.classList.remove('disabled-section');
}

function atualizarGeocodigos(municipioSelect) {
    const geocodigosContainer = document.getElementById('geocodigos-container');
    const setoresContainerWrapper = document.getElementById('setores-container-wrapper');

    const municipioSelecionado = municipioSelect.value;
    geocodigosContainer.innerHTML = '';
    if (!municipioSelecionado) {
        geocodigosContainer.innerHTML = '<p class="text-gray-400 text-center mt-4">Selecione um município para ver os setores.</p>';
        setoresContainerWrapper.classList.add('disabled-section');
        return;
    }
    dadosCompletos.filter(item => item.municipio === municipioSelecionado).forEach(item => {
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-2 p-1 rounded hover:bg-gray-200 transition';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.row_id;
        checkbox.id = `geo-${item.row_id}`;
        checkbox.className = 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
        const label = document.createElement('label');
        label.htmlFor = `geo-${item.row_id}`;
        label.textContent = `${item.geocodigo} (${item.estabelecimentos || 0} estab.)`;
        label.className = 'text-sm text-gray-800 cursor-pointer';
        div.append(checkbox, label);
        geocodigosContainer.appendChild(div);
    });
    setoresContainerWrapper.classList.remove('disabled-section');
}

function adicionarViagem() {
    const nomeServidor = document.getElementById('nome-servidor').value;
    const siapeServidor = document.getElementById('siape-servidor').value;
    const cargoServidor = document.getElementById('cargo-servidor').value;
    const agencia = document.getElementById('agencia-select').value;
    const municipio = document.getElementById('municipio-select').value;
    const selectedIds = Array.from(document.querySelectorAll('#geocodigos-container input:checked')).map(cb => parseInt(cb.value, 10));

    if (!nomeServidor || !siapeServidor || !cargoServidor || !agencia || !municipio || selectedIds.length === 0) {
        showToast("Por favor, preencha todos os campos e selecione pelo menos um setor.", 'error');
        return;
    }
    const setores = dadosCompletos.filter(item => selectedIds.includes(item.row_id));
    const novaViagem = {
        id: Date.now(),
        nomeServidor,
        siapeServidor,
        cargoServidor,
        agencia,
        municipio,
        setores
    };
    viagensRegistadas.push(novaViagem);
    showToast("Viagem adicionada com sucesso!", 'success');
    renderizarTabela();
    resetarFormularioCadastro();
}

function excluirViagem(index) {
    if (confirm('Tem a certeza de que pretende excluir esta viagem?')) {
        const viagemRemovida = viagensRegistadas[index];
        viagensRegistadas.splice(index, 1);
        const indexSimulacao = simulacoesGuardadas.findIndex(s => s.viagem_id === viagemRemovida.id);
        if (indexSimulacao !== -1) {
            simulacoesGuardadas.splice(indexSimulacao, 1);
        }
        showToast("Viagem removida.", 'info');
        renderizarTabela();
        atualizarContadorSimulacoes();
    }
}

function visualizarViagem(index) {
    const viagem = viagensRegistadas[index];
    const soma_estabelecimentos = viagem.setores.reduce((acc, s) => acc + (Number(s.estabelecimentos) || 0), 0);
    const dias_viagem = Math.ceil(soma_estabelecimentos / 4) || 1;
    const maior_distancia_sede = Math.max(0, ...viagem.setores.map(s => Number(s.distancia_sede) || 0));
    const soma_trajetos_diarios = viagem.setores.reduce((acc, s) => acc + (Number(s.trajeto_diario) || 0), 0);
    const distancia_total = (maior_distancia_sede * 2) + (soma_trajetos_diarios * dias_viagem);
    const viewModalContent = document.getElementById('view-modal-content');
    const viewModalBackdrop = document.getElementById('view-modal-backdrop');
    viewModalContent.innerHTML = `
        <div class="bg-blue-50 p-4 rounded-lg"><h3 class="font-semibold text-blue-800 mb-2">Informações do Servidor</h3><p><strong>Nome:</strong> ${viagem.nomeServidor}</p><p><strong>SIAPE:</strong> ${viagem.siapeServidor}</p><p><strong>Cargo:</strong> ${viagem.cargoServidor}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><h3 class="font-semibold text-green-800 mb-2">Localização</h3><p><strong>Agência:</strong> ${viagem.agencia}</p><p><strong>Município:</strong> ${viagem.municipio}</p></div>
        <div class="bg-gray-50 p-4 rounded-lg"><h3 class="font-semibold text-gray-800 mb-2">Dados Calculados</h3><p><strong>Número de Setores:</strong> ${viagem.setores.length}</p><p><strong>Total de Estabelecimentos:</strong> ${soma_estabelecimentos}</p><p><strong>Dias de Viagem Estimados:</strong> ${dias_viagem}</p><p><strong>Distância Total Estimada:</strong> ${distancia_total.toFixed(2)} km</p></div>
        <div class="bg-yellow-50 p-4 rounded-lg"><h3 class="font-semibold text-yellow-800 mb-2">Setores Censitários (${viagem.setores.length})</h3><div class="max-h-48 overflow-y-auto custom-scrollbar">${viagem.setores.map(setor => `<div class="border-b border-yellow-200 py-2 last:border-b-0"><p><strong>Código:</strong> ${setor.geocodigo}</p><p><strong>Estabelecimentos:</strong> ${setor.estabelecimentos}</p><p><strong>Distância da Sede:</strong> ${setor.distancia_sede} km</p><p><strong>Trajeto Diário:</strong> ${setor.trajeto_diario} km</p></div>`).join('')}</div></div>
        ${viagem.resultadoCalculado ? `<div class="bg-green-100 p-4 rounded-lg border border-green-300"><h3 class="font-semibold text-green-800 mb-2">✅ Cálculo Realizado</h3><p><strong>Modalidade:</strong> ${viagem.resultadoCalculado.modalidade}</p><p><strong>Custo Total:</strong> R$ ${viagem.resultadoCalculado.custo_total_rs}</p><p><strong>Custo de Combustível:</strong> R$ ${(parseFloat(viagem.resultadoCalculado.custo_combustivel_terrestre_rs) + parseFloat(viagem.resultadoCalculado.custo_combustivel_fluvial_rs)).toFixed(2)}</p><p><strong>Custo de Diárias:</strong> R$ ${viagem.resultadoCalculado.custo_diarias_rs}</p></div>` : `<div class="bg-orange-100 p-4 rounded-lg border border-orange-300"><h3 class="font-semibold text-orange-800 mb-2">⏳ Cálculo Pendente</h3><p class="text-orange-700">Esta viagem ainda não foi calculada. Clique em "Calcular Custos" para realizar a simulação.</p></div>`}
    `;
    viewModalBackdrop.classList.remove('hidden');
    viewModalBackdrop.classList.add('flex');
}

function renderizarTabela() {
    const viagensTableBody = document.getElementById('viagens-table-body');
    const placeholderRow = document.getElementById('placeholder-row');
    viagensTableBody.innerHTML = '';
    if (viagensRegistadas.length === 0) {
        viagensTableBody.appendChild(placeholderRow);
        return;
    }
    viagensRegistadas.forEach((viagem, index) => {
        const row = document.createElement('tr');
        const statusCalculo = viagem.resultadoCalculado ? 'bg-green-100' : '';
        const textoBotaoCalcular = viagem.resultadoCalculado ? 'Recalcular' : 'Calcular';
        const corBotaoCalcular = viagem.resultadoCalculado ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200';
        row.className = statusCalculo;
        row.innerHTML = `<td class="py-2 px-4 border-b text-sm">${index + 1}</td><td class="py-2 px-4 border-b text-sm">${viagem.nomeServidor} (${viagem.siapeServidor})</td><td class="py-2 px-4 border-b text-sm">${viagem.agencia}</td><td class="py-2 px-4 border-b text-sm">${viagem.municipio}</td><td class="py-2 px-4 border-b text-sm">${viagem.setores.length}</td><td class="py-2 px-4 border-b text-sm"><div class="flex space-x-2"><button data-index="${index}" class="calcular-viagem-btn ${corBotaoCalcular} text-xs font-semibold py-1 px-3 rounded-lg transition">${textoBotaoCalcular}</button><button data-index="${index}" class="visualizar-viagem-btn bg-gray-100 text-gray-800 text-xs font-semibold py-1 px-3 rounded-lg hover:bg-gray-200 transition">Verificar</button><button data-index="${index}" class="excluir-viagem-btn bg-red-100 text-red-800 text-xs font-semibold py-1 px-3 rounded-lg hover:bg-red-200 transition">Remover</button></div></td>`;
        viagensTableBody.appendChild(row);
    });
    
    document.querySelectorAll('.calcular-viagem-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const viagem = viagensRegistadas[index];
        if (viagem.resultadoCalculado && !confirm('Esta viagem já foi calculada. Deseja recalcular e sobrescrever o resultado anterior?')) return;
        abrirVistaCalculo(viagem);
    }));
    document.querySelectorAll('.visualizar-viagem-btn').forEach(btn => btn.addEventListener('click', (e) => visualizarViagem(parseInt(e.target.dataset.index))));
    document.querySelectorAll('.excluir-viagem-btn').forEach(btn => btn.addEventListener('click', (e) => excluirViagem(parseInt(e.target.dataset.index))));
}

function atualizarContadorSimulacoes() {
    const count = simulacoesGuardadas.length;
    const terminarBtn = document.getElementById('terminar-btn');
    const simulacoesGuardadasTexto = document.getElementById('simulacoes-guardadas-texto');
    terminarBtn.classList.toggle('disabled-section', count === 0);
    simulacoesGuardadasTexto.classList.toggle('hidden', count === 0);
    simulacoesGuardadasTexto.textContent = `${count} simulação(ões) calculada(s).`;
}

function resetarFormularioCadastro() {
    const nomeServidor = document.getElementById('nome-servidor');
    const siapeServidor = document.getElementById('siape-servidor');
    const cargoServidor = document.getElementById('cargo-servidor');
    const agenciaSelect = document.getElementById('agencia-select');
    nomeServidor.value = '';
    siapeServidor.value = '';
    cargoServidor.value = '';
    agenciaSelect.selectedIndex = 0;
    atualizarMunicipios(agenciaSelect);
}

function abrirVistaCalculo(viagem) {
    viagemAtualParaCalculo = viagem;
    const calculoView = document.getElementById('calculo-view');
    const cadastroView = document.getElementById('cadastro-view');
    const tabCadastro = document.getElementById('tab-cadastro');
    const tabCalculadora = document.getElementById('tab-calculadora');
    const tripDetailsHeader = document.getElementById('trip-details-header');
    const tripSummary = document.getElementById('trip-summary');
    const veiculoOptionsContainerCalc = document.getElementById('veiculo-options-container-calc');
    const custosContainerCalc = document.getElementById('custos-container-calc');
    const resultadoCalculoContainer = document.getElementById('resultado-calculo-container');
    const { nomeServidor, siapeServidor, agencia, municipio, setores } = viagem;
    
    switchTab('calculadora');
    
    tripDetailsHeader.textContent = `${municipio} - ${agencia}`;
    const soma_estabelecimentos = setores.reduce((acc, s) => acc + (Number(s.estabelecimentos) || 0), 0);
    const dias_viagem = Math.ceil(soma_estabelecimentos / 4) || 1;
    const maior_distancia_sede = Math.max(0, ...viagem.setores.map(s => Number(s.distancia_sede) || 0));
    const soma_trajetos_diarios = setores.reduce((acc, s) => acc + (Number(s.trajeto_diario) || 0), 0);
    const distancia_total = (maior_distancia_sede * 2) + (soma_trajetos_diarios * dias_viagem);
    viagemAtualParaCalculo.calculoBase = { soma_estabelecimentos, dias_viagem, distancia_total };
    tripSummary.innerHTML = `<p><strong>Servidor:</strong> ${nomeServidor} (${siapeServidor})</p><p><strong>Nº de Setores:</strong> ${setores.length}</p><p><strong>Total de Estabelecimentos:</strong> ${soma_estabelecimentos}</p><p><strong>Dias de Viagem Calculados:</strong> ${dias_viagem}</p><p><strong>Distância Total Estimada:</strong> ${distancia_total.toFixed(2)} km</p>`;
    
    document.querySelectorAll('input[name="modalidade_calc"]').forEach(radio => radio.checked = false);
    veiculoOptionsContainerCalc.innerHTML = '';
    custosContainerCalc.innerHTML = '';
    resultadoCalculoContainer.classList.add('hidden');
}

function finalizarCalculo(distancia_terrestre = 0, distancia_fluvial = 0, dias_diaria_terrestre = 0, dias_diaria_fluvial = 0) {
    const { id, nomeServidor, siapeServidor, cargoServidor, agencia, municipio, setores } = viagemAtualParaCalculo;
    const { soma_estabelecimentos, dias_viagem, distancia_total } = viagemAtualParaCalculo.calculoBase;
    const modalidade = document.querySelector('input[name="modalidade_calc"]:checked')?.value;
    if (!modalidade) { showToast("Por favor, selecione uma modalidade de transporte.", 'error'); return; }
    let custo_combustivel_terrestre = 0, custo_combustivel_fluvial = 0, custo_diarias = 0;
    let veiculo_terrestre_selecionado = '', motor_fluvial_selecionado = '';
    if (modalidade === 'terrestre' || modalidade === 'misto') {
        const valorGasolina = parseFloat(document.getElementById('valor-gasolina-terrestre')?.value) || 0;
        veiculo_terrestre_selecionado = document.getElementById('veiculo-terrestre-select')?.value || '';
        if (!veiculo_terrestre_selecionado || valorGasolina <= 0) { showToast("Insira veículo e valor de combustível terrestre válidos.", 'error'); return; }
        const consumo_km_l = VEICULOS_TERRESTRES[veiculo_terrestre_selecionado].consumo_km_l;
        const dist = modalidade === 'misto' ? distancia_terrestre : distancia_total;
        custo_combustivel_terrestre = (consumo_km_l > 0 ? dist / consumo_km_l : 0) * valorGasolina;
    }
    if (modalidade === 'fluvial' || modalidade === 'misto') {
        const valorGasolina = parseFloat(document.getElementById('valor-gasolina-fluvial')?.value) || 0;
        motor_fluvial_selecionado = document.getElementById('motor-fluvial-select')?.value || '';
        if (!motor_fluvial_selecionado || valorGasolina <= 0) { showToast("Insira motor e valor de combustível fluvial válidos.", 'error'); return; }
        const motor = MOTORES_FLUVIAIS[motor_fluvial_selecionado];
        const dist = modalidade === 'misto' ? distancia_fluvial : distancia_total;
        const tempo_horas = motor.km_hora > 0 ? dist / motor.km_hora : 0;
        custo_combustivel_fluvial = (tempo_horas * motor.litros_hora) * valorGasolina;
    }
    if (modalidade === 'misto') {
        const valorDiariaT = parseFloat(document.getElementById('valor-diaria-terrestre')?.value) || 0;
        const valorDiariaF = parseFloat(document.getElementById('valor-diaria-fluvial')?.value) || 0;
        custo_diarias = (valorDiariaT * dias_diaria_terrestre) + (valorDiariaF * dias_diaria_fluvial);
    } else {
        const idDiaria = modalidade === 'terrestre' ? 'dias-diaria-terrestre' : 'dias-diaria-fluvial';
        const idValor = modalidade === 'terrestre' ? 'valor-diaria-terrestre' : 'valor-diaria-fluvial';
        const dias = Math.min(parseInt(document.getElementById(idDiaria)?.value) || 0, dias_viagem);
        const valor = parseFloat(document.getElementById(idValor)?.value) || 0;
        dias_diaria_terrestre = modalidade === 'terrestre' ? dias : 0;
        dias_diaria_fluvial = modalidade === 'fluvial' ? dias : 0;
        custo_diarias = valor * dias;
    }
    const resultado = {
        viagem_id: id, "Nº Viagem": viagensRegistadas.findIndex(v => v.id === id) + 1,
        nome_servidor: nomeServidor, siape: siapeServidor, cargo: cargoServidor, agencia, municipio,
        geocodigos_selecionados: `"${setores.map(s => s.geocodigo).join(', ')}"`, soma_estabelecimentos, dias_viagem_calculado: dias_viagem, modalidade,
        veiculo_terrestre: veiculo_terrestre_selecionado, motor_fluvial: motor_fluvial_selecionado,
        distancia_total_km: distancia_total.toFixed(2),
        distancia_terrestre_km: (modalidade !== 'fluvial' ? (modalidade === 'misto' ? distancia_terrestre : distancia_total) : 0).toFixed(2),
        distancia_fluvial_km: (modalidade !== 'terrestre' ? (modalidade === 'misto' ? distancia_fluvial : distancia_total) : 0).toFixed(2),
        dias_com_diaria_terrestre: dias_diaria_terrestre, dias_com_diaria_fluvial: dias_diaria_fluvial,
        custo_diarias_rs: custo_diarias.toFixed(2), custo_combustivel_terrestre_rs: custo_combustivel_terrestre.toFixed(2),
        custo_combustivel_fluvial_rs: custo_combustivel_fluvial.toFixed(2), custo_total_rs: (custo_combustivel_terrestre + custo_combustivel_fluvial + custo_diarias).toFixed(2)
    };
    viagemAtualParaCalculo.resultadoCalculado = resultado;
    const indexSimulacao = simulacoesGuardadas.findIndex(s => s.viagem_id === id);
    if (indexSimulacao > -1) simulacoesGuardadas[indexSimulacao] = resultado;
    else simulacoesGuardadas.push(resultado);
    atualizarContadorSimulacoes();
    renderizarTabela();
    document.getElementById('resultado-calculo-container').classList.remove('hidden');
    renderChart(resultado, 'total');
    showToast("Cálculo finalizado com sucesso!", 'success');
}

function renderChart(data, mode) {
    const ctx = document.getElementById('costs-chart').getContext('2d');
    if (costsChart) costsChart.destroy();
    const custoTotal = parseFloat(data.custo_total_rs);
    let labels, chartData;
    const chartTitle = mode === 'total' ? 'Análise do Custo Total' : 'Análise do Custo Diário Médio';
    const chartTotalBtn = document.getElementById('chart-total-btn');
    const chartDiarioBtn = document.getElementById('chart-diario-btn');
    if (mode === 'total') {
        labels = ['Custo Total', 'Total com -20%', 'Total com +20%'];
        chartData = [custoTotal, custoTotal * 0.8, custoTotal * 1.2];
        chartTotalBtn.classList.replace('bg-gray-200', 'bg-blue-200');
        chartDiarioBtn.classList.replace('bg-blue-200', 'bg-gray-200');
    } else {
        const mediaDiaria = data.dias_viagem_calculado > 0 ? (custoTotal / data.dias_viagem_calculado) : 0;
        labels = ['Custo Diário Médio', 'Diário com -20%', 'Diário com +20%'];
        chartData = [mediaDiaria, mediaDiaria * 0.8, mediaDiaria * 1.2];
        chartDiarioBtn.classList.replace('bg-gray-200', 'bg-blue-200');
        chartTotalBtn.classList.replace('bg-blue-200', 'bg-gray-200');
    }
    costsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Valor em R$',
                data: chartData,
                backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
                borderColor: ['rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => 'R$ ' + value.toFixed(2)
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: chartTitle,
                    font: {
                        size: 16
                    }
                }
            }
        }
    });
}

function updateModalidadeOptionsCalc(event) {
    const modalidade = event.target.value;
    const veiculoOptionsContainerCalc = document.getElementById('veiculo-options-container-calc');
    const custosContainerCalc = document.getElementById('custos-container-calc');
    let veiculoContent = '',
        custosContent = '';
    if (modalidade === 'terrestre' || modalidade === 'misto') {
        veiculoContent += `<div><label for="veiculo-terrestre-select" class="block text-xs font-medium text-gray-600">Veículo Terrestre</label><select id="veiculo-terrestre-select" class="w-full mt-1 p-3 border border-gray-300 rounded-lg">${Object.keys(VEICULOS_TERRESTRES).map(v => `<option value="${v}">${v}</option>`).join('')}</select></div>`;
        custosContent += `<div><label for="valor-gasolina-terrestre" class="block text-xs font-medium text-gray-600">Valor Combustível Terrestre (R$/litro)</label><input type="number" id="valor-gasolina-terrestre" placeholder="Ex: 5.89" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
    }
    if (modalidade === 'fluvial' || modalidade === 'misto') {
        veiculoContent += `<div><label for="motor-fluvial-select" class="block text-xs font-medium text-gray-600">Motor Fluvial</label><select id="motor-fluvial-select" class="w-full mt-1 p-3 border border-gray-300 rounded-lg">${Object.keys(MOTORES_FLUVIAIS).map(m => `<option value="${m}">${m}</option>`).join('')}</select></div>`;
        custosContent += `<div><label for="valor-gasolina-fluvial" class="block text-xs font-medium text-gray-600">Valor Combustível Fluvial (R$/litro)</label><input type="number" id="valor-gasolina-fluvial" placeholder="Ex: 7.50" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
    }
    if (modalidade !== 'misto') {
        const diasMax = viagemAtualParaCalculo.calculoBase.dias_viagem;
        const tipo = modalidade === 'terrestre' ? 'Terrestre' : 'Fluvial';
        custosContent += `<div><label for="valor-diaria-${modalidade}" class="block text-xs font-medium text-gray-600">Valor da Diária ${tipo} (R$)</label><input type="number" id="valor-diaria-${modalidade}" placeholder="Ex: 250.00" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
        custosContent += `<div><label for="dias-diaria-${modalidade}" class="block text-xs font-medium text-gray-600">Nº de Dias com Diária <span class="text-gray-500">(Máx: ${diasMax})</span></label><input type="number" id="dias-diaria-${modalidade}" max="${diasMax}" value="${diasMax}" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
    } else {
        custosContent += `<div><label for="valor-diaria-terrestre" class="block text-xs font-medium text-gray-600">Valor da Diária Terrestre (R$)</label><input type="number" id="valor-diaria-terrestre" placeholder="Ex: 250.00" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
        custosContent += `<div><label for="valor-diaria-fluvial" class="block text-xs font-medium text-gray-600">Valor da Diária Fluvial (R$)</label><input type="number" id="valor-diaria-fluvial" placeholder="Ex: 280.00" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
    }
    veiculoOptionsContainerCalc.innerHTML = veiculoContent;
    custosContainerCalc.innerHTML = custosContent;
}

function descarregarCSV() {
    if (simulacoesGuardadas.length === 0) {
        showToast("Nenhuma simulação para descarregar.", 'info');
        return;
    }
    const csv = Papa.unparse(simulacoesGuardadas.map(({ viagem_id, ...rest }) => rest), {
        delimiter: ';'
    });
    const blob = new Blob(["\uFEFF" + csv], {
        type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `simulacoes_consolidadas_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Download do CSV iniciado!", 'success');
}

function voltarParaLista() {
    switchTab('cadastro');
    viagemAtualParaCalculo = null;
}

function switchTab(tabName) {
    const cadastroView = document.getElementById('cadastro-view');
    const calculoView = document.getElementById('calculo-view');
    const tabCadastro = document.getElementById('tab-cadastro');
    const tabCalculadora = document.getElementById('tab-calculadora');
    if (tabName === 'cadastro') {
        cadastroView.classList.remove('hidden');
        calculoView.classList.add('hidden');
        tabCadastro.classList.replace('border-transparent', 'border-indigo-500');
        tabCadastro.classList.replace('text-gray-500', 'text-indigo-600');
        tabCalculadora.classList.replace('border-indigo-500', 'border-transparent');
        tabCalculadora.classList.replace('text-indigo-600', 'text-gray-500');
    } else {
        cadastroView.classList.add('hidden');
        calculoView.classList.remove('hidden');
        tabCalculadora.classList.replace('border-transparent', 'border-indigo-500');
        tabCalculadora.classList.replace('text-gray-500', 'text-indigo-600');
        tabCadastro.classList.replace('border-indigo-500', 'border-transparent');
        tabCadastro.classList.replace('text-indigo-600', 'text-gray-500');
    }
}

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
    // Variáveis e constantes do DOM
    const mainContent = document.getElementById('main-content');
    const agenciaSelect = document.getElementById('agencia-select');
    const municipioContainer = document.getElementById('municipio-container');
    const municipioSelect = document.getElementById('municipio-select');
    const setoresContainerWrapper = document.getElementById('setores-container-wrapper');
    const geocodigosContainer = document.getElementById('geocodigos-container');
    const adicionarViagemBtn = document.getElementById('adicionar-viagem-btn');
    const viagensTableBody = document.getElementById('viagens-table-body');
    const placeholderRow = document.getElementById('placeholder-row');
    const terminarBtn = document.getElementById('terminar-btn');
    const simulacoesGuardadasTexto = document.getElementById('simulacoes-guardadas-texto');
    const cadastroView = document.getElementById('cadastro-view');
    const calculoView = document.getElementById('calculo-view');
    const voltarBtn = document.getElementById('voltar-btn');
    const tripDetailsHeader = document.getElementById('trip-details-header');
    const tripSummary = document.getElementById('trip-summary');
    const modalidadeContainerCalc = document.getElementById('modalidade-container-calc');
    const veiculoOptionsContainerCalc = document.getElementById('veiculo-options-container-calc');
    const custosContainerCalc = document.getElementById('custos-container-calc');
    const finalizarCalculoBtn = document.getElementById('finalizar-calculo-btn');
    const resultadoCalculoContainer = document.getElementById('resultado-calculo-container');
    const chartTotalBtn = document.getElementById('chart-total-btn');
    const chartDiarioBtn = document.getElementById('chart-diario-btn');
    const mistoModalBackdrop = document.getElementById('misto-modal-backdrop');
    const distanciaTotalMisto = document.getElementById('distancia-total-misto');
    const diasTotaisMisto = document.getElementById('dias-totais-misto');
    const distanciaTerrestreInput = document.getElementById('distancia-terrestre');
    const distanciaFluvialInput = document.getElementById('distancia-fluvial');
    const diasDiariaTerrestreMistoInput = document.getElementById('dias-diaria-terrestre-misto');
    const diasDiariaFluvialMistoInput = document.getElementById('dias-diaria-fluvial-misto');
    const cancelarMistoBtn = document.getElementById('cancelar-misto-btn');
    const confirmarMistoBtn = document.getElementById('confirmar-misto-btn');
    const tabCadastro = document.getElementById('tab-cadastro');
    const tabCalculadora = document.getElementById('tab-calculadora');
    const viewModalBackdrop = document.getElementById('view-modal-backdrop');
    const viewModalContent = document.getElementById('view-modal-content');
    const fecharViewModal = document.getElementById('fechar-view-modal');
    const toastContainer = document.getElementById('toast-container');
    
    Papa.parse("Database.CSV", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            const requiredHeaders = ['agencia', 'municipio', 'geocodigo', 'distancia_sede', 'trajeto_diario', 'estabelecimentos'];
            const actualHeaders = results.meta.fields;
            const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));
            if (results.errors.length > 0 || missingHeaders.length > 0) {
                showToast(`Erro no CSV. Verifique colunas: ${missingHeaders.join(', ')}`, 'error');
                return;
            }
            dadosCompletos = results.data.map((row, index) => ({
                ...row,
                row_id: index,
                geocodigo: String(row.geocodigo || '').trim(),
                distancia_sede: parseFloat(String(row.distancia_sede || '0').replace(',', '.')) || 0,
                trajeto_diario: parseFloat(String(row.trajeto_diario || '0').replace(',', '.')) || 0,
                estabelecimentos: parseInt(row.estabelecimentos, 10) || 0
            }));
            mainContent.classList.remove('disabled-section');
            popularAgencias(agenciaSelect, mainContent);
        },
        error: (err) => {
            showToast(`Erro ao carregar Database: ${err.message}`, 'error');
        }
    });

    // Event Listeners
    //fileInput.addEventListener('change', (e) => handleFileLoad(e));
    agenciaSelect.addEventListener('change', () => atualizarMunicipios(agenciaSelect));
    municipioSelect.addEventListener('change', () => atualizarGeocodigos(municipioSelect));
    adicionarViagemBtn.addEventListener('click', () => adicionarViagem());
    terminarBtn.addEventListener('click', () => descarregarCSV());
    voltarBtn.addEventListener('click', () => voltarParaLista());
    modalidadeContainerCalc.addEventListener('change', (e) => updateModalidadeOptionsCalc(e));
    finalizarCalculoBtn.addEventListener('click', () => {
        const modalidade = document.querySelector('input[name="modalidade_calc"]:checked')?.value;
        if (modalidade === 'misto') {
            const { distancia_total, dias_viagem } = viagemAtualParaCalculo.calculoBase;
            distanciaTotalMisto.textContent = distancia_total.toFixed(2);
            diasTotaisMisto.textContent = dias_viagem;
            distanciaTerrestreInput.value = '';
            distanciaFluvialInput.value = '';
            diasDiariaTerrestreMistoInput.value = '';
            diasDiariaFluvialMistoInput.value = '';
            mistoModalBackdrop.classList.remove('hidden');
            mistoModalBackdrop.classList.add('flex');
        } else {
            finalizarCalculo();
        }
    });
    cancelarMistoBtn.addEventListener('click', () => mistoModalBackdrop.classList.add('hidden'));
    confirmarMistoBtn.addEventListener('click', () => {
        const distT = parseFloat(distanciaTerrestreInput.value) || 0;
        const distF = parseFloat(distanciaFluvialInput.value) || 0;
        const diasT = parseInt(diasDiariaTerrestreMistoInput.value, 10) || 0;
        const diasF = parseInt(diasDiariaFluvialMistoInput.value, 10) || 0;
        const totalDist = parseFloat(viagemAtualParaCalculo.calculoBase.distancia_total);
        const totalDias = viagemAtualParaCalculo.calculoBase.dias_viagem;
        if (Math.abs((distT + distF) - totalDist) > 0.01) {
            showToast('A soma das distâncias deve ser igual à distância total.', 'error');
            return;
        }
        if (diasT > totalDias || diasF > totalDias) {
            showToast(`As diárias não podem exceder o total de dias da viagem (${totalDias}).`, 'error');
            return;
        }
        mistoModalBackdrop.classList.add('hidden');
        finalizarCalculo(distT, distF, diasT, diasF);
    });
    distanciaTerrestreInput.addEventListener('input', (e) => {
        const distT = parseFloat(e.target.value) || 0;
        const total = parseFloat(viagemAtualParaCalculo.calculoBase.distancia_total);
        distanciaFluvialInput.value = Math.max(0, total - distT).toFixed(2);
    });
    distanciaFluvialInput.addEventListener('input', (e) => {
        const distF = parseFloat(e.target.value) || 0;
        const total = parseFloat(viagemAtualParaCalculo.calculoBase.distancia_total);
        distanciaTerrestreInput.value = Math.max(0, total - distF).toFixed(2);
    });
    chartTotalBtn.addEventListener('click', () => renderChart(viagemAtualParaCalculo.resultadoCalculado, 'total'));
    chartDiarioBtn.addEventListener('click', () => renderChart(viagemAtualParaCalculo.resultadoCalculado, 'diario'));
    tabCadastro.addEventListener('click', () => switchTab('cadastro'));
    tabCalculadora.addEventListener('click', () => {
        if (!viagemAtualParaCalculo) {
            showToast("Primeiro, clique em 'Calcular' numa viagem da lista.", 'info');
            return;
        }
        switchTab('calculadora');
    });
    fecharViewModal.addEventListener('click', () => {
        viewModalBackdrop.classList.remove('flex');
        viewModalBackdrop.classList.add('hidden');
    });
});