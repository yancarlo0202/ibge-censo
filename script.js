// Variáveis e Constantes
const VEICULOS_TERRESTRES = { '4x4': { consumo_km_l: 10 }, 'Carro': { consumo_km_l: 12 }, 'Moto': { consumo_km_l: 32 } };
const MOTORES_FLUVIAIS = { '13 HP': { litros_hora: 5, km_hora: 20 }, '15 HP': { litros_hora: 5, km_hora: 20 }, '25 HP': { litros_hora: 10, km_hora: 30 }, '40 HP': { litros_hora: 25, km_hora: 40 }, '60 HP': { litros_hora: 30, km_hora: 45 }, '90 HP': { litros_hora: 40, km_hora: 45 }, '115 HP': { litros_hora: 45, km_hora: 50 }, '150 HP': { litros_hora: 55, km_hora: 50 }, '200 HP': { litros_hora: 75, km_hora: 60 }, '250 HP': { litros_hora: 90, km_hora: 65 } };
let dadosCompletos = [];
let viagensRegistadas = [];
let simulacoesGuardadas = [];
let viagemAtualParaCalculo = null;
let costsChart = null;
let servidorLogado = null;
const SERVIDOR_LOGADO_KEY = 'ibge_servidor_logado';

// Função auxiliar para formatação monetária brasileira
function formatarMoeda(valor) {
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

function handleLogin() {
    const nomeServidor = document.getElementById('nome-servidor').value;
    const siapeServidor = document.getElementById('siape-servidor').value;
    const cargoServidor = document.getElementById('cargo-servidor').value;

    if (!nomeServidor || !siapeServidor || !cargoServidor) {
        showToast("Preencha todos os campos do servidor para acessar.", 'error');
        return;
    }

    servidorLogado = { nomeServidor, siapeServidor: String(siapeServidor), cargoServidor };
    sessionStorage.setItem(SERVIDOR_LOGADO_KEY, JSON.stringify(servidorLogado));

    showToast(`Bem-vindo(a), ${nomeServidor}!`, 'success');
    switchTab('cadastro');
    carregarViagens();
}

function handleLogoff() {
    if (confirm("Deseja realmente sair? Todas as simulações não salvas serão perdidas.")) {
        sessionStorage.removeItem(SERVIDOR_LOGADO_KEY);
        servidorLogado = null;
        viagensRegistadas = [];
        simulacoesGuardadas = [];
        viagemAtualParaCalculo = null;

        showToast("Sessão encerrada.", 'info');
        switchTab('login');
    }
}

function checkLoginState() {
    const savedState = sessionStorage.getItem(SERVIDOR_LOGADO_KEY);
    if (savedState) {
        try {
            servidorLogado = JSON.parse(savedState);
            return true;
        } catch (e) {
            console.error("Erro ao carregar estado do login:", e);
            sessionStorage.removeItem(SERVIDOR_LOGADO_KEY);
            return false;
        }
    }
    return false;
}

async function adicionarViagem() {
    if (!servidorLogado) {
        showToast("Você precisa logar primeiro.", 'error');
        return;
    }
    const { nomeServidor, siapeServidor, cargoServidor } = servidorLogado;

    const agencia = document.getElementById('agencia-select').value;
    const municipio = document.getElementById('municipio-select').value;
    const selectedIds = Array.from(document.querySelectorAll('#geocodigos-container input:checked')).map(cb => parseInt(cb.value, 10));

    if (!agencia || !municipio || selectedIds.length === 0) {
        showToast("Preencha todos os campos da viagem e selecione setores censitários.", 'error');
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaViagem),
        });

        if (!response.ok) throw new Error('Erro ao salvar a viagem na API.');

        const viagemSalva = await response.json();
        viagensRegistadas.push(viagemSalva);
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

            if (!response.ok) throw new Error('Erro ao excluir a viagem da API.');

            viagensRegistadas.splice(index, 1);
            const indexSimulacao = simulacoesGuardadas.findIndex(s => s.viagem_id === viagemRemovida.id);
            if (indexSimulacao !== -1) {
                simulacoesGuardadas.splice(indexSimulacao, 1);
            }
            renderizarTabela();
            atualizarContadorSimulacoes();

        } catch (error) {
            showToast(`Erro: ${error.message}`, 'error');
        }
    }
}

