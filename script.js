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

async function adicionarViagem() {
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
        id: String(Date.now()),
        nomeServidor,
        siapeServidor,
        cargoServidor,
        agencia,
        municipio,
        setores
    };

    try {
        const response = await fetch('http://localhost:3000/viagens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(novaViagem),
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar a viagem na API.');
        }

        const viagemSalva = await response.json();
        viagensRegistadas.push(viagemSalva);
        showToast("Viagem adicionada e salva na API com sucesso!", 'success');
        renderizarTabela();
        resetarFormularioCadastro();

    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    }
}

async function excluirViagem(index) {
    if (confirm('Tem a certeza de que pretende excluir esta viagem?')) {
        const viagemRemovida = viagensRegistadas[index];
        
        try {
            const response = await fetch(`http://localhost:3000/viagens/${viagemRemovida.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir a viagem da API.');
            }

            viagensRegistadas.splice(index, 1);
            const indexSimulacao = simulacoesGuardadas.findIndex(s => s.viagem_id === viagemRemovida.id);
            if (indexSimulacao !== -1) {
                simulacoesGuardadas.splice(indexSimulacao, 1);
            }
            showToast("Viagem removida com sucesso!", 'success');
            renderizarTabela();
            atualizarContadorSimulacoes();

        } catch (error) {
            showToast(`Erro: ${error.message}`, 'error');
        }
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
    if (!viagensTableBody) {
        console.error("Elemento com ID 'viagens-table-body' não encontrado.");
        return;
    }
    viagensTableBody.innerHTML = ''; // Limpa o conteúdo atual

    if (!Array.isArray(viagensRegistadas) || viagensRegistadas.length === 0) {
        const placeholderRow = document.createElement('tr');
        placeholderRow.innerHTML = `
            <td colspan="6" class="text-center py-4 text-gray-500">
                Nenhuma viagem registrada
            </td>
        `;
        viagensTableBody.appendChild(placeholderRow);
        return;
    }

    viagensRegistadas.forEach((viagem, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-2 px-4 border-b text-sm">${index + 1}</td>
            <td class="py-2 px-4 border-b">${viagem.nomeServidor} (${viagem.siapeServidor})</td>
            <td class="py-2 px-4 border-b">${viagem.agencia}</td>
            <td class="py-2 px-4 border-b">${viagem.municipio}</td>
            <td class="py-2 px-4 border-b">${viagem.setores ? viagem.setores.length : 0}</td>
            <td class="py-2 px-4 border-b space-x-2">
                <button class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors" onclick="visualizarViagem(${index})">Ver</button>
                <button class="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 transition-colors" onclick="abrirVistaCalculo(${index})">Calcular</button>
                <button class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors" onclick="excluirViagem(${index})">Excluir</button>
            </td>
        `;
        viagensTableBody.appendChild(row);
    });
}

function renderChart(data, mode) {
    const ctx = document.getElementById('costs-chart').getContext('2d');
    if (costsChart) {
        costsChart.destroy();
    }

    let labels, chartData;
    if (mode === 'total') {
        labels = ['Custo de Combustível', 'Custo de Diárias'];
        const custo_combustivel = parseFloat(data.custo_combustivel_terrestre_rs) + parseFloat(data.custo_combustivel_fluvial_rs);
        chartData = [custo_combustivel.toFixed(2), parseFloat(data.custo_diarias_rs).toFixed(2)];
    } else if (mode === 'diario') {
        const dias_totais = data.dias_com_diaria_terrestre + data.dias_com_diaria_fluvial;
        labels = ['Custo Diário Total'];
        const custo_total = parseFloat(data.custo_total_rs);
        chartData = [dias_totais > 0 ? (custo_total / dias_totais).toFixed(2) : 0];
    }

    costsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Custos da Viagem - ${mode === 'total' ? 'Total' : 'Diário'}`,
                data: chartData,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.5)',
                    'rgba(139, 92, 246, 0.5)'
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(139, 92, 246, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
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

function abrirVistaCalculo(index) {
    const viagem = viagensRegistadas[index];
    viagemAtualParaCalculo = {
        ...viagem,
        index
    };
    switchTab('calculadora');

    const tripDetailsHeader = document.getElementById('trip-details-header');
    const tripSummary = document.getElementById('trip-summary');
    const veiculoOptionsContainerCalc = document.getElementById('veiculo-options-container-calc');
    const custosContainerCalc = document.getElementById('custos-container-calc');
    const resultadoCalculoContainer = document.getElementById('resultado-calculo-container');
    const { nomeServidor, siapeServidor, agencia, municipio, setores } = viagem;

    tripDetailsHeader.textContent = `${municipio} - ${agencia}`;
    const soma_estabelecimentos = setores ? setores.reduce((acc, s) => acc + (Number(s.estabelecimentos) || 0), 0) : 0;
    const dias_viagem = Math.ceil(soma_estabelecimentos / 4) || 1;
    const maior_distancia_sede = Math.max(0, ...(setores || []).map(s => Number(s.distancia_sede) || 0));
    const soma_trajetos_diarios = setores ? setores.reduce((acc, s) => acc + (Number(s.trajeto_diario) || 0), 0) : 0;
    const distancia_total = (maior_distancia_sede * 2) + (soma_trajetos_diarios * dias_viagem);
    viagemAtualParaCalculo.calculoBase = { soma_estabelecimentos, dias_viagem, distancia_total };
    tripSummary.innerHTML = `<p><strong>Servidor:</strong> ${nomeServidor} (${siapeServidor})</p><p><strong>Nº de Setores:</strong> ${setores.length}</p><p><strong>Total de Estabelecimentos:</strong> ${soma_estabelecimentos}</p><p><strong>Dias de Viagem Calculados:</strong> ${dias_viagem}</p><p><strong>Distância Total Estimada:</strong> ${distancia_total.toFixed(2)} km</p>`;

    document.querySelectorAll('input[name="modalidade_calc"]').forEach(radio => radio.checked = false);
    veiculoOptionsContainerCalc.innerHTML = '';
    custosContainerCalc.innerHTML = '';
    resultadoCalculoContainer.classList.add('hidden');
}

async function finalizarCalculo(distancia_terrestre = 0, distancia_fluvial = 0, dias_diaria_terrestre = 0, dias_diaria_fluvial = 0) {
    if (!viagemAtualParaCalculo || !viagemAtualParaCalculo.calculoBase) {
        showToast("Por favor, selecione uma viagem e abra a calculadora antes de finalizar.", 'error');
        return;
    }

    const { id, nomeServidor, siapeServidor, cargoServidor, agencia, municipio, setores } = viagensRegistadas[viagemAtualParaCalculo.index];
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
        viagem_id: id, "Nº Viagem": viagemAtualParaCalculo.index + 1,
        nome_servidor: nomeServidor, siape: siapeServidor, cargo: cargoServidor, agencia, municipio,
        geocodigos_selecionados: `"${(setores || []).map(s => s.geocodigo).join(', ')}"`, soma_estabelecimentos, dias_viagem_calculado: dias_viagem, modalidade,
        veiculo_terrestre: veiculo_terrestre_selecionado, motor_fluvial: motor_fluvial_selecionado,
        distancia_total_km: distancia_total.toFixed(2),
        distancia_terrestre_km: (modalidade !== 'fluvial' ? (modalidade === 'misto' ? distancia_terrestre : distancia_total) : 0).toFixed(2),
        distancia_fluvial_km: (modalidade !== 'terrestre' ? (modalidade === 'misto' ? distancia_fluvial : distancia_total) : 0).toFixed(2),
        dias_com_diaria_terrestre: dias_diaria_terrestre, dias_com_diaria_fluvial: dias_diaria_fluvial,
        custo_diarias_rs: custo_diarias.toFixed(2), custo_combustivel_terrestre_rs: custo_combustivel_terrestre.toFixed(2),
        custo_combustivel_fluvial_rs: custo_combustivel_fluvial.toFixed(2), custo_total_rs: (custo_combustivel_terrestre + custo_combustivel_fluvial + custo_diarias).toFixed(2)
    };

    try {
        const response = await fetch(`http://localhost:3000/viagens/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...viagensRegistadas[viagemAtualParaCalculo.index], resultadoCalculado: resultado }),
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar o cálculo na API.');
        }

        
        const indexSimulacao = simulacoesGuardadas.findIndex(s => s.viagem_id === id);
        if (indexSimulacao > -1) {
            simulacoesGuardadas[indexSimulacao] = resultado;
        } else {
            simulacoesGuardadas.push(resultado);
        }

        viagensRegistadas[viagemAtualParaCalculo.index].resultadoCalculado = resultado;
        
        atualizarContadorSimulacoes();
        
        document.getElementById('resultado-calculo-container').classList.remove('hidden');
        renderChart(resultado, 'total');
        showToast("Cálculo finalizado com sucesso!", 'success');
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    }
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
        renderizarTabela(); // A tabela só é atualizada ao voltar para a aba de cadastro
    } else {
        cadastroView.classList.add('hidden');
        calculoView.classList.remove('hidden');
        tabCalculadora.classList.replace('border-transparent', 'border-indigo-500');
        tabCalculadora.classList.replace('text-gray-500', 'text-indigo-600');
        tabCadastro.classList.replace('border-indigo-500', 'border-transparent');
        tabCadastro.classList.replace('text-indigo-600', 'text-gray-500');
    }
}

