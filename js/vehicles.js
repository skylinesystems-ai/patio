window.VehicleService = (() => {
  const STATUS = {
    LIBERADO: "liberado",
    PENDENCIA: "pendencia",
    BLOQUEADO: "bloqueado"
  };

  const TYPES = ["Caminhão", "Troller 40", "Troller 20", "Carreta Baú"];

  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  function getVehicles(includeInactive = true) {
    const list = PatioStorage.getState().vehicles;
    return includeInactive ? [...list] : list.filter(v => v.ativo !== false);
  }

  function getVehicleById(id) {
    return PatioStorage.getState().vehicles.find(v => v.id === id) || null;
  }

  function normalizePlate(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function normalizeFleet(value) {
    return String(value || "").trim();
  }

  function addVehicle({ placa, frota, tipo, observacao = "" }) {
    const plate = normalizePlate(placa);
    const fleet = normalizeFleet(frota);
    if (!plate) throw new Error("Informe a placa.");
    if (!fleet) throw new Error("Informe o número da frota.");
    if (!TYPES.includes(tipo)) throw new Error("Selecione um tipo de veículo.");

    const vehicles = getVehicles(true);
    if (vehicles.some(v => normalizePlate(v.placa) === plate))
      throw new Error("Já existe um veículo cadastrado com esta placa.");
    if (vehicles.some(v => normalizeFleet(v.frota) === fleet))
      throw new Error("Já existe um veículo cadastrado com este número de frota.");

    const timestamp = now();
    const vehicle = {
      id: uid("veh"),
      placa: plate,
      frota: fleet,
      tipo,
      status: STATUS.LIBERADO,
      observacao: String(observacao || "").trim(),
      ativo: true,
      criadoEm: timestamp,
      atualizadoEm: timestamp
    };

    PatioStorage.getState().vehicles.push(vehicle);
    PatioStorage.save();
    return vehicle;
  }

  function updateVehicle(id, { placa, frota, tipo, observacao = "" }) {
    const vehicle = getVehicleById(id);
    if (!vehicle) throw new Error("Veículo não encontrado.");

    const plate = normalizePlate(placa);
    const fleet = normalizeFleet(frota);
    if (!plate || !fleet || !TYPES.includes(tipo)) throw new Error("Preencha os campos obrigatórios.");

    const others = getVehicles(true).filter(v => v.id !== id);
    if (others.some(v => normalizePlate(v.placa) === plate))
      throw new Error("Já existe um veículo cadastrado com esta placa.");
    if (others.some(v => normalizeFleet(v.frota) === fleet))
      throw new Error("Já existe um veículo cadastrado com este número de frota.");

    vehicle.placa = plate;
    vehicle.frota = fleet;
    vehicle.tipo = tipo;
    vehicle.observacao = String(observacao || "").trim();
    vehicle.atualizadoEm = now();
    PatioStorage.save();
    return vehicle;
  }

  function deactivateVehicle(id) {
    const vehicle = getVehicleById(id);
    if (!vehicle) throw new Error("Veículo não encontrado.");
    const oldStatus = vehicle.status;
    vehicle.ativo = false;
    vehicle.atualizadoEm = now();
    addHistory(id, oldStatus, oldStatus, "Desativação do veículo");
    PatioStorage.save();
    return vehicle;
  }

  function searchVehicles(term, includeInactive = false) {
    const q = String(term || "").trim().toUpperCase();
    return getVehicles(includeInactive).filter(v =>
      v.placa.toUpperCase().includes(q) ||
      v.frota.toUpperCase().includes(q) ||
      v.tipo.toUpperCase().includes(q)
    );
  }

  function filterVehicles(status = "todos", term = "") {
    return searchVehicles(term, false).filter(v => status === "todos" || v.status === status);
  }

  function getOpenMaintenances(vehicleId) {
    return PatioStorage.getState().maintenances.filter(m =>
      m.veiculoId === vehicleId && m.status === "aberta"
    );
  }

  function updateVehicleStatus(vehicleId, reason = "Atualização automática") {
    const vehicle = getVehicleById(vehicleId);
    if (!vehicle) return null;
    const open = getOpenMaintenances(vehicleId);
    const old = vehicle.status;
    let next = STATUS.LIBERADO;
    if (open.some(m => m.bloqueiaVeiculo === true)) next = STATUS.BLOQUEADO;
    else if (open.length) next = STATUS.PENDENCIA;

    vehicle.status = next;
    vehicle.atualizadoEm = now();

    if (old !== next) addHistory(vehicleId, old, next, reason);
    PatioStorage.save();
    return vehicle;
  }

  function addHistory(veiculoId, statusAnterior, novoStatus, motivo) {
    PatioStorage.getState().history.push({
      id: uid("hist"),
      veiculoId,
      statusAnterior,
      novoStatus,
      motivo,
      dataHora: now()
    });
  }

  function getHistory(vehicleId) {
    return PatioStorage.getState().history
      .filter(h => h.veiculoId === vehicleId)
      .sort((a,b) => new Date(b.dataHora) - new Date(a.dataHora));
  }

  function getStats() {
    const active = getVehicles(false);
    return {
      total: active.length,
      liberado: active.filter(v => v.status === STATUS.LIBERADO).length,
      pendencia: active.filter(v => v.status === STATUS.PENDENCIA).length,
      bloqueado: active.filter(v => v.status === STATUS.BLOQUEADO).length,
      manutencoesAbertas: PatioStorage.getState().maintenances.filter(m => m.status === "aberta").length,
      parados: active.filter(v => v.status === STATUS.BLOQUEADO).length
    };
  }

  function calculateVehicleStats(vehicleId) {
    const all = PatioStorage.getState().maintenances.filter(m => m.veiculoId === vehicleId);
    const open = all.filter(m => m.status === "aberta");
    const completed = all.filter(m => m.status === "concluida");
    const last = [...all].sort((a,b) => new Date(b.dataAbertura) - new Date(a.dataAbertura))[0] || null;
    const history = getHistory(vehicleId);
    const blocks = history.filter(h => h.novoStatus === STATUS.BLOQUEADO);
    let daysStopped = 0;
    const latestBlock = blocks[0];
    if (latestBlock) {
      const end = getVehicleById(vehicleId)?.status === STATUS.BLOQUEADO ? new Date() : (() => {
        const release = history.find(h => h.novoStatus === STATUS.LIBERADO && new Date(h.dataHora) > new Date(latestBlock.dataHora));
        return release ? new Date(release.dataHora) : new Date();
      })();
      daysStopped = Math.max(0, Math.floor((end - new Date(latestBlock.dataHora)) / 86400000));
    }
    return {
      total: all.length,
      open: open.length,
      completed: completed.length,
      daysStopped,
      lastMaintenance: last?.dataAbertura || null,
      lastRelease: history.find(h => h.novoStatus === STATUS.LIBERADO)?.dataHora || null
    };
  }

  return {
    STATUS, TYPES, getVehicles, getVehicleById, addVehicle, updateVehicle, deactivateVehicle,
    searchVehicles, filterVehicles, getOpenMaintenances, updateVehicleStatus, addHistory,
    getHistory, getStats, calculateVehicleStats, normalizePlate
  };
})();