function visualizarViagem(index) {
    const viagem = viagensRegistadas[index];
    if (!viagem) return;

    // IDs CORRIGIDOS PARA CASAR COM O index.html
    const modalVisualizar = document.getElementById('view-modal-backdrop');
    const detalhesViagem = document.getElementById('view-modal-content');

    // Cálculos de base para exibição
    const soma_estabelecimentos = (viagem.setores || []).reduce((acc, s) => acc + (Number(s.estabelecimentos) || 0), 0);
    const dias_viagem = Math.ceil(soma_estabelecimentos / 4) || 1;

    // Cálculo das distâncias usando os nomes de colunas corretos do CSV
    const dist_terr_total = (viagem.setores || []).reduce((acc, s) => acc + (Number(s.dist_sede_terr || 0) * 2) + (Number(s.trajeto_dia_terr || 0) * dias_viagem), 0);
    const dist_fluv_total = (viagem.setores || []).reduce((acc, s) => acc + (Number(s.dist_sede_fluv || 0) * 2) + (Number(s.trajeto_dia_fluv || 0) * dias_viagem), 0);
    const distancia_total = dist_terr_total + dist_fluv_total;

    let secaoCalculo = `
        <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <p class="text-yellow-700">⚠️ Nenhum cálculo foi finalizado para esta viagem ainda.</p>
        </div>`;

    if (viagem.resultadoCalculado) {
        const res = viagem.resultadoCalculado;
        const modBaixa = (res.modalidade || '').toLowerCase();
        let detalhesCustos = '';

        if (modBaixa === 'misto') {
            const custoTerrestreTotal = parseFloat(res.custo_combustivel_terrestre_rs || 0) + (parseFloat(res.custo_diarias_rs || 0) / 2);
            const custoFluvialTotal = parseFloat(res.custo_combustivel_fluvial_rs || 0) + (parseFloat(res.custo_diarias_rs || 0) / 2);

            detalhesCustos = `
                <p><strong>Custo Terrestre (Gasolina + Diárias):</strong> R$ ${formatarMoeda(custoTerrestreTotal)}</p>
                <p><strong>Custo Fluvial (Gasolina + Diárias):</strong> R$ ${formatarMoeda(custoFluvialTotal)}</p>
                <p class="text-indigo-700 font-bold border-t pt-2 mt-1"><strong>Total Geral:</strong> R$ ${formatarMoeda(res.custo_total_rs)}</p>
            `;
        } else {
            const gasolina = modBaixa === 'terrestre' ? res.custo_combustivel_terrestre_rs : res.custo_combustivel_fluvial_rs;
            detalhesCustos = `
                <p><strong>Custo Gasolina:</strong> R$ ${formatarMoeda(gasolina)}</p>
                <p><strong>Custo Diárias:</strong> R$ ${formatarMoeda(res.custo_diarias_rs)}</p>
                <p class="text-indigo-700 font-bold border-t border-green-200 pt-2 mt-1">
                    <strong>Custo Total:</strong> R$ ${formatarMoeda(res.custo_total_rs)}
                </p>
            `;
        }

        secaoCalculo = `
            <div class="bg-green-100 p-4 rounded-lg border border-green-300">
                <h3 class="font-semibold text-green-800 mb-2">✅ Cálculo Realizado (${res.modalidade.toUpperCase()})</h3>
                <div class="grid grid-cols-1 gap-2 mt-2 border-t border-green-200 pt-2">
                    ${detalhesCustos}
                </div>
            </div>`;
    }

    detalhesViagem.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-50 p-3 rounded shadow-sm">
                    <h3 class="font-bold text-indigo-600 border-b mb-2">Informações do Servidor</h3>
                    <p><strong>Nome:</strong> ${viagem.nomeServidor}</p>
                    <p><strong>SIAPE:</strong> ${viagem.siapeServidor}</p>
                    <p><strong>Cargo:</strong> ${viagem.cargoServidor}</p>
                </div>
                <div class="bg-gray-50 p-3 rounded shadow-sm">
                    <h3 class="font-bold text-indigo-600 border-b mb-2">Localização</h3>
                    <p><strong>Agência:</strong> ${viagem.agencia}</p>
                    <p><strong>Município:</strong> ${viagem.municipio}</p>
                </div>
            </div>
            
            <div class="bg-indigo-50 p-3 rounded shadow-sm">
                <h3 class="font-bold text-indigo-600 border-b mb-2">Resumo do Percurso</h3>
                <p><strong>Setores Selecionados:</strong> ${viagem.setores.length}</p>
                <p><strong>Distância Terrestre:</strong> ${dist_terr_total.toFixed(2).replace('.', ',')} km</p>
                <p><strong>Distância Fluvial:</strong> ${dist_fluv_total.toFixed(2).replace('.', ',')} km</p>
                <p><strong>Dias Estimados:</strong> ${dias_viagem}</p>
            </div>

            ${secaoCalculo}

            <div>
                <h3 class="font-bold text-indigo-600 mb-2">Setores da Viagem</h3>
                <div class="max-h-40 overflow-y-auto border rounded p-2 bg-white">
                    <ul class="list-disc pl-5 text-sm space-y-1">
                        ${viagem.setores.map(s => `<li>Setor: ${s.geocodigo}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;

    modalVisualizar.classList.remove('hidden');
    modalVisualizar.classList.add('flex');
}

function renderizarTabela() {
    const viagensTableBody = document.getElementById('viagens-table-body');
    if (!viagensTableBody) return;
    viagensTableBody.innerHTML = '';

    if (!Array.isArray(viagensRegistadas) || viagensRegistadas.length === 0) {
        viagensTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">Nenhuma viagem registrada</td></tr>`;
        return;
    }

    viagensRegistadas.forEach((viagem, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-2 px-4 border-b text-sm">${index + 1}</td>
            <td class="py-2 px-4 border-b">${viagem.nomeServidor} (${viagem.siapeServidor})</td>
            <td class="py-2 px-4 border-b">${viagem.cargoServidor}</td> <td class="py-2 px-4 border-b">${viagem.agencia}</td>
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

function atualizarContadorSimulacoes() {
    const count = simulacoesGuardadas.length;
    const terminarBtn = document.getElementById('terminar-btn');
    const simulacoesGuardadasTexto = document.getElementById('simulacoes-guardadas-texto');
    terminarBtn.classList.toggle('disabled-section', count === 0);
    simulacoesGuardadasTexto.classList.toggle('hidden', count === 0);
    simulacoesGuardadasTexto.textContent = `${count} simulação(ões) calculada(s).`;
}

function resetarFormularioCadastro() {
    const agenciaSelect = document.getElementById('agencia-select');
    agenciaSelect.selectedIndex = 0;
    atualizarMunicipios(agenciaSelect);
}

function abrirVistaCalculo(index) {
    const viagem = viagensRegistadas[index];
    viagemAtualParaCalculo = { ...viagem, index };
    
    // Referências do DOM
    const tripDetailsHeader = document.getElementById('trip-details-header');
    const tripSummary = document.getElementById('trip-summary');
    const { agencia, municipio, setores } = viagem;

    // Muda para a aba de cálculo
    switchTab('calculadora');

    tripDetailsHeader.textContent = `${municipio} - ${agencia}`;
    
    // Cálculo de base
    const soma_estabelecimentos = setores.reduce((acc, s) => acc + (Number(s.estabelecimentos) || 0), 0);
    const dias_viagem = Math.ceil(soma_estabelecimentos / 4) || 1;

    // Cálculo da distância baseado no trajeto real do CSV
    // Dentro de abrirVistaCalculo(index)
    const dist_terr_total = setores.reduce((acc, s) => acc + (Number(s.dist_sede_terr || 0) * 2) + (Number(s.trajeto_dia_terr || 0) * dias_viagem), 0);
    const dist_fluv_total = setores.reduce((acc, s) => acc + (Number(s.dist_sede_fluv || 0) * 2) + (Number(s.trajeto_dia_fluv || 0) * dias_viagem), 0);
    const distancia_total = dist_terr_total + dist_fluv_total;

    viagemAtualParaCalculo.calculoBase = {
        soma_estabelecimentos,
        dias_viagem,
        distancia_total,
        dist_terr_total,
        dist_fluv_total
    };

    // Identificação do Modal predominante
    const modaisNoSetor = [...new Set(setores.map(s => (s.modal || 'TERRESTRE').toUpperCase()))];
    let modalIdentificado = 'terrestre';
    if (modaisNoSetor.length > 1 || modaisNoSetor.includes('MISTO')) {
        modalIdentificado = 'misto';
    } else if (modaisNoSetor.includes('FLUVIAL')) {
        modalIdentificado = 'fluvial';
    }

    // Atualização da Interface
    tripSummary.innerHTML = `
        <p><strong>Modal Identificado:</strong> <span class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded">${modalIdentificado.toUpperCase()}</span></p>
        <p><strong>Nº de Setores:</strong> ${setores.length}</p>
        <p><strong>Total de Estabelecimentos:</strong> ${soma_estabelecimentos}</p>
        <p><strong>Dias de Viagem Estimados:</strong> ${dias_viagem}</p>
        <p><strong>Distância Total:</strong> ${distancia_total.toFixed(2).replace('.', ',')} km</p>
    `;

    // Seleção automática e carregamento dos campos de custo
    const radioInput = document.querySelector(`input[name="modalidade_calc"][value="${modalIdentificado}"]`);
    if (radioInput) {
        radioInput.checked = true;
        forcarUpdateCampos(modalIdentificado);
    }
}

// Função auxiliar para carregar os campos sem depender de um evento de clique
function forcarUpdateCampos(modalidade) {
    const fakeEvent = { target: { value: modalidade } };
    updateModalidadeOptionsCalc(fakeEvent);
}

async function finalizarCalculo() {
    if (!viagemAtualParaCalculo || !viagemAtualParaCalculo.calculoBase) {
        showToast("Selecione uma viagem antes de finalizar.", 'error');
        return;
    }

    // 1. Recuperar os dados da viagem e do servidor
    const viagem = viagensRegistadas[viagemAtualParaCalculo.index];
    const { id, nomeServidor, siapeServidor, cargoServidor, agencia, municipio, setores } = viagem;
    const { soma_estabelecimentos, dias_viagem, dist_terr_total, dist_fluv_total, distancia_total } = viagemAtualParaCalculo.calculoBase;

    // 2. Identificar a modalidade selecionada (rádio oculto)
    const modalidadeInput = document.querySelector('input[name="modalidade_calc"]:checked');
    if (!modalidadeInput) {
        showToast("Modalidade não identificada.", 'error');
        return;
    }
    const modalidade = modalidadeInput.value;

    // 3. Capturar valores de custo da interface
    const valorCombustivel = parseFloat(document.getElementById('valor-combustivel-unico')?.value) || 0;
    if (valorCombustivel <= 0) {
        showToast("Insira o valor do combustível.", 'error');
        return;
    }

    let custo_combustivel_terrestre = 0;
    let custo_combustivel_fluvial = 0;
    let custo_diarias = 0;
    let veiculo_terrestre_selecionado = '';
    let motor_fluvial_selecionado = '';
    let dist_terr_final = 0;
    let dist_fluv_final = 0;

    // 4. Lógica de Cálculo por Modalidade
    if (modalidade === 'terrestre') {
        veiculo_terrestre_selecionado = document.getElementById('veiculo-terrestre-select')?.value || '';
        const consumo = VEICULOS_TERRESTRES[veiculo_terrestre_selecionado]?.consumo_km_l || 1;
        dist_terr_final = dist_terr_total;
        custo_combustivel_terrestre = (dist_terr_final / consumo) * valorCombustivel;
        
        const valorDiaria = parseFloat(document.getElementById('valor-diaria-terrestre')?.value) || 0;
        const numDias = parseInt(document.getElementById('dias-diaria-terrestre')?.value) || 0;
        custo_diarias = valorDiaria * numDias;

    } else if (modalidade === 'fluvial') {
        motor_fluvial_selecionado = document.getElementById('motor-fluvial-select')?.value || '';
        const motor = MOTORES_FLUVIAIS[motor_fluvial_selecionado];
        dist_fluv_final = dist_fluv_total;
        const tempo_horas = motor ? dist_fluv_final / motor.km_hora : 0;
        custo_combustivel_fluvial = (tempo_horas * (motor?.litros_hora || 0)) * valorCombustivel;
        
        const valorDiaria = parseFloat(document.getElementById('valor-diaria-fluvial')?.value) || 0;
        const numDias = parseInt(document.getElementById('dias-diaria-fluvial')?.value) || 0;
        custo_diarias = valorDiaria * numDias;

    } else if (modalidade === 'misto') {
        dist_terr_final = dist_terr_total;
        dist_fluv_final = dist_fluv_total;
        
        veiculo_terrestre_selecionado = document.getElementById('veiculo-terrestre-select')?.value || '';
        motor_fluvial_selecionado = document.getElementById('motor-fluvial-select')?.value || '';

        const consumoT = VEICULOS_TERRESTRES[veiculo_terrestre_selecionado]?.consumo_km_l || 1;
        custo_combustivel_terrestre = (dist_terr_final / consumoT) * valorCombustivel;

        const motorF = MOTORES_FLUVIAIS[motor_fluvial_selecionado];
        const tempo_horas = motorF ? dist_fluv_final / motorF.km_hora : 0;
        custo_combustivel_fluvial = (tempo_horas * (motorF?.litros_hora || 0)) * valorCombustivel;

        const valorDiariaT = parseFloat(document.getElementById('valor-diaria-terrestre')?.value) || 0;
        const valorDiariaF = parseFloat(document.getElementById('valor-diaria-fluvial')?.value) || 0;
        // Divisão de diárias (pode ser ajustada conforme necessidade)
        custo_diarias = (valorDiariaT * (dias_viagem / 2)) + (valorDiariaF * (dias_viagem / 2));
    }

    const custoTotal = custo_combustivel_terrestre + custo_combustivel_fluvial + custo_diarias;

    // 5. Montar o objeto de resultado
    const resultado = {
        viagem_id: id,
        "Nº Viagem": viagemAtualParaCalculo.index + 1,
        nome_servidor: nomeServidor, 
        siape: siapeServidor, 
        cargo: cargoServidor, 
        agencia, 
        municipio,
        geocodigos_selecionados: (setores || []).map(s => s.geocodigo).join(', '),
        soma_estabelecimentos, 
        dias_viagem_calculado: dias_viagem, 
        modalidade,
        veiculo_terrestre: veiculo_terrestre_selecionado, 
        motor_fluvial: motor_fluvial_selecionado,
        distancia_total_km: distancia_total.toFixed(2),
        distancia_terrestre_km: dist_terr_final.toFixed(2),
        distancia_fluvial_km: dist_fluv_final.toFixed(2),
        custo_diarias_rs: custo_diarias.toFixed(2),
        custo_combustivel_terrestre_rs: custo_combustivel_terrestre.toFixed(2),
        custo_combustivel_fluvial_rs: custo_combustivel_fluvial.toFixed(2),
        custo_total_rs: custoTotal.toFixed(2)
    };

    // 6. Salvar na API e atualizar estado local
    try {
        const response = await fetch(`http://localhost:3000/viagens/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...viagem, resultadoCalculado: resultado }),
        });
        if (!response.ok) throw new Error('Erro ao salvar o cálculo no servidor.');

        viagensRegistadas[viagemAtualParaCalculo.index].resultadoCalculado = resultado;
        const idx = simulacoesGuardadas.findIndex(s => s.viagem_id === id);
        if (idx !== -1) {
            simulacoesGuardadas[idx] = resultado;
        } else {
            simulacoesGuardadas.push(resultado);
        }

        atualizarContadorSimulacoes();
        showToast("Cálculo finalizado com sucesso!", 'success');
        voltarParaLista();
    } catch (error) { 
        showToast(`Erro ao finalizar: ${error.message}`, 'error'); 
    }
}

function updateModalidadeOptionsCalc(event) {
    const modalidade = event.target.value;
    const veiculoOptionsContainerCalc = document.getElementById('veiculo-options-container-calc');
    const custosContainerCalc = document.getElementById('custos-container-calc');
    let veiculoContent = '', custosContent = '';

    const combustivelHTML = `<div><label for="valor-combustivel-unico" class="block text-xs font-medium text-gray-600">Valor Combustível (R$/litro)</label><input type="number" id="valor-combustivel-unico" placeholder="Ex: 5,90" step="0.01" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;

    if (modalidade === 'terrestre' || modalidade === 'misto') {
        veiculoContent += `<div><label for="veiculo-terrestre-select" class="block text-xs font-medium text-gray-600">Veículo Terrestre</label><select id="veiculo-terrestre-select" class="w-full mt-1 p-3 border border-gray-300 rounded-lg">${Object.keys(VEICULOS_TERRESTRES).map(v => `<option value="${v}">${v}</option>`).join('')}</select></div>`;
    }
    if (modalidade === 'fluvial' || modalidade === 'misto') {
        veiculoContent += `<div><label for="motor-fluvial-select" class="block text-xs font-medium text-gray-600">Motor Fluvial</label><select id="motor-fluvial-select" class="w-full mt-1 p-3 border border-gray-300 rounded-lg">${Object.keys(MOTORES_FLUVIAIS).map(m => `<option value="${m}">${m}</option>`).join('')}</select></div>`;
    }

    custosContent += combustivelHTML;

    if (modalidade !== 'misto') {
        const diasMax = viagemAtualParaCalculo.calculoBase.dias_viagem;
        const tipo = modalidade === 'terrestre' ? 'Terrestre' : 'Fluvial';
        custosContent += `<div><label for="valor-diaria-${modalidade}" class="block text-xs font-medium text-gray-600">Valor da Diária ${tipo} (R$)</label><input type="number" id="valor-diaria-${modalidade}" placeholder="Ex: 250,00" step="0.01" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
        custosContent += `<div><label for="dias-diaria-${modalidade}" class="block text-xs font-medium text-gray-600">Nº de Dias com Diária (Máx: ${diasMax})</label><input type="number" id="dias-diaria-${modalidade}" max="${diasMax}" value="${diasMax}" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
    } else {
        custosContent += `<div><label for="valor-diaria-terrestre" class="block text-xs font-medium text-gray-600">Valor da Diária Terrestre (R$)</label><input type="number" id="valor-diaria-terrestre" placeholder="Ex: 250,00" step="0.01" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
        custosContent += `<div><label for="valor-diaria-fluvial" class="block text-xs font-medium text-gray-600">Valor da Diária Fluvial (R$)</label><input type="number" id="valor-diaria-fluvial" placeholder="Ex: 280,00" step="0.01" class="w-full mt-1 p-3 border border-gray-300 rounded-lg"></div>`;
    }
    veiculoOptionsContainerCalc.innerHTML = veiculoContent;
    custosContainerCalc.innerHTML = custosContent;
}

function descarregarCSV() {
    if (simulacoesGuardadas.length === 0) { showToast("Nenhuma simulação para descarregar.", 'info'); return; }
    const csv = Papa.unparse(simulacoesGuardadas.map(({ viagem_id, ...rest }) => rest), { delimiter: ';' });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `simulacoes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function voltarParaLista() { switchTab('cadastro'); viagemAtualParaCalculo = null; }

function switchTab(tabName) {
    const loginView = document.getElementById('login-view');
    const cadastroView = document.getElementById('cadastro-view');
    const calculoView = document.getElementById('calculo-view');
    const navTabsContainer = document.getElementById('nav-tabs-container');

    loginView.classList.add('hidden');
    cadastroView.classList.add('hidden');
    calculoView.classList.add('hidden');
    navTabsContainer.classList.add('hidden');

    if (tabName === 'login') { loginView.classList.remove('hidden'); return; }
    navTabsContainer.classList.remove('hidden');

    if (tabName === 'cadastro') {
        cadastroView.classList.remove('hidden');
        renderizarTabela();
    } else if (tabName === 'calculadora') {
        calculoView.classList.remove('hidden');
    }
}

async function carregarViagens() {
    if (!servidorLogado) return;
    try {
        const response = await fetch(`http://localhost:3000/viagens?siapeServidor=${servidorLogado.siapeServidor}`);
        if (!response.ok) throw new Error("Erro ao carregar dados.");
        viagensRegistadas = await response.json();
        simulacoesGuardadas = viagensRegistadas.filter(v => v.resultadoCalculado).map(v => v.resultadoCalculado);
        renderizarTabela();
        atualizarContadorSimulacoes();
    } catch (error) { showToast(`Erro: ${error.message}`, 'error'); }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkLoginState()) { switchTab('login'); } else { switchTab('cadastro'); await carregarViagens(); }

    // No evento DOMContentLoaded, dentro do Papa.parse:
    // script.js - Localize o Papa.parse e atualize o mapeamento das colunas
    // Localize o Papa.parse e substitua o mapeamento das colunas
    Papa.parse("Database.CSV", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            dadosCompletos = results.data.map((row, index) => {
                const parseNum = (val) => parseFloat(String(val || '0').replace(',', '.')) || 0;

                return {
                    ...row,
                    row_id: index,
                    modal: row.modal ? row.modal.toUpperCase() : 'TERRESTRE',
                    // Mapeamos os trajetos específicos do CSV
                    dist_sede_terr: parseNum(row.deslocamento_terrestre_km),
                    trajeto_dia_terr: parseNum(row.percurso_terrestre_km),
                    dist_sede_fluv: parseNum(row.deslocamento_fluvial_km),
                    trajeto_dia_fluv: parseNum(row.percurso_fluvial_km),
                    estabelecimentos: parseInt(row.num_estab, 10) || 0
                };
            });
            document.getElementById('main-content').classList.remove('disabled-section');
            popularAgencias(document.getElementById('agencia-select'));
        }
    });;

    document.getElementById('agencia-select').addEventListener('change', (e) => atualizarMunicipios(e.target));
    document.getElementById('municipio-select').addEventListener('change', (e) => atualizarGeocodigos(e.target));
    document.getElementById('adicionar-viagem-btn').addEventListener('click', () => adicionarViagem());
    document.getElementById('terminar-btn').addEventListener('click', () => descarregarCSV());
    document.getElementById('voltar-btn').addEventListener('click', () => voltarParaLista());
    document.getElementById('modalidade-container-calc').addEventListener('change', (e) => updateModalidadeOptionsCalc(e));
    document.getElementById('login-btn').addEventListener('click', () => handleLogin());
    document.getElementById('logoff-btn')?.addEventListener('click', () => handleLogoff());

    document.getElementById('finalizar-calculo-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        await finalizarCalculo();
    });

    document.getElementById('fechar-view-modal').addEventListener('click', () => {
        document.getElementById('view-modal-backdrop').classList.replace('flex', 'hidden');
    });
});