window.UI = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const statusMeta = {
    liberado: { label: "LIBERADO", icon: "🟢", desc: "Disponível para uso" },
    pendencia: { label: "PENDÊNCIA", icon: "🟡", desc: "Existe uma ocorrência em aberto" },
    bloqueado: { label: "BLOQUEADO", icon: "🔴", desc: "Não está liberado para uso" }
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
  }

  function fmt(date, withTime = true) {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", withTime ? { dateStyle:"short", timeStyle:"short" } : { dateStyle:"short" });
  }

  function localDateTimeValue(date = new Date()) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function statusBadge(status, large = false) {
    const m = statusMeta[status] || statusMeta.pendencia;
    return `<span class="status-badge ${status} ${large ? "large":""}">${m.icon} ${m.label}</span>`;
  }

  function summaryCards(stats) {
    const cards = [
      ["Total de veículos", stats.total, "🚛", "neutral"],
      ["Liberados", stats.liberado, "🟢", "liberado"],
      ["Pendências", stats.pendencia, "🟡", "pendencia"],
      ["Bloqueados", stats.bloqueado, "🔴", "bloqueado"]
    ];
    return cards.map(([label,val,icon,cls]) =>
      `<div class="summary-card ${cls}"><span class="summary-icon">${icon}</span><div><strong>${val}</strong><span>${label}</span></div></div>`
    ).join("");
  }

  function vehicleCard(vehicle) {
    const open = VehicleService.getOpenMaintenances(vehicle.id);
    const main = open.find(m => m.bloqueiaVeiculo) || open[0];
    return `<article class="vehicle-card ${vehicle.status}" data-id="${esc(vehicle.id)}" tabindex="0">
      <div class="vehicle-card-top">
        <div><span class="label">FROTA</span><strong class="fleet">${esc(vehicle.frota)}</strong></div>
        ${statusBadge(vehicle.status)}
      </div>
      <div class="plate">${esc(vehicle.placa)}</div>
      <div class="vehicle-type">🚛 ${esc(vehicle.tipo)}</div>
      ${main ? `<div class="issue"><strong>${esc(main.descricao)}</strong><span>${esc(main.prioridade)}${main.bloqueiaVeiculo ? " · Bloqueia veículo" : ""}</span></div>` : `<div class="issue no-issue">Nenhuma ocorrência aberta</div>`}
    </article>`;
  }

  function renderVehicleList(container, vehicles, empty = "Nenhum veículo encontrado.") {
    container.innerHTML = vehicles.length ? vehicles.map(vehicleCard).join("") : `<div class="empty-inline"><span>🚛</span><strong>${empty}</strong></div>`;
    $$(".vehicle-card", container).forEach(card => {
      card.addEventListener("click", () => App.openVehicle(card.dataset.id));
      card.addEventListener("keydown", e => { if (e.key === "Enter") App.openVehicle(card.dataset.id); });
    });
  }

  function openModal(title, body, className = "") {
    $("#modal-root").innerHTML = `<div class="modal-backdrop" data-modal-close>
      <div class="modal ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-header"><h2>${esc(title)}</h2><button class="icon-btn" data-modal-close aria-label="Fechar">×</button></div>
        <div class="modal-body">${body}</div>
      </div>
    </div>`;
    const backdrop = $(".modal-backdrop");
    $(".modal", backdrop).addEventListener("click", e => e.stopPropagation());
    $$("[data-modal-close]", backdrop).forEach(el => el.addEventListener("click", closeModal));
  }

  function closeModal() { $("#modal-root").innerHTML = ""; }

  function vehicleForm(vehicle = null) {
    const edit = Boolean(vehicle);
    openModal(edit ? "Editar veículo" : "Cadastrar veículo", `
      <form id="vehicle-form" class="form-grid">
        <div class="form-field"><label>Placa *</label><input name="placa" required value="${esc(vehicle?.placa || "")}" placeholder="ABC1D23"></div>
        <div class="form-field"><label>Número da frota *</label><input name="frota" required value="${esc(vehicle?.frota || "")}" placeholder="1025"></div>
        <div class="form-field full"><label>Tipo de veículo *</label><select name="tipo" required>
          <option value="">Selecione</option>${VehicleService.TYPES.map(t => `<option ${vehicle?.tipo === t ? "selected":""}>${esc(t)}</option>`).join("")}
        </select></div>
        <div class="form-field full"><label>Observação</label><textarea name="observacao" rows="3" placeholder="Observações opcionais">${esc(vehicle?.observacao || "")}</textarea></div>
        <div class="form-actions full"><button type="button" class="btn btn-ghost" data-modal-close>CANCELAR</button><button class="btn btn-primary">${edit ? "SALVAR ALTERAÇÕES" : "CADASTRAR VEÍCULO"}</button></div>
      </form>
    `);
    $("#vehicle-form").addEventListener("submit", e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget));
      try {
        if (edit) VehicleService.updateVehicle(vehicle.id, data);
        else VehicleService.addVehicle(data);
        closeModal();
        toast(edit ? "Veículo atualizado com sucesso." : "Veículo cadastrado com sucesso.", "success");
        if (edit) App.openVehicle(vehicle.id); else App.showVehicles("");
      } catch (err) { toast(err.message, "error"); }
    });
    $$("[data-modal-close]", $("#modal-root")).forEach(el => el.addEventListener("click", closeModal));
  }

  function maintenanceForm(vehicleId) {
    openModal("Nova manutenção", `
      <form id="maintenance-form" class="form-grid">
        <div class="form-field full"><label>Data de registro *</label><input type="datetime-local" name="dataAbertura" value="${localDateTimeValue()}" required></div>
        <div class="form-field"><label>Tipo *</label><select name="tipo" required>
          <option value="">Selecione</option><option>Manutenção corretiva</option><option>Manutenção preventiva</option><option>Inspeção</option><option>Problema operacional</option><option>Outro</option>
        </select></div>
        <div class="form-field"><label>Prioridade *</label><select name="prioridade" required>
          <option>Baixa</option><option selected>Média</option><option>Alta</option><option>Crítica</option>
        </select></div>
        <div class="form-field full"><label>Descrição do problema *</label><textarea name="descricao" rows="4" required placeholder="Ex.: Sistema de freios apresentando falha."></textarea></div>
        <div class="form-field full"><label>Bloqueia o veículo?</label><div class="radio-row">
          <label><input type="radio" name="bloqueiaVeiculo" value="true" checked> Sim</label>
          <label><input type="radio" name="bloqueiaVeiculo" value="false"> Não</label>
        </div></div>
        <div class="form-field full"><label>Observações</label><textarea name="observacao" rows="3" placeholder="Observações opcionais"></textarea></div>
        <div class="form-actions full"><button type="button" class="btn btn-ghost" data-modal-close>CANCELAR</button><button class="btn btn-primary">REGISTRAR MANUTENÇÃO</button></div>
      </form>
    `);
    $("#maintenance-form").addEventListener("submit", e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget));
      data.bloqueiaVeiculo = data.bloqueiaVeiculo === "true";
      try {
        MaintenanceService.addMaintenance({ ...data, veiculoId: vehicleId });
        closeModal(); toast("Manutenção registrada com sucesso.", "success"); App.openVehicle(vehicleId);
      } catch(err) { toast(err.message, "error"); }
    });
    $$("[data-modal-close]", $("#modal-root")).forEach(el => el.addEventListener("click", closeModal));
  }

  function releaseModal(vehicleId) {
    const vehicle = VehicleService.getVehicleById(vehicleId);
    const blocking = MaintenanceService.getOpen(vehicleId).filter(m => m.bloqueiaVeiculo);
    const list = MaintenanceService.getOpen(vehicleId);
    const force = blocking.length > 0;
    openModal(force ? "Liberação bloqueada" : "Liberar veículo", `
      <div class="confirm-content">
        <div class="confirm-icon">${force ? "⚠️" : "✓"}</div>
        <h3>${force ? "Este veículo possui uma manutenção bloqueante em aberto." : "Liberar este veículo para operação?"}</h3>
        <p class="muted">${esc(vehicle.frota)} · ${esc(vehicle.placa)}</p>
        ${list.length ? `<div class="open-list">${list.map(m => `<div><strong>${esc(m.descricao)}</strong><span>${esc(m.prioridade)} · ${m.bloqueiaVeiculo ? "Bloqueia veículo" : "Não bloqueia"}</span></div>`).join("")}</div>` : ""}
        ${force ? `<div class="warning-box">A liberação forçada concluirá as manutenções bloqueantes e registrará o evento no histórico.</div>
          <div class="form-field"><label>Digite LIBERAR para confirmar</label><input id="force-confirm" autocomplete="off" placeholder="LIBERAR"></div>` : ""}
        <div class="form-actions"><button class="btn btn-ghost" data-modal-close>CANCELAR</button>
          <button id="release-confirm-btn" class="btn ${force ? "btn-danger":"btn-success"}">${force ? "FORÇAR LIBERAÇÃO" : "LIBERAR PARA USO"}</button>
        </div>
      </div>
    `);
    $("#release-confirm-btn").addEventListener("click", () => {
      if (force && $("#force-confirm").value.trim().toUpperCase() !== "LIBERAR") {
        toast("Digite LIBERAR para confirmar.", "error"); return;
      }
      try { MaintenanceService.releaseVehicle(vehicleId, force); closeModal(); toast("Veículo liberado para uso.", "success"); App.openVehicle(vehicleId); }
      catch(err) { toast(err.message, "error"); }
    });
    $$("[data-modal-close]", $("#modal-root")).forEach(el => el.addEventListener("click", closeModal));
  }

  function deactivateModal(vehicleId) {
    const vehicle = VehicleService.getVehicleById(vehicleId);
    openModal("Desativar veículo", `<div class="confirm-content"><div class="confirm-icon">🗑️</div>
      <h3>Desativar a frota ${esc(vehicle.frota)}?</h3><p>O veículo não será apagado. Seus dados e histórico continuarão armazenados.</p>
      <div class="form-actions"><button class="btn btn-ghost" data-modal-close>CANCELAR</button><button id="deactivate-btn" class="btn btn-danger">DESATIVAR VEÍCULO</button></div></div>`);
    $("#deactivate-btn").addEventListener("click", () => {
      try { VehicleService.deactivateVehicle(vehicleId); closeModal(); toast("Veículo desativado.", "success"); App.showVehicles(""); }
      catch(err) { toast(err.message, "error"); }
    });
    $$("[data-modal-close]", $("#modal-root")).forEach(el => el.addEventListener("click", closeModal));
  }

  function toast(message, type = "info") {
    const root = $("#toast-root");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️"}</span><span>${esc(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, 3300);
  }

  function renderDashboard(vehicle) {
    const meta = statusMeta[vehicle.status];
    const open = MaintenanceService.getOpen(vehicle.id);
    const history = MaintenanceService.getByVehicle(vehicle.id);
    const stats = VehicleService.calculateVehicleStats(vehicle.id);
    const main = open.find(m => m.bloqueiaVeiculo) || open[0];
    const statusText = vehicle.status === "bloqueado" ? "Não está liberado para uso" : meta.desc;

    $("#vehicle-dashboard").innerHTML = `
      <div class="page-heading">
        <button class="btn btn-ghost" data-action="go-home">← Início</button>
        <div><p class="eyebrow">DASHBOARD DO VEÍCULO</p><h1>FROTA ${esc(vehicle.frota)}</h1></div>
        <span class="active-indicator">${vehicle.ativo ? "ATIVO" : "DESATIVADO"}</span>
      </div>
      <div class="vehicle-identity">
        <div><div class="label">PLACA</div><strong>${esc(vehicle.placa)}</strong><span>🚛 ${esc(vehicle.tipo)}</span></div>
        ${statusBadge(vehicle.status, true)}
      </div>
      <section class="status-panel ${vehicle.status}">
        <div class="status-panel-icon">${meta.icon}</div>
        <div><span class="status-panel-label">${meta.label}</span><h2>${statusText}</h2>
          ${main ? `<p><strong>Motivo:</strong> ${esc(main.descricao)}</p><p><strong>Aberto em:</strong> ${fmt(main.dataAbertura)}</p>` : `<p>Nenhuma ocorrência em aberto.</p>`}
        </div>
      </section>
      <div class="dashboard-actions">
        <button class="action-btn maintenance" data-action="open-maintenance" data-id="${vehicle.id}">🔧 <span>REGISTRAR MANUTENÇÃO</span></button>
        <button class="action-btn release" data-action="release" data-id="${vehicle.id}" ${!vehicle.ativo ? "disabled":""}>✓ <span>LIBERAR PARA USO</span></button>
        <button class="action-btn edit" data-action="edit-vehicle" data-id="${vehicle.id}">✏️ <span>EDITAR VEÍCULO</span></button>
        <button class="action-btn deactivate" data-action="deactivate" data-id="${vehicle.id}" ${!vehicle.ativo ? "disabled":""}>🗑️ <span>DESATIVAR VEÍCULO</span></button>
      </div>
      <section class="stats-grid">
        ${[
          ["Total de manutenções", stats.total],["Em aberto",stats.open],["Concluídas",stats.completed],["Dias parado",stats.daysStopped],
          ["Última manutenção",fmt(stats.lastMaintenance,false)],["Última liberação",fmt(stats.lastRelease,false)]
        ].map(([l,v])=>`<div class="vehicle-stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join("")}
      </section>
      <section class="section">
        <div class="section-heading"><div><p class="eyebrow">OCORRÊNCIAS</p><h2>🔧 Manutenções em aberto</h2></div><span class="count-badge">${open.length}</span></div>
        <div class="maintenance-list">${open.length ? open.map(maintenanceItem).join("") : `<div class="empty-inline"><span>✓</span><strong>Nenhuma manutenção em aberto.</strong></div>`}</div>
      </section>
      <section class="section">
        <div class="section-heading"><div><p class="eyebrow">AUDITORIA</p><h2>📋 Histórico de manutenções</h2></div></div>
        <div class="history-list">${history.length ? history.map(historyItem).join("") : `<div class="empty-inline"><span>📋</span><strong>Nenhum histórico registrado.</strong></div>`}</div>
      </section>
      ${vehicle.observacao ? `<section class="note-box"><strong>Observações do veículo</strong><p>${esc(vehicle.observacao)}</p></section>` : ""}
    `;
  }

  function maintenanceItem(m) {
    return `<article class="maintenance-item">
      <div class="maintenance-head"><div><strong>${esc(m.tipo)}</strong><span>${esc(m.prioridade)}</span></div><span class="open-tag">ABERTA</span></div>
      <p>${esc(m.descricao)}</p>
      <div class="maintenance-meta"><span>📅 ${fmt(m.dataAbertura)}</span><span>${m.bloqueiaVeiculo ? "🔴 Bloqueia veículo: SIM" : "🟡 Bloqueia veículo: NÃO"}</span></div>
      ${m.observacao ? `<small>${esc(m.observacao)}</small>` : ""}
      <div class="maintenance-actions"><button class="btn btn-small btn-success" data-action="complete-maintenance" data-id="${m.id}">Concluir manutenção</button></div>
    </article>`;
  }

  function historyItem(m) {
    const status = m.status === "concluida" ? "liberado" : "pendencia";
    return `<article class="history-item"><div class="history-date">${fmt(m.dataAbertura,false)}</div>
      <div class="history-main"><strong>${esc(m.tipo)}</strong><p>${esc(m.descricao)}</p>
        <span class="history-status ${status}">${m.status === "concluida" ? "🟢 CONCLUÍDA" : "🟡 ABERTA"}</span>
        ${m.dataConclusao ? `<span> · Concluída em ${fmt(m.dataConclusao)}</span>` : ""}
      </div></article>`;
  }

  return { $, $$, esc, fmt, statusBadge, summaryCards, vehicleCard, renderVehicleList, vehicleForm, maintenanceForm, releaseModal, deactivateModal, toast, renderDashboard, closeModal };
})();
