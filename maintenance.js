window.MaintenanceService = (() => {
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = () => new Date().toISOString();

  function addMaintenance({ veiculoId, tipo, descricao, prioridade, bloqueiaVeiculo, dataAbertura, observacao = "" }) {
    const vehicle = VehicleService.getVehicleById(veiculoId);
    if (!vehicle) throw new Error("Veículo não encontrado.");
    if (!descricao || !String(descricao).trim()) throw new Error("Descreva o problema.");
    if (!["Manutenção corretiva","Manutenção preventiva","Inspeção","Problema operacional","Outro"].includes(tipo))
      throw new Error("Selecione um tipo válido.");
    if (!["Baixa","Média","Alta","Crítica"].includes(prioridade))
      throw new Error("Selecione uma prioridade válida.");

    const maintenance = {
      id: uid("mnt"),
      veiculoId,
      tipo,
      descricao: String(descricao).trim(),
      prioridade,
      dataAbertura: dataAbertura ? new Date(dataAbertura).toISOString() : now(),
      dataConclusao: null,
      status: "aberta",
      bloqueiaVeiculo: Boolean(bloqueiaVeiculo),
      observacao: String(observacao || "").trim()
    };

    PatioStorage.getState().maintenances.push(maintenance);
    PatioStorage.save();
    VehicleService.updateVehicleStatus(
      veiculoId,
      maintenance.bloqueiaVeiculo ? "Manutenção bloqueante registrada" : "Manutenção/pendência registrada"
    );
    return maintenance;
  }

  function completeMaintenance(id, reason = "Manutenção concluída") {
    const m = PatioStorage.getState().maintenances.find(x => x.id === id);
    if (!m) throw new Error("Manutenção não encontrada.");
    if (m.status === "concluida") return m;
    m.status = "concluida";
    m.dataConclusao = now();
    PatioStorage.save();
    VehicleService.updateVehicleStatus(m.veiculoId, reason);
    return m;
  }

  function getByVehicle(vehicleId) {
    return PatioStorage.getState().maintenances
      .filter(m => m.veiculoId === vehicleId)
      .sort((a,b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));
  }

  function getOpen(vehicleId) {
    return getByVehicle(vehicleId).filter(m => m.status === "aberta");
  }

  function releaseVehicle(vehicleId, force = false) {
    const vehicle = VehicleService.getVehicleById(vehicleId);
    if (!vehicle) throw new Error("Veículo não encontrado.");
    const blocking = getOpen(vehicleId).filter(m => m.bloqueiaVeiculo);
    if (blocking.length && !force)
      throw new Error("Este veículo possui uma manutenção bloqueante em aberto.");

    blocking.forEach(m => completeMaintenance(m.id, force ? "Forçar liberação" : "Liberação"));
    const remaining = getOpen(vehicleId);
    const old = vehicle.status;
    if (!remaining.length) {
      vehicle.status = "liberado";
      vehicle.atualizadoEm = now();
      VehicleService.addHistory(vehicleId, old, "liberado", force ? "Liberação forçada" : "Liberação para uso");
      PatioStorage.save();
    } else {
      VehicleService.updateVehicleStatus(vehicleId, "Liberação parcial; existem pendências abertas");
    }
    return vehicle;
  }

  return { addMaintenance, completeMaintenance, getByVehicle, getOpen, releaseVehicle };
})();