async function carregarViagens() {
    try {
        const response = await fetch('http://localhost:3000/viagens');
        if (!response.ok) {
            throw new Error("Erro ao carregar viagens da API.");
        }
        viagensRegistadas = await response.json();

        // Limpa a lista de simulações antes de carregar
        simulacoesGuardadas = [];
        
        // Adiciona as simulações guardadas à lista
        viagensRegistadas.forEach(viagem => {
            if (viagem.resultadoCalculado) {
                simulacoesGuardadas.push(viagem.resultadoCalculado);
            }
        });
        
        renderizarTabela();
        atualizarContadorSimulacoes(); // Atualiza o contador e habilita o botão de download
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
        console.error("Erro ao carregar os dados:", error);
    }
}

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados das agências do CSV
    Papa.parse("Database.CSV", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
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
                agencia: String(row.agencia || '').trim(),
                municipio: String(row.municipio || '').trim(),
                geocodigo: String(row.geocodigo || '').trim(),
                distancia_sede: parseFloat(String(row.distancia_sede || '0').replace(',', '.')) || 0,
                trajeto_diario: parseFloat(String(row.trajeto_diario || '0').replace(',', '.')) || 0,
                estabelecimentos: parseInt(row.estabelecimentos, 10) || 0
            }));
            document.getElementById('main-content').classList.remove('disabled-section');
            popularAgencias(document.getElementById('agencia-select'));
            
            // Chama a função para carregar as viagens, que já chama renderizarTabela()
            await carregarViagens();
        },
        error: (err) => {
            showToast(`Erro ao carregar Database: ${err.message}`, 'error');
        }
    });

    // Event Listeners
    document.getElementById('agencia-select').addEventListener('change', (e) => atualizarMunicipios(e.target));
    document.getElementById('municipio-select').addEventListener('change', (e) => atualizarGeocodigos(e.target));
    document.getElementById('adicionar-viagem-btn').addEventListener('click', () => adicionarViagem());
    document.getElementById('terminar-btn').addEventListener('click', () => descarregarCSV());
    document.getElementById('voltar-btn').addEventListener('click', () => voltarParaLista());
    document.getElementById('modalidade-container-calc').addEventListener('change', (e) => updateModalidadeOptionsCalc(e));

    document.getElementById('finalizar-calculo-btn').addEventListener('click', async (event) => {
    event.preventDefault();
    const modalidade = document.querySelector('input[name="modalidade_calc"]:checked')?.value;
    if (modalidade === 'misto') {
         document.getElementById('distancia-total-misto').textContent = distancia_total.toFixed(2);
        document.getElementById('dias-totais-misto').textContent = dias_viagem;
        document.getElementById('distancia-terrestre').value = '';
        document.getElementById('distancia-fluvial').value = '';
        document.getElementById('dias-diaria-terrestre-misto').value = '';
        document.getElementById('dias-diaria-fluvial-misto').value = '';
        document.getElementById('misto-modal-backdrop').classList.remove('hidden');
        document.getElementById('misto-modal-backdrop').classList.add('flex');
    } else {
        await finalizarCalculo();
        switchTab('calculadora');
    }
});
    document.getElementById('cancelar-misto-btn').addEventListener('click', () => document.getElementById('misto-modal-backdrop').classList.add('hidden'));
    document.getElementById('confirmar-misto-btn').addEventListener('click', () => {
        const distT = parseFloat(document.getElementById('distancia-terrestre').value) || 0;
        const distF = parseFloat(document.getElementById('distancia-fluvial').value) || 0;
        const diasT = parseInt(document.getElementById('dias-diaria-terrestre-misto').value, 10) || 0;
        const diasF = parseInt(document.getElementById('dias-diaria-fluvial-misto').value, 10) || 0;
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
        document.getElementById('misto-modal-backdrop').classList.add('hidden');
        finalizarCalculo(distT, distF, diasT, diasF);
    });
    document.getElementById('distancia-terrestre').addEventListener('input', (e) => {
        const distT = parseFloat(e.target.value) || 0;
        const total = parseFloat(viagemAtualParaCalculo.calculoBase.distancia_total);
        document.getElementById('distancia-fluvial').value = Math.max(0, total - distT).toFixed(2);
    });
    document.getElementById('distancia-fluvial').addEventListener('input', (e) => {
        const distF = parseFloat(e.target.value) || 0;
        const total = parseFloat(viagemAtualParaCalculo.calculoBase.distancia_total);
        document.getElementById('distancia-terrestre').value = Math.max(0, total - distF).toFixed(2);
    });
    document.getElementById('chart-total-btn').addEventListener('click', () => renderChart(viagemAtualParaCalculo.resultadoCalculado, 'total'));
    document.getElementById('chart-diario-btn').addEventListener('click', () => renderChart(viagemAtualParaCalculo.resultadoCalculado, 'diario'));
    document.getElementById('tab-cadastro').addEventListener('click', () => switchTab('cadastro'));
    document.getElementById('tab-calculadora').addEventListener('click', () => {
        console.log("Botão 'Finalizar Cálculo' clicado.");
        if (!viagemAtualParaCalculo) {
            showToast("Primeiro, clique em 'Calcular' numa viagem da lista.", 'info');
            return;
        }
        switchTab('calculadora');
    });
    document.getElementById('fechar-view-modal').addEventListener('click', () => {
        document.getElementById('view-modal-backdrop').classList.remove('flex');
        document.getElementById('view-modal-backdrop').classList.add('hidden');
    });
});