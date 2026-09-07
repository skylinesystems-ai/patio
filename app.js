window.App = (() => {
  let currentFilter = "todos";
  let currentVehicleId = null;

  function views() { return UI.$$(".view"); }

  function show(viewId) {
    views().forEach(v => v.classList.toggle("active", v.id === viewId));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderHome() {
    const stats = VehicleService.getStats();
    UI.$("#home-summary").innerHTML = UI.summaryCards(stats);
    const has = stats.total > 0;
    UI.$("#home-empty").classList.toggle("hidden", has);
    UI.$("#quick-actions").classList.toggle("hidden", !has);
  }

  function runSearch(term = UI.$("#home-search").value) {
    const q = String(term || "").trim();
    const results = q ? VehicleService.searchVehicles(q, false) : [];
    UI.$("#search-results").classList.toggle("hidden", !q);
    UI.$("#result-count").textContent = `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`;
    UI.renderVehicleList(UI.$("#results-grid"), results, q ? "Nenhum veículo encontrado." : "Digite uma placa, frota ou tipo.");
  }

  function showVehicles(term = "") {
    show("vehicles-view");
    UI.$("#vehicle-search").value = term;
    renderVehicleSelection();
  }

  function renderVehicleSelection() {
    const term = UI.$("#vehicle-search").value;
    const vehicles = VehicleService.filterVehicles(currentFilter, term);
    UI.renderVehicleList(UI.$("#vehicles-grid"), vehicles, "Nenhum veículo corresponde aos filtros.");
    UI.$$(".filter-tab").forEach(b => b.classList.toggle("active", b.dataset.filter === currentFilter));
  }

  function openVehicle(id) {
    const vehicle = VehicleService.getVehicleById(id);
    if (!vehicle) return UI.toast("Veículo não encontrado.", "error");
    currentVehicleId = id;
    UI.renderDashboard(vehicle);
    show("vehicle-view");
    bindDynamicActions();
  }

  function openOverview() {
    const stats = VehicleService.getStats();
    const active = VehicleService.getVehicles(false);
    const byType = VehicleService.TYPES.map(type => [type, active.filter(v => v.tipo === type).length]);
    const blocked = active.filter(v => v.status === "bloqueado").sort((a,b) => new Date(a.atualizadoEm)-new Date(b.atualizadoEm));
    UI.$("#overview-content").innerHTML = `
      <div class="summary-grid overview-summary">${UI.summaryCards(stats)}
        <div class="summary-card neutral"><span class="summary-icon">🔧</span><div><strong>${stats.manutencoesAbertas}</strong><span>Manutenções abertas</span></div></div>
        <div class="summary-card bloqueado"><span class="summary-icon">⏱️</span><div><strong>${stats.parados}</strong><span>Veículos parados</span></div></div>
      </div>
      <section class="section"><div class="section-heading"><div><p class="eyebrow">FROTA</p><h2>Divisão por tipo</h2></div></div>
        <div class="type-grid">${byType.map(([type,count]) => `<div class="type-card"><span>🚛</span><strong>${count}</strong><small>${UI.esc(type)}${count === 1 ? "" : "s"}</small></div>`).join("")}</div>
      </section>
      <section class="section"><div class="section-heading"><div><p class="eyebrow">ATENÇÃO</p><h2>⚠️ Veículos bloqueados</h2></div><span class="count-badge">${blocked.length}</span></div>
        <div class="blocked-list">${blocked.length ? blocked.map(v => {
          const m = MaintenanceService.getOpen(v.id).find(x => x.bloqueiaVeiculo) || MaintenanceService.getOpen(v.id)[0];
          return `<button class="blocked-row" data-id="${v.id}"><div><strong>FROTA ${UI.esc(v.frota)}</strong><span>${UI.esc(v.placa)} · ${UI.esc(v.tipo)}</span></div><div><strong>${UI.esc(m?.descricao || "Bloqueio")}</strong><span>${UI.esc(m?.prioridade || "—")} · ${UI.fmt(m?.dataAbertura)}</span></div><span>→</span></button>`;
        }).join("") : `<div class="empty-inline"><span>✓</span><strong>Nenhum veículo bloqueado.</strong></div>`}</div>
      </section>
    `;
    UI.$$(".blocked-row").forEach(row => row.addEventListener("click", () => openVehicle(row.dataset.id)));
    show("overview-view");
  }

  function loadDemo() {
    const data = PatioStorage.getState();
    if (data.vehicles.length) {
      UI.toast("Já existem dados cadastrados. A demonstração não foi carregada.", "info"); return;
    }
    const demo = [
      ["ABC1D23","1025","Caminhão","liberado",""],
      ["DEF4E56","1048","Troller 40","bloqueado","Falha no sistema de freios"],
      ["GHI7J89","1081","Carreta Baú","pendencia","Pneus precisam ser avaliados"],
      ["JKL0M12","1090","Troller 20","liberado",""]
    ];
    demo.forEach(([placa,frota,tipo]) => VehicleService.addVehicle({placa,frota,tipo}));
    const v = VehicleService.getVehicles(true);
    MaintenanceService.addMaintenance({veiculoId:v.find(x=>x.frota==="1048").id,tipo:"Manutenção corretiva",descricao:"Falha no sistema de freios",prioridade:"Alta",bloqueiaVeiculo:true,observacao:"Dados de demonstração"});
    MaintenanceService.addMaintenance({veiculoId:v.find(x=>x.frota==="1081").id,tipo:"Inspeção",descricao:"Pneus precisam ser avaliados",prioridade:"Média",bloqueiaVeiculo:false,observacao:"Dados de demonstração"});
    renderHome(); UI.toast("Dados de demonstração carregados.", "success");
  }

  function bindDynamicActions() {
    UI.$$("[data-action]", UI.$("#vehicle-view")).forEach(bindAction);
  }

  function bindAction(el) {
    const action = el.dataset.action;
    if (el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      if (action === "go-home") { renderHome(); show("home-view"); }
      else if (action === "open-maintenance") UI.maintenanceForm(id);
      else if (action === "release") UI.releaseModal(id);
      else if (action === "edit-vehicle") UI.vehicleForm(VehicleService.getVehicleById(id));
      else if (action === "deactivate") UI.deactivateModal(id);
      else if (action === "complete-maintenance") {
        try { MaintenanceService.completeMaintenance(id); UI.toast("Manutenção concluída.", "success"); openVehicle(currentVehicleId); }
        catch(err) { UI.toast(err.message, "error"); }
      }
    });
  }

  function init() {
    document.addEventListener("click", e => {
      const el = e.target.closest("[data-action]");
      if (el) {
        const action = el.dataset.action;
        if (action === "go-home") { renderHome(); show("home-view"); }
        if (action === "open-add") UI.vehicleForm();
        if (action === "open-overview") openOverview();
        if (action === "run-search") runSearch();
        if (action === "load-demo") loadDemo();
        if (action === "release") UI.releaseModal(el.dataset.id);
        if (action === "open-maintenance") UI.maintenanceForm(el.dataset.id);
        if (action === "edit-vehicle") UI.vehicleForm(VehicleService.getVehicleById(el.dataset.id));
        if (action === "deactivate") UI.deactivateModal(el.dataset.id);
        if (action === "complete-maintenance") {
          try { MaintenanceService.completeMaintenance(el.dataset.id); UI.toast("Manutenção concluída.", "success"); openVehicle(currentVehicleId); }
          catch(err) { UI.toast(err.message, "error"); }
        }
      }
    });

    UI.$("#home-search").addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
    UI.$("#vehicle-search").addEventListener("input", renderVehicleSelection);
    UI.$$(".filter-tab").forEach(tab => tab.addEventListener("click", () => { currentFilter = tab.dataset.filter; renderVehicleSelection(); }));
    renderHome();
  }

  return { init, openVehicle, showVehicles };
})();

document.addEventListener("DOMContentLoaded", App.init);
