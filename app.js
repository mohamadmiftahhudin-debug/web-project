const STORAGE_KEY = "trucking_management_v1";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const defaultState = {
  jobs: [],
  advances: [],
  disbursements: [],
  lpjs: [],
  settlements: [],
  routeStandards: [],
  seq: {
    job: 0,
    advance: 0,
    disbursement: 0,
    lpj: 0,
    settlement: 0,
    route: 0
  }
};

let state = loadState();
let currentReportRows = [];
let supabaseClient = null;
let cloudUser = null;
let cloudPushTimer = null;
let cloudSyncInProgress = false;
let cloudPendingPush = false;
let cloudReady = false;
let appConfig = null;
let currentTeam = null;
let currentRole = "local";
let inlinePrintCleanupTimer = null;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindTabs();
  bindClock();
  bindForms();
  setDefaultDates();
  seedInitialData();
  renderAll();
  initCloudMode();
});

function bindElements() {
  const ids = [
    "todayChip",
    "clockChip",
    "cloudStatusChip",
    "teamRoleChip",
    "openAuthBtn",
    "syncNowBtn",
    "logoutBtn",
    "authModal",
    "authForm",
    "authEmail",
    "authPassword",
    "authTeamCode",
    "authTeamName",
    "authRole",
    "loginBtn",
    "registerBtn",
    "joinTeamBtn",
    "closeAuthBtn",
    "authHint",
    "toastWrap",
    "jobForm",
    "jobCustomer",
    "jobDoSp2",
    "jobContainerNo",
    "jobContainerSize",
    "jobRoute",
    "jobDriver",
    "jobTruck",
    "jobLoadingDate",
    "jobEtaReturnDate",
    "jobDistanceKm",
    "jobEstSolar",
    "jobEstTol",
    "jobEstMeal",
    "jobEstParking",
    "jobEstOther",
    "jobEstTotal",
    "applyRouteStandardBtn",
    "jobsTableBody",
    "routeOptions",
    "advanceForm",
    "advanceDate",
    "advanceJobId",
    "advanceDriver",
    "advanceTruck",
    "advanceRoute",
    "advanceEstimate",
    "advanceRequestedAmount",
    "advancePaymentType",
    "advanceTableBody",
    "disbursementForm",
    "disbursementDate",
    "disbursementAdvanceId",
    "disbursementDriver",
    "disbursementTruck",
    "disbursementAmount",
    "disbursementMethod",
    "disbursementNote",
    "disbursementTableBody",
    "lpjForm",
    "lpjDisbursementId",
    "lpjJobNo",
    "lpjDriver",
    "lpjTruck",
    "lpjReturnDatetime",
    "lpjSubmitDatetime",
    "lpjActualDistance",
    "lpjSolar",
    "lpjTol",
    "lpjParking",
    "lpjMeal",
    "lpjOther",
    "lpjTotal",
    "proofFuel",
    "proofToll",
    "proofParking",
    "proofWeighing",
    "proofRepair",
    "proofOriginalRequired",
    "lpjNotes",
    "lpjTableBody",
    "verificationTableBody",
    "settlementForm",
    "settlementLpjId",
    "settlementAdvanceAmount",
    "settlementActualAmount",
    "settlementDifference",
    "settlementType",
    "settlementMethod",
    "settlementDate",
    "settlementTableBody",
    "reportFilterForm",
    "reportMonth",
    "exportReportCsvBtn",
    "reportTotalJobs",
    "reportTotalCost",
    "reportTotalAdvance",
    "reportTotalBonus",
    "reportTableBody",
    "printForm",
    "printCompanyName",
    "printDate",
    "printDocType",
    "printRecordId",
    "previewPrintBtn",
    "printNowBtn",
    "printPreview",
    "printPreviewEmpty",
    "routeForm",
    "routeName",
    "routeDistance",
    "routeSolar",
    "routeTol",
    "routeMeal",
    "routeParking",
    "routeOther",
    "routeTableBody",
    "kpiTotalJob",
    "kpiActiveJob",
    "kpiOverdue",
    "kpiAdvanceMonth",
    "kpiReturnMonth",
    "kpiReimburseMonth",
    "dashboardQueueBody"
  ];
  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".panel");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((item) => item.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;
      const panel = document.getElementById(`tab-${key}`);
      if (panel) {
        panel.classList.add("active");
      }
    });
  });
}

function bindClock() {
  const tick = () => {
    const now = new Date();
    const todayLabel = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(now);
    const timeLabel = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(now);
    els.todayChip.textContent = todayLabel;
    els.clockChip.textContent = `Jam ${timeLabel}`;
  };
  tick();
  setInterval(tick, 1000);
}

function bindForms() {
  document.querySelectorAll(".job-cost").forEach((input) => {
    input.addEventListener("input", updateJobTotal);
  });
  document.querySelectorAll(".lpj-cost").forEach((input) => {
    input.addEventListener("input", updateLpjTotal);
  });

  els.jobForm.addEventListener("submit", submitJobOrder);
  els.applyRouteStandardBtn.addEventListener("click", applyRouteStandardToJob);
  els.advanceForm.addEventListener("submit", submitAdvanceRequest);
  els.advanceJobId.addEventListener("change", fillAdvanceFormFromJob);

  els.advanceTableBody.addEventListener("click", onAdvanceActionClick);

  els.disbursementForm.addEventListener("submit", submitDisbursement);
  els.disbursementAdvanceId.addEventListener("change", fillDisbursementForm);

  els.lpjForm.addEventListener("submit", submitLpj);
  els.lpjDisbursementId.addEventListener("change", fillLpjFormFromDisbursement);

  els.verificationTableBody.addEventListener("click", onVerificationClick);
  els.settlementForm.addEventListener("submit", submitSettlement);
  els.settlementLpjId.addEventListener("change", fillSettlementFormFromLpj);

  els.reportFilterForm.addEventListener("submit", onReportFilterSubmit);
  els.exportReportCsvBtn.addEventListener("click", exportReportCsv);

  els.printDocType.addEventListener("change", renderPrintRecordOptions);
  els.printRecordId.addEventListener("change", renderPrintPreview);
  els.printCompanyName.addEventListener("input", renderPrintPreview);
  els.printDate.addEventListener("change", renderPrintPreview);
  els.previewPrintBtn.addEventListener("click", renderPrintPreview);
  els.printNowBtn.addEventListener("click", printCurrentDocument);

  els.openAuthBtn.addEventListener("click", openAuthModal);
  els.closeAuthBtn.addEventListener("click", closeAuthModal);
  els.authModal.addEventListener("click", onAuthBackdropClick);
  els.authForm.addEventListener("submit", onLoginSubmit);
  els.registerBtn.addEventListener("click", onRegisterClick);
  els.joinTeamBtn.addEventListener("click", onJoinTeamClick);
  els.logoutBtn.addEventListener("click", onLogoutClick);
  els.syncNowBtn.addEventListener("click", onSyncNowClick);

  els.routeForm.addEventListener("submit", submitRouteStandard);
}

function setDefaultDates() {
  const today = toDateInputValue(new Date());
  const nowLocal = toDatetimeInputValue(new Date());
  const currentMonth = new Date().toISOString().slice(0, 7);

  els.advanceDate.value = today;
  els.disbursementDate.value = today;
  els.settlementDate.value = today;
  els.reportMonth.value = currentMonth;
  els.lpjSubmitDatetime.value = nowLocal;
  els.printDate.value = today;
}

async function initCloudMode() {
  appConfig = getAppConfig();
  setCloudStatus("Mode Lokal");
  setRoleChip("Role: Lokal");
  updateAuthUi();

  if (!appConfig.CLOUD_MODE) {
    els.authHint.textContent = "Cloud mode nonaktif. Isi config.js lalu aktifkan CLOUD_MODE=true.";
    return;
  }

  if (!appConfig.SUPABASE_URL || !appConfig.SUPABASE_ANON_KEY) {
    els.authHint.textContent = "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY pada config.js.";
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    els.authHint.textContent = "Library Supabase gagal dimuat. Cek koneksi internet/CDN.";
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(appConfig.SUPABASE_URL, appConfig.SUPABASE_ANON_KEY);
    cloudReady = true;
    setCloudStatus(appConfig.SHARED_TEAM_MODE ? "Cloud tim siap" : "Cloud siap");
    els.authHint.textContent = appConfig.SHARED_TEAM_MODE
      ? "Login akun cloud, lalu join tim agar data dipakai bersama."
      : "Login cloud agar data sinkron lintas perangkat.";

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setCloudStatus("Cloud error");
      showToast("Gagal membaca sesi cloud.", true);
      return;
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      await onSessionUserChanged(session?.user || null, true);
    });

    await onSessionUserChanged(data?.session?.user || null, true);
  } catch (_error) {
    setCloudStatus("Cloud error");
    showToast("Inisialisasi cloud gagal.", true);
  }
}

function getAppConfig() {
  const config = window.APP_CONFIG || {};
  return {
    SUPABASE_URL: String(config.SUPABASE_URL || "").trim(),
    SUPABASE_ANON_KEY: String(config.SUPABASE_ANON_KEY || "").trim(),
    CLOUD_MODE: Boolean(config.CLOUD_MODE),
    SHARED_TEAM_MODE: config.SHARED_TEAM_MODE !== false
  };
}

function setCloudStatus(text) {
  els.cloudStatusChip.textContent = text;
}

function setRoleChip(text) {
  els.teamRoleChip.textContent = text;
}

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "finance") return "Finance";
  if (role === "operasional") return "Operasional";
  if (role === "guest") return "Guest";
  return "Lokal";
}

function normalizeRole(role) {
  const text = String(role || "").toLowerCase().trim();
  if (text === "admin" || text === "finance" || text === "operasional") {
    return text;
  }
  return "guest";
}

function normalizeTeamCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

function canCloudSync() {
  if (!cloudReady || !cloudUser) {
    return false;
  }
  if (appConfig?.SHARED_TEAM_MODE) {
    return Boolean(currentTeam?.id);
  }
  return true;
}

function getCloudStateSource() {
  if (!cloudUser) return null;
  if (appConfig?.SHARED_TEAM_MODE) {
    if (!currentTeam?.id) return null;
    return {
      table: "team_state",
      key: "team_id",
      value: currentTeam.id,
      conflict: "team_id",
      payload: { team_id: currentTeam.id }
    };
  }
  return {
    table: "app_state",
    key: "user_id",
    value: cloudUser.id,
    conflict: "user_id",
    payload: { user_id: cloudUser.id }
  };
}

function updateAuthUi() {
  if (!cloudReady) {
    els.openAuthBtn.classList.remove("hidden");
    els.openAuthBtn.textContent = "Login Cloud";
    els.syncNowBtn.classList.add("hidden");
    els.logoutBtn.classList.add("hidden");
    setRoleChip("Role: Lokal");
    return;
  }

  if (cloudUser) {
    const email = cloudUser.email || "user";
    const teamLabel = currentTeam ? ` | Tim ${currentTeam.code || currentTeam.name || "-"}` : "";
    setCloudStatus(`Cloud: ${email}${teamLabel}`);
    setRoleChip(`Role: ${roleLabel(currentRole)}`);
    els.openAuthBtn.classList.add("hidden");
    els.syncNowBtn.classList.remove("hidden");
    els.logoutBtn.classList.remove("hidden");
  } else {
    setCloudStatus(appConfig?.SHARED_TEAM_MODE ? "Cloud tim siap (belum login)" : "Cloud siap (belum login)");
    setRoleChip("Role: Lokal");
    els.openAuthBtn.classList.remove("hidden");
    els.openAuthBtn.textContent = "Login Cloud";
    els.syncNowBtn.classList.add("hidden");
    els.logoutBtn.classList.add("hidden");
  }
  applyRolePermissions();
}

async function onSessionUserChanged(user, silent = false) {
  cloudUser = user || null;
  currentTeam = null;
  currentRole = cloudUser ? "guest" : "local";

  if (!cloudUser) {
    updateAuthUi();
    applyRolePermissions();
    return;
  }

  await refreshTeamContext(silent);
  updateAuthUi();

  if (canCloudSync()) {
    await pullCloudState(true);
  } else if (appConfig?.SHARED_TEAM_MODE) {
    setCloudStatus("Belum join tim");
    if (!silent) {
      showToast("Akun ini belum tergabung tim. Isi Team Code lalu klik Join Tim.", true);
      openAuthModal();
    }
  }

  applyRolePermissions();
}

async function refreshTeamContext(silent = false) {
  if (!cloudReady || !cloudUser) return;
  if (!appConfig?.SHARED_TEAM_MODE) {
    currentRole = "admin";
    currentTeam = {
      id: cloudUser.id,
      code: "PERSONAL",
      name: "Personal"
    };
    return;
  }

  const { data, error } = await supabaseClient
    .from("team_members")
    .select("team_id, role, teams!inner(id, code, name)")
    .eq("user_id", cloudUser.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!silent) {
      showToast(`Gagal membaca tim: ${error.message}`, true);
    }
    currentTeam = null;
    currentRole = "guest";
    return;
  }

  if (!data) {
    currentTeam = null;
    currentRole = "guest";
    return;
  }

  currentTeam = {
    id: data.team_id,
    code: data.teams?.code || "",
    name: data.teams?.name || ""
  };
  currentRole = normalizeRole(data.role);
}

function openAuthModal() {
  if (!cloudReady) {
    showToast("Cloud belum aktif. Cek config.js.", true);
    return;
  }
  els.authModal.classList.remove("hidden");
}

function closeAuthModal() {
  els.authModal.classList.add("hidden");
}

function onAuthBackdropClick(event) {
  if (event.target === els.authModal) {
    closeAuthModal();
  }
}

async function onLoginSubmit(event) {
  event.preventDefault();
  if (!cloudReady) return;

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    showToast("Email dan password wajib diisi.", true);
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(`Login gagal: ${error.message}`, true);
    return;
  }

  cloudUser = data?.user || cloudUser;
  await refreshTeamContext(true);
  if (appConfig?.SHARED_TEAM_MODE && !currentTeam?.id) {
    await tryJoinTeamFromForm(true);
  }
  await onSessionUserChanged(cloudUser, true);

  if (appConfig?.SHARED_TEAM_MODE && !currentTeam?.id) {
    showToast("Login berhasil. Isi Team Code lalu klik Join Tim.");
    return;
  }

  showToast("Login cloud berhasil.");
  if (!appConfig?.SHARED_TEAM_MODE || currentTeam?.id) {
    closeAuthModal();
    els.authForm.reset();
  }
}

async function onRegisterClick() {
  if (!cloudReady) return;
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    showToast("Isi email dan password untuk daftar akun.", true);
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    showToast(`Registrasi gagal: ${error.message}`, true);
    return;
  }

  if (data?.user && data?.session) {
    cloudUser = data.user;
    await tryJoinTeamFromForm(false);
    await onSessionUserChanged(cloudUser, true);
  }

  showToast("Akun dibuat. Jika diminta, cek email verifikasi lalu login.");
}

async function onJoinTeamClick() {
  if (!cloudReady || !cloudUser) {
    showToast("Login cloud terlebih dahulu.", true);
    return;
  }
  if (!appConfig?.SHARED_TEAM_MODE) {
    showToast("Mode tim tidak aktif di konfigurasi.", true);
    return;
  }
  await tryJoinTeamFromForm(false);
}

async function tryJoinTeamFromForm(silent = false) {
  const teamCode = normalizeTeamCode(els.authTeamCode.value);
  const teamName = String(els.authTeamName.value || "").trim();
  const desiredRole = normalizeRole(els.authRole.value);

  if (!teamCode) {
    if (!silent) {
      showToast("Isi Team Code untuk join tim.", true);
    }
    return false;
  }

  const joined = await ensureTeamMembership(teamCode, teamName, desiredRole, silent);
  if (!joined) {
    return false;
  }

  await refreshTeamContext(true);
  updateAuthUi();
  await pullCloudState(true);
  showToast(`Berhasil tergabung tim ${teamCode}. Role Anda: ${roleLabel(currentRole)}.`);
  closeAuthModal();
  return true;
}

async function ensureTeamMembership(teamCode, teamName, desiredRole, silent = false) {
  if (!cloudReady || !cloudUser) return false;

  const normalizedCode = normalizeTeamCode(teamCode);
  const normalizedRole = normalizeRole(desiredRole);
  if (!normalizedCode) return false;

  let team = null;
  let createdNewTeam = false;

  const found = await supabaseClient
    .from("teams")
    .select("id, code, name")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (found.error) {
    if (!silent) {
      showToast(`Gagal mencari tim: ${found.error.message}`, true);
    }
    return false;
  }

  if (found.data) {
    team = found.data;
  } else {
    const payload = {
      code: normalizedCode,
      name: teamName || `Team ${normalizedCode}`,
      created_by: cloudUser.id
    };
    const created = await supabaseClient
      .from("teams")
      .insert(payload)
      .select("id, code, name")
      .single();

    if (created.error) {
      if (!silent) {
        showToast(`Gagal membuat tim: ${created.error.message}`, true);
      }
      return false;
    }
    team = created.data;
    createdNewTeam = true;
  }

  const existingMember = await supabaseClient
    .from("team_members")
    .select("id, role")
    .eq("team_id", team.id)
    .eq("user_id", cloudUser.id)
    .maybeSingle();

  if (existingMember.error) {
    if (!silent) {
      showToast(`Gagal membaca membership tim: ${existingMember.error.message}`, true);
    }
    return false;
  }

  let memberRole = createdNewTeam ? "admin" : (normalizedRole === "admin" ? "operasional" : normalizedRole);
  if (existingMember.data) {
    memberRole = normalizeRole(existingMember.data.role);
  } else {
    const insertMember = await supabaseClient
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id: cloudUser.id,
        role: memberRole
      });

    if (insertMember.error) {
      if (!silent) {
        showToast(`Gagal join tim: ${insertMember.error.message}`, true);
      }
      return false;
    }
  }

  if (!memberRole || memberRole === "guest") {
    if (!silent) {
      showToast("Role tim tidak valid.", true);
    }
    return false;
  }

  currentTeam = {
    id: team.id,
    code: team.code,
    name: team.name
  };
  currentRole = memberRole;
  return true;
}

async function onLogoutClick() {
  if (!cloudReady || !cloudUser) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast(`Logout gagal: ${error.message}`, true);
    return;
  }
  currentTeam = null;
  currentRole = "local";
  updateAuthUi();
  showToast("Logout berhasil.");
}

async function onSyncNowClick() {
  if (!canCloudSync()) {
    showToast("Login cloud dan pastikan sudah join tim.", true);
    return;
  }
  await pushStateToCloud("manual");
}

async function pullCloudState(silent = false) {
  const source = getCloudStateSource();
  if (!source) return;

  setCloudStatus("Sinkronisasi...");
  const { data, error } = await supabaseClient
    .from(source.table)
    .select("state_json, updated_at")
    .eq(source.key, source.value)
    .maybeSingle();

  if (error) {
    setCloudStatus("Cloud error");
    if (!silent) {
      showToast(`Gagal tarik data cloud: ${error.message}`, true);
    }
    return;
  }

  if (data?.state_json) {
    state = normalizeState(data.state_json);
    persist({ skipCloud: true });
    renderAll();
    setCloudStatus("Sinkron");
    if (!silent) {
      showToast("Data cloud berhasil dimuat.");
    }
    return;
  }

  await pushStateToCloud("init");
  setCloudStatus("Sinkron");
}

function scheduleCloudPush() {
  if (!canCloudSync()) {
    return;
  }
  if (cloudPushTimer) {
    clearTimeout(cloudPushTimer);
  }
  cloudPushTimer = setTimeout(() => {
    pushStateToCloud("auto");
  }, 500);
}

async function pushStateToCloud(mode = "auto") {
  const source = getCloudStateSource();
  if (!source) {
    return;
  }

  if (cloudSyncInProgress) {
    cloudPendingPush = true;
    return;
  }

  cloudSyncInProgress = true;
  setCloudStatus("Mengirim data...");
  const payload = {
    ...source.payload,
    state_json: state,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from(source.table)
    .upsert(payload, { onConflict: source.conflict });

  cloudSyncInProgress = false;
  const shouldPushAgain = cloudPendingPush;
  cloudPendingPush = false;

  if (error) {
    setCloudStatus("Cloud error");
    if (mode === "manual") {
      showToast(`Sync gagal: ${error.message}`, true);
    }
    if (shouldPushAgain) {
      pushStateToCloud("auto");
    }
    return;
  }

  setCloudStatus("Sinkron");
  if (mode === "manual") {
    showToast("Sync cloud berhasil.");
  }
  if (shouldPushAgain) {
    pushStateToCloud("auto");
  }
}

function hasPermission(permission) {
  if (!cloudUser || !appConfig?.SHARED_TEAM_MODE) {
    return true;
  }
  const role = normalizeRole(currentRole);
  if (role === "admin") return true;

  const matrix = {
    job_create: ["operasional"],
    advance_create: ["operasional"],
    advance_approve_ops: ["operasional"],
    advance_approve_finance: ["finance"],
    disbursement_manage: ["finance"],
    lpj_submit: ["operasional"],
    lpj_verify: ["finance"],
    settlement_manage: ["finance"],
    route_manage: ["operasional"]
  };
  const allowed = matrix[permission] || ["operasional", "finance"];
  return allowed.includes(role);
}

function guardPermission(permission, message) {
  if (hasPermission(permission)) {
    return true;
  }
  showToast(message || "Akses ditolak untuk role Anda.", true);
  return false;
}

function applyRolePermissions() {
  const controls = [
    { selector: "#jobForm button[type='submit']", permission: "job_create" },
    { selector: "#applyRouteStandardBtn", permission: "job_create" },
    { selector: "#advanceForm button[type='submit']", permission: "advance_create" },
    { selector: "#disbursementForm button[type='submit']", permission: "disbursement_manage" },
    { selector: "#lpjForm button[type='submit']", permission: "lpj_submit" },
    { selector: "#settlementForm button[type='submit']", permission: "settlement_manage" },
    { selector: "#routeForm button[type='submit']", permission: "route_manage" }
  ];

  controls.forEach((item) => {
    const el = document.querySelector(item.selector);
    if (!el) return;
    const allowed = hasPermission(item.permission);
    el.disabled = !allowed;
    el.title = allowed ? "" : "Role Anda tidak memiliki akses untuk aksi ini.";
  });
}

function seedInitialData() {
  if (state.routeStandards.length > 0) {
    return;
  }

  const seeds = [
    {
      route: "Tanjung Priok - Cikarang",
      distanceKm: 52,
      solar: 1200000,
      tol: 350000,
      meal: 150000,
      parking: 200000,
      other: 100000
    },
    {
      route: "Tanjung Priok - Karawang",
      distanceKm: 68,
      solar: 1350000,
      tol: 420000,
      meal: 150000,
      parking: 220000,
      other: 120000
    }
  ];

  seeds.forEach((item) => {
    state.seq.route += 1;
    state.routeStandards.push({
      id: `RTE-${String(state.seq.route).padStart(4, "0")}`,
      ...item
    });
  });
  persist();
}

function renderAll() {
  renderRouteStandardOptions();
  renderJobs();
  renderAdvanceJobOptions();
  renderAdvanceList();
  renderDisbursementFormOptions();
  renderDisbursementList();
  renderLpjDisbursementOptions();
  renderLpjList();
  renderVerificationList();
  renderSettlementFormOptions();
  renderSettlementHistory();
  renderRouteStandards();
  renderDashboard();
  renderReport();
  renderPrintRecordOptions();
  applyRolePermissions();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return cloneDefaultState();
  }
  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return cloneDefaultState();
  }
}

function normalizeState(parsed) {
  const base = cloneDefaultState();
  base.jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  base.advances = Array.isArray(parsed.advances) ? parsed.advances : [];
  base.disbursements = Array.isArray(parsed.disbursements) ? parsed.disbursements : [];
  base.lpjs = Array.isArray(parsed.lpjs) ? parsed.lpjs : [];
  base.settlements = Array.isArray(parsed.settlements) ? parsed.settlements : [];
  base.routeStandards = Array.isArray(parsed.routeStandards) ? parsed.routeStandards : [];
  base.seq = {
    job: parsed.seq?.job || base.jobs.length,
    advance: parsed.seq?.advance || base.advances.length,
    disbursement: parsed.seq?.disbursement || base.disbursements.length,
    lpj: parsed.seq?.lpj || base.lpjs.length,
    settlement: parsed.seq?.settlement || base.settlements.length,
    route: parsed.seq?.route || base.routeStandards.length
  };
  return base;
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function persist(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!options.skipCloud) {
    scheduleCloudPush();
  }
}

function showToast(message, isError = false) {
  const el = document.createElement("div");
  el.className = `toast${isError ? " error" : ""}`;
  el.textContent = message;
  els.toastWrap.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2500);
}

function makeDocNo(prefix, seqKey) {
  state.seq[seqKey] += 1;
  const period = new Date().toISOString().slice(0, 7).replace("-", "");
  return `${prefix}-${period}-${String(state.seq[seqKey]).padStart(4, "0")}`;
}

function toDateInputValue(dateObj) {
  return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function toDatetimeInputValue(dateObj) {
  return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function formatDate(input) {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(input) {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function sumCosts(costs) {
  return (Number(costs.solar) || 0) +
    (Number(costs.tol) || 0) +
    (Number(costs.meal) || 0) +
    (Number(costs.parking) || 0) +
    (Number(costs.other) || 0);
}

function safeText(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function updateJobTotal() {
  const total = sumCosts({
    solar: els.jobEstSolar.value,
    tol: els.jobEstTol.value,
    meal: els.jobEstMeal.value,
    parking: els.jobEstParking.value,
    other: els.jobEstOther.value
  });
  els.jobEstTotal.value = formatCurrency(total);
}

function updateLpjTotal() {
  const total = sumCosts({
    solar: els.lpjSolar.value,
    tol: els.lpjTol.value,
    meal: els.lpjMeal.value,
    parking: els.lpjParking.value,
    other: els.lpjOther.value
  });
  els.lpjTotal.value = formatCurrency(total);
}

function getJobById(jobId) {
  return state.jobs.find((item) => item.id === jobId) || null;
}

function getAdvanceById(advanceId) {
  return state.advances.find((item) => item.id === advanceId) || null;
}

function getDisbursementById(id) {
  return state.disbursements.find((item) => item.id === id) || null;
}

function getDisbursementByAdvanceId(advanceId) {
  return state.disbursements.find((item) => item.advanceId === advanceId) || null;
}

function getLpjByDisbursementId(disbursementId) {
  return state.lpjs.find((item) => item.disbursementId === disbursementId) || null;
}

function getSettlementByLpjId(lpjId) {
  return state.settlements.find((item) => item.lpjId === lpjId) || null;
}

function getJobProgress(jobId) {
  const advance = state.advances.find((item) => item.jobId === jobId);
  if (!advance) return "JO Dibuat";
  if (!advance.approvals.staff) return "Menunggu Approval Staff";
  if (!advance.approvals.manager) return "Menunggu Approval Manager";
  if (!advance.approvals.finance) return "Menunggu Approval Finance";
  const dis = getDisbursementByAdvanceId(advance.id);
  if (!dis) return "Siap Dicairkan";
  const lpj = getLpjByDisbursementId(dis.id);
  if (!lpj) return "Menunggu LPJ";
  if (!lpj.verifiedAt) return "Menunggu Verifikasi LPJ";
  const settlement = getSettlementByLpjId(lpj.id);
  if (!settlement) return "Menunggu Settlement";
  return "Closed";
}

function isDriverBlocked(driverName, excludeJobId = "") {
  const normalized = driverName.trim().toLowerCase();
  if (!normalized) return false;
  return state.disbursements.some((dis) => {
    if (excludeJobId && dis.jobId === excludeJobId) {
      return false;
    }
    if (dis.driver.trim().toLowerCase() !== normalized) {
      return false;
    }
    const lpj = getLpjByDisbursementId(dis.id);
    return !lpj;
  });
}

function calculateDifference(lpj) {
  const disbursement = getDisbursementById(lpj.disbursementId);
  const advanceAmount = Number(disbursement?.amount) || 0;
  return advanceAmount - Number(lpj.totalRealization || 0);
}

function getDifferenceType(diff) {
  if (diff > 0) return "Pengembalian Sisa";
  if (diff < 0) return "Reimbursement";
  return "Nihil";
}

function getMonthKey(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 7);
}

function submitJobOrder(event) {
  event.preventDefault();
  if (!guardPermission("job_create", "Role Anda tidak boleh membuat Job Order.")) {
    return;
  }

  const costs = {
    solar: Number(els.jobEstSolar.value) || 0,
    tol: Number(els.jobEstTol.value) || 0,
    meal: Number(els.jobEstMeal.value) || 0,
    parking: Number(els.jobEstParking.value) || 0,
    other: Number(els.jobEstOther.value) || 0
  };
  const totalEstimate = sumCosts(costs);

  const job = {
    id: makeDocNo("JOB", "job"),
    createdAt: new Date().toISOString(),
    customer: els.jobCustomer.value.trim(),
    doSp2: els.jobDoSp2.value.trim(),
    containerNo: els.jobContainerNo.value.trim(),
    containerSize: els.jobContainerSize.value,
    route: els.jobRoute.value.trim(),
    driver: els.jobDriver.value.trim(),
    truck: els.jobTruck.value.trim(),
    loadingDate: els.jobLoadingDate.value,
    etaReturnDate: els.jobEtaReturnDate.value,
    distanceKmPlan: Number(els.jobDistanceKm.value) || 0,
    estimatedCosts: costs,
    estimatedTotal: totalEstimate
  };

  if (!job.route || !job.driver || !job.truck || !job.loadingDate || !job.etaReturnDate) {
    showToast("Data Job Order belum lengkap.", true);
    return;
  }

  if (new Date(job.etaReturnDate) < new Date(job.loadingDate)) {
    showToast("Estimasi kembali pool tidak boleh sebelum tanggal loading.", true);
    return;
  }

  state.jobs.unshift(job);
  persist();

  event.target.reset();
  els.jobContainerSize.value = "20";
  updateJobTotal();
  showToast(`Job Order ${job.id} berhasil dibuat.`);
  renderAll();
}

function applyRouteStandardToJob() {
  if (!guardPermission("job_create", "Role Anda tidak boleh mengubah estimasi Job Order.")) {
    return;
  }
  const route = els.jobRoute.value.trim().toLowerCase();
  if (!route) {
    showToast("Isi rute terlebih dahulu.", true);
    return;
  }
  const std = state.routeStandards.find((item) => item.route.toLowerCase() === route);
  if (!std) {
    showToast("Master rute tidak ditemukan.", true);
    return;
  }
  els.jobDistanceKm.value = std.distanceKm;
  els.jobEstSolar.value = std.solar;
  els.jobEstTol.value = std.tol;
  els.jobEstMeal.value = std.meal;
  els.jobEstParking.value = std.parking;
  els.jobEstOther.value = std.other;
  updateJobTotal();
  showToast("Estimasi terisi dari master rute.");
}

function renderJobs() {
  if (state.jobs.length === 0) {
    els.jobsTableBody.innerHTML = emptyRow("Belum ada Job Order.");
    return;
  }

  const rows = state.jobs.map((job) => {
    const progress = getJobProgress(job.id);
    return `
      <tr>
        <td>${safeText(job.id)}</td>
        <td>${safeText(job.customer)}</td>
        <td>${safeText(job.route)}</td>
        <td>${safeText(job.driver)}</td>
        <td>${safeText(job.truck)}</td>
        <td>${formatCurrency(job.estimatedTotal)}</td>
        <td>${statusTag(progress)}</td>
      </tr>
    `;
  });
  els.jobsTableBody.innerHTML = rows.join("");
}

function renderAdvanceJobOptions() {
  const eligibleJobs = state.jobs.filter((job) => {
    const progress = getJobProgress(job.id);
    return progress === "JO Dibuat";
  });
  const options = [`<option value="">Pilih Job Order</option>`];
  eligibleJobs.forEach((job) => {
    options.push(`<option value="${safeText(job.id)}">${safeText(job.id)} - ${safeText(job.driver)} (${safeText(job.route)})</option>`);
  });
  els.advanceJobId.innerHTML = options.join("");
  fillAdvanceFormFromJob();
}

function fillAdvanceFormFromJob() {
  const job = getJobById(els.advanceJobId.value);
  if (!job) {
    els.advanceDriver.value = "";
    els.advanceTruck.value = "";
    els.advanceRoute.value = "";
    els.advanceEstimate.value = "";
    els.advanceRequestedAmount.value = "";
    return;
  }
  els.advanceDriver.value = job.driver;
  els.advanceTruck.value = job.truck;
  els.advanceRoute.value = job.route;
  els.advanceEstimate.value = formatCurrency(job.estimatedTotal);
  els.advanceRequestedAmount.value = job.estimatedTotal;
}

function submitAdvanceRequest(event) {
  event.preventDefault();
  if (!guardPermission("advance_create", "Role Anda tidak boleh membuat pengajuan uang jalan.")) {
    return;
  }
  const job = getJobById(els.advanceJobId.value);
  if (!job) {
    showToast("Pilih Job Order terlebih dahulu.", true);
    return;
  }

  if (isDriverBlocked(job.driver, job.id)) {
    showToast(`Driver ${job.driver} masih punya job tanpa LPJ. Pengajuan ditolak.`, true);
    return;
  }

  const requestAmount = Number(els.advanceRequestedAmount.value) || 0;
  if (requestAmount <= 0) {
    showToast("Nominal pengajuan harus lebih dari 0.", true);
    return;
  }

  const advance = {
    id: makeDocNo("UJD", "advance"),
    createdAt: new Date().toISOString(),
    requestDate: els.advanceDate.value,
    jobId: job.id,
    driver: job.driver,
    truck: job.truck,
    route: job.route,
    estimateAmount: job.estimatedTotal,
    requestedAmount: requestAmount,
    paymentType: els.advancePaymentType.value,
    approvals: {
      staff: null,
      manager: null,
      finance: null
    }
  };

  state.advances.unshift(advance);
  persist();

  event.target.reset();
  els.advanceDate.value = toDateInputValue(new Date());
  showToast(`Pengajuan ${advance.id} berhasil dibuat.`);
  renderAll();
}

function advanceStatus(advance) {
  if (!advance.approvals.staff) return "Menunggu Staff Operasional";
  if (!advance.approvals.manager) return "Menunggu Manager Operasional";
  if (!advance.approvals.finance) return "Menunggu Finance";
  const dis = getDisbursementByAdvanceId(advance.id);
  if (!dis) return "Siap Dicairkan";
  const lpj = getLpjByDisbursementId(dis.id);
  if (!lpj) return "Menunggu LPJ";
  if (!lpj.verifiedAt) return "Menunggu Verifikasi LPJ";
  const st = getSettlementByLpjId(lpj.id);
  if (!st) return "Menunggu Settlement";
  return "Closed";
}

function renderAdvanceList() {
  if (state.advances.length === 0) {
    els.advanceTableBody.innerHTML = emptyRow("Belum ada pengajuan uang jalan.");
    return;
  }
  const rows = state.advances.map((advance) => {
    const status = advanceStatus(advance);
    const actions = [];
    if (!advance.approvals.staff) {
      if (hasPermission("advance_approve_ops")) {
        actions.push(`<button type="button" data-action="staff-approve" data-id="${safeText(advance.id)}">Approve Staff</button>`);
      } else {
        actions.push("<span>-</span>");
      }
    } else if (!advance.approvals.manager) {
      if (hasPermission("advance_approve_ops")) {
        actions.push(`<button type="button" data-action="manager-approve" data-id="${safeText(advance.id)}">Approve Manager</button>`);
      } else {
        actions.push("<span>-</span>");
      }
    } else if (!advance.approvals.finance) {
      if (hasPermission("advance_approve_finance")) {
        actions.push(`<button type="button" data-action="finance-approve" data-id="${safeText(advance.id)}">Approve Finance</button>`);
      } else {
        actions.push("<span>-</span>");
      }
    } else {
      actions.push("<span>-</span>");
    }

    return `
      <tr>
        <td>${safeText(advance.id)}</td>
        <td>${safeText(advance.jobId)}</td>
        <td>${safeText(advance.driver)}</td>
        <td>${formatCurrency(advance.requestedAmount)}</td>
        <td>${statusTag(status)}</td>
        <td><div class="row-actions">${actions.join("")}</div></td>
      </tr>
    `;
  });
  els.advanceTableBody.innerHTML = rows.join("");
}

function onAdvanceActionClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const advance = getAdvanceById(id);
  if (!advance) return;

  if (action === "staff-approve") {
    if (!guardPermission("advance_approve_ops", "Role Anda tidak boleh approval operasional.")) {
      return;
    }
    advance.approvals.staff = new Date().toISOString();
    showToast(`Pengajuan ${advance.id} disetujui Staff Operasional.`);
  } else if (action === "manager-approve") {
    if (!guardPermission("advance_approve_ops", "Role Anda tidak boleh approval operasional.")) {
      return;
    }
    if (!advance.approvals.staff) {
      showToast("Approval Staff belum ada.", true);
      return;
    }
    advance.approvals.manager = new Date().toISOString();
    showToast(`Pengajuan ${advance.id} disetujui Manager Operasional.`);
  } else if (action === "finance-approve") {
    if (!guardPermission("advance_approve_finance", "Role Anda tidak boleh approval finance.")) {
      return;
    }
    if (!advance.approvals.manager) {
      showToast("Approval Manager belum ada.", true);
      return;
    }
    if (isDriverBlocked(advance.driver, advance.jobId)) {
      showToast(`Driver ${advance.driver} masih punya LPJ tertunda. Approval Finance ditolak.`, true);
      return;
    }
    advance.approvals.finance = new Date().toISOString();
    showToast(`Pengajuan ${advance.id} disetujui Finance.`);
  }
  persist();
  renderAll();
}

function renderDisbursementFormOptions() {
  const ready = state.advances.filter((item) => item.approvals.finance && !getDisbursementByAdvanceId(item.id));
  const options = [`<option value="">Pilih Pengajuan</option>`];
  ready.forEach((item) => {
    options.push(`<option value="${safeText(item.id)}">${safeText(item.id)} - ${safeText(item.driver)} (${formatCurrency(item.requestedAmount)})</option>`);
  });
  els.disbursementAdvanceId.innerHTML = options.join("");
  fillDisbursementForm();
}

function fillDisbursementForm() {
  const advance = getAdvanceById(els.disbursementAdvanceId.value);
  if (!advance) {
    els.disbursementDriver.value = "";
    els.disbursementTruck.value = "";
    els.disbursementAmount.value = "";
    return;
  }
  els.disbursementDriver.value = advance.driver;
  els.disbursementTruck.value = advance.truck;
  els.disbursementAmount.value = formatCurrency(advance.requestedAmount);
  els.disbursementMethod.value = advance.paymentType;
}

function submitDisbursement(event) {
  event.preventDefault();
  if (!guardPermission("disbursement_manage", "Role Anda tidak boleh mencairkan uang jalan.")) {
    return;
  }
  const advance = getAdvanceById(els.disbursementAdvanceId.value);
  if (!advance) {
    showToast("Pilih pengajuan yang akan dicairkan.", true);
    return;
  }
  if (!advance.approvals.finance) {
    showToast("Pengajuan belum disetujui finance.", true);
    return;
  }

  const disbursement = {
    id: makeDocNo("REG", "disbursement"),
    createdAt: new Date().toISOString(),
    date: els.disbursementDate.value,
    advanceId: advance.id,
    jobId: advance.jobId,
    driver: advance.driver,
    truck: advance.truck,
    amount: advance.requestedAmount,
    method: els.disbursementMethod.value,
    note: els.disbursementNote.value.trim()
  };

  state.disbursements.unshift(disbursement);
  persist();

  event.target.reset();
  els.disbursementDate.value = toDateInputValue(new Date());
  showToast(`Uang jalan dicairkan (${disbursement.id}).`);
  renderAll();
}

function renderDisbursementList() {
  if (state.disbursements.length === 0) {
    els.disbursementTableBody.innerHTML = emptyRow("Belum ada pencairan uang jalan.");
    return;
  }
  const rows = state.disbursements.map((item) => `
    <tr>
      <td>${safeText(item.id)}</td>
      <td>${formatDate(item.date)}</td>
      <td>${safeText(item.driver)}</td>
      <td>${safeText(item.truck)}</td>
      <td>${safeText(item.jobId)}</td>
      <td>${safeText(item.method)}</td>
      <td>${formatCurrency(item.amount)}</td>
    </tr>
  `);
  els.disbursementTableBody.innerHTML = rows.join("");
}

function renderLpjDisbursementOptions() {
  const openDisbursements = state.disbursements.filter((item) => !getLpjByDisbursementId(item.id));
  const options = [`<option value="">Pilih Register</option>`];
  openDisbursements.forEach((item) => {
    options.push(`<option value="${safeText(item.id)}">${safeText(item.id)} - ${safeText(item.driver)} (${safeText(item.jobId)})</option>`);
  });
  els.lpjDisbursementId.innerHTML = options.join("");
  fillLpjFormFromDisbursement();
}

function fillLpjFormFromDisbursement() {
  const dis = getDisbursementById(els.lpjDisbursementId.value);
  if (!dis) {
    els.lpjJobNo.value = "";
    els.lpjDriver.value = "";
    els.lpjTruck.value = "";
    els.lpjActualDistance.value = "";
    return;
  }
  const job = getJobById(dis.jobId);
  els.lpjJobNo.value = dis.jobId;
  els.lpjDriver.value = dis.driver;
  els.lpjTruck.value = dis.truck;
  els.lpjActualDistance.value = job?.distanceKmPlan || 0;
  const now = new Date();
  els.lpjReturnDatetime.value = toDatetimeInputValue(now);
  els.lpjSubmitDatetime.value = toDatetimeInputValue(now);
}

function submitLpj(event) {
  event.preventDefault();
  if (!guardPermission("lpj_submit", "Role Anda tidak boleh membuat LPJ.")) {
    return;
  }
  const dis = getDisbursementById(els.lpjDisbursementId.value);
  if (!dis) {
    showToast("Pilih register uang jalan.", true);
    return;
  }

  if (!els.proofOriginalRequired.checked) {
    showToast("Bukti asli wajib dikonfirmasi.", true);
    return;
  }

  const returnAt = new Date(els.lpjReturnDatetime.value);
  const submitAt = new Date(els.lpjSubmitDatetime.value);
  if (Number.isNaN(returnAt.getTime()) || Number.isNaN(submitAt.getTime())) {
    showToast("Tanggal LPJ tidak valid.", true);
    return;
  }
  if (submitAt < returnAt) {
    showToast("Tanggal submit LPJ tidak boleh sebelum kembali ke pool.", true);
    return;
  }

  const actualCosts = {
    solar: Number(els.lpjSolar.value) || 0,
    tol: Number(els.lpjTol.value) || 0,
    parking: Number(els.lpjParking.value) || 0,
    meal: Number(els.lpjMeal.value) || 0,
    other: Number(els.lpjOther.value) || 0
  };
  const totalRealization = sumCosts(actualCosts);

  const diffMs = submitAt.getTime() - returnAt.getTime();
  const isLate = diffMs > ONE_DAY_MS;

  const lpj = {
    id: makeDocNo("LPJ", "lpj"),
    createdAt: new Date().toISOString(),
    disbursementId: dis.id,
    jobId: dis.jobId,
    driver: dis.driver,
    truck: dis.truck,
    returnAt: returnAt.toISOString(),
    submitAt: submitAt.toISOString(),
    actualDistanceKm: Number(els.lpjActualDistance.value) || 0,
    actualCosts,
    totalRealization,
    proofs: {
      fuel: els.proofFuel.checked,
      toll: els.proofToll.checked,
      parking: els.proofParking.checked,
      weighing: els.proofWeighing.checked,
      repair: els.proofRepair.checked,
      originalConfirmed: els.proofOriginalRequired.checked
    },
    notes: els.lpjNotes.value.trim(),
    isLate,
    verifiedAt: null
  };

  state.lpjs.unshift(lpj);
  persist();

  event.target.reset();
  els.lpjSubmitDatetime.value = toDatetimeInputValue(new Date());
  showToast(`LPJ ${lpj.id} berhasil dikirim${isLate ? " (terlambat)" : ""}.`, isLate);
  renderAll();
}

function renderLpjList() {
  if (state.lpjs.length === 0) {
    els.lpjTableBody.innerHTML = emptyRow("Belum ada LPJ.");
    return;
  }
  const rows = state.lpjs.map((lpj) => {
    const dis = getDisbursementById(lpj.disbursementId);
    const diff = calculateDifference(lpj);
    return `
      <tr>
        <td>${safeText(lpj.id)}</td>
        <td>${safeText(lpj.jobId)}</td>
        <td>${safeText(lpj.driver)}</td>
        <td>${formatCurrency(dis?.amount || 0)}</td>
        <td>${formatCurrency(lpj.totalRealization)}</td>
        <td>${formatCurrency(diff)}</td>
        <td>${lpj.isLate ? statusTag("Terlambat", "danger") : statusTag("On Time", "ok")}</td>
        <td>${lpj.verifiedAt ? statusTag("Terverifikasi", "ok") : statusTag("Belum Verifikasi", "warn")}</td>
      </tr>
    `;
  });
  els.lpjTableBody.innerHTML = rows.join("");
}

function renderVerificationList() {
  if (state.lpjs.length === 0) {
    els.verificationTableBody.innerHTML = emptyRow("Belum ada LPJ untuk diverifikasi.");
    return;
  }
  const rows = state.lpjs.map((lpj) => {
    const diff = calculateDifference(lpj);
    const settlement = getSettlementByLpjId(lpj.id);
    const action = lpj.verifiedAt
      ? "<span>-</span>"
      : hasPermission("lpj_verify")
        ? `<button type="button" data-action="verify-lpj" data-id="${safeText(lpj.id)}">Verifikasi LPJ</button>`
        : "<span>-</span>";
    const status = settlement
      ? statusTag("Sudah Settled", "ok")
      : lpj.verifiedAt
        ? statusTag("Siap Settlement", "neutral")
        : statusTag("Menunggu Verifikasi", "warn");

    return `
      <tr>
        <td>${safeText(lpj.id)}</td>
        <td>${safeText(lpj.jobId)}</td>
        <td>${safeText(lpj.driver)}</td>
        <td>${formatCurrency(diff)}</td>
        <td>${status}</td>
        <td><div class="row-actions">${action}</div></td>
      </tr>
    `;
  });
  els.verificationTableBody.innerHTML = rows.join("");
}

function onVerificationClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action !== "verify-lpj") return;
  if (!guardPermission("lpj_verify", "Role Anda tidak boleh verifikasi LPJ.")) {
    return;
  }

  const lpj = state.lpjs.find((item) => item.id === id);
  if (!lpj) return;
  lpj.verifiedAt = new Date().toISOString();
  persist();
  showToast(`LPJ ${lpj.id} diverifikasi finance.`);
  renderAll();
}

function renderSettlementFormOptions() {
  const open = state.lpjs.filter((lpj) => lpj.verifiedAt && !getSettlementByLpjId(lpj.id));
  const options = [`<option value="">Pilih LPJ</option>`];
  open.forEach((lpj) => {
    options.push(`<option value="${safeText(lpj.id)}">${safeText(lpj.id)} - ${safeText(lpj.driver)} (${safeText(lpj.jobId)})</option>`);
  });
  els.settlementLpjId.innerHTML = options.join("");
  fillSettlementFormFromLpj();
}

function fillSettlementFormFromLpj() {
  const lpj = state.lpjs.find((item) => item.id === els.settlementLpjId.value);
  if (!lpj) {
    els.settlementAdvanceAmount.value = "";
    els.settlementActualAmount.value = "";
    els.settlementDifference.value = "";
    els.settlementType.value = "";
    return;
  }

  const dis = getDisbursementById(lpj.disbursementId);
  const advance = Number(dis?.amount) || 0;
  const actual = Number(lpj.totalRealization) || 0;
  const diff = advance - actual;

  els.settlementAdvanceAmount.value = formatCurrency(advance);
  els.settlementActualAmount.value = formatCurrency(actual);
  els.settlementDifference.value = formatCurrency(diff);
  els.settlementType.value = getDifferenceType(diff);
}

function submitSettlement(event) {
  event.preventDefault();
  if (!guardPermission("settlement_manage", "Role Anda tidak boleh memproses settlement.")) {
    return;
  }
  const lpj = state.lpjs.find((item) => item.id === els.settlementLpjId.value);
  if (!lpj) {
    showToast("Pilih LPJ untuk settlement.", true);
    return;
  }
  if (!lpj.verifiedAt) {
    showToast("LPJ belum diverifikasi finance.", true);
    return;
  }

  const dis = getDisbursementById(lpj.disbursementId);
  const advanceAmount = Number(dis?.amount) || 0;
  const actualAmount = Number(lpj.totalRealization) || 0;
  const diff = advanceAmount - actualAmount;
  const type = getDifferenceType(diff);
  const bonus = diff > 100000 ? Math.round(diff * 0.2) : 0;

  const settlement = {
    id: makeDocNo("STL", "settlement"),
    createdAt: new Date().toISOString(),
    processedDate: els.settlementDate.value,
    lpjId: lpj.id,
    jobId: lpj.jobId,
    driver: lpj.driver,
    truck: lpj.truck,
    type,
    difference: diff,
    method: els.settlementMethod.value,
    amountAdvance: advanceAmount,
    amountActual: actualAmount,
    bonus
  };

  state.settlements.unshift(settlement);
  persist();

  const bonusMessage = bonus > 0 ? ` Bonus efisiensi ${formatCurrency(bonus)}.` : "";
  showToast(`Settlement ${settlement.id} tersimpan.${bonusMessage}`);
  event.target.reset();
  els.settlementDate.value = toDateInputValue(new Date());
  renderAll();
}

function renderSettlementHistory() {
  if (state.settlements.length === 0) {
    els.settlementTableBody.innerHTML = emptyRow("Belum ada settlement.");
    return;
  }
  const rows = state.settlements.map((item) => {
    const nominal = item.type === "Reimbursement" ? Math.abs(item.difference) : Math.max(item.difference, 0);
    return `
      <tr>
        <td>${safeText(item.id)}</td>
        <td>${safeText(item.jobId)}</td>
        <td>${safeText(item.driver)}</td>
        <td>${statusTag(item.type, item.type === "Reimbursement" ? "danger" : "ok")}</td>
        <td>${formatCurrency(nominal)}</td>
        <td>${formatCurrency(item.bonus || 0)}</td>
        <td>${formatDate(item.processedDate)}</td>
        <td>${safeText(item.method)}</td>
      </tr>
    `;
  });
  els.settlementTableBody.innerHTML = rows.join("");
}

function renderDashboard() {
  const totalJobs = state.jobs.length;
  const activeJobs = state.jobs.filter((job) => getJobProgress(job.id) !== "Closed").length;
  const overdue = getOverdueLpjCount();
  const monthKey = new Date().toISOString().slice(0, 7);

  let advanceMonth = 0;
  let returnMonth = 0;
  let reimburseMonth = 0;

  state.disbursements.forEach((item) => {
    if (getMonthKey(item.date) === monthKey) {
      advanceMonth += Number(item.amount) || 0;
    }
  });
  state.settlements.forEach((item) => {
    if (getMonthKey(item.processedDate) === monthKey) {
      if (item.type === "Pengembalian Sisa") {
        returnMonth += Math.max(item.difference, 0);
      } else if (item.type === "Reimbursement") {
        reimburseMonth += Math.abs(item.difference);
      }
    }
  });

  els.kpiTotalJob.textContent = String(totalJobs);
  els.kpiActiveJob.textContent = String(activeJobs);
  els.kpiOverdue.textContent = String(overdue);
  els.kpiAdvanceMonth.textContent = formatCurrency(advanceMonth);
  els.kpiReturnMonth.textContent = formatCurrency(returnMonth);
  els.kpiReimburseMonth.textContent = formatCurrency(reimburseMonth);

  renderDashboardQueue();
}

function getOverdueLpjCount() {
  const now = Date.now();
  return state.disbursements.filter((dis) => {
    const lpj = getLpjByDisbursementId(dis.id);
    if (lpj) return false;
    const job = getJobById(dis.jobId);
    if (!job?.etaReturnDate) return false;
    const due = new Date(job.etaReturnDate).getTime() + ONE_DAY_MS;
    return now > due;
  }).length;
}

function renderDashboardQueue() {
  const rows = [];
  state.advances.forEach((item) => {
    const status = advanceStatus(item);
    if (
      status === "Menunggu Staff Operasional" ||
      status === "Menunggu Manager Operasional" ||
      status === "Menunggu Finance"
    ) {
      rows.push({
        category: "Approval Uang Jalan",
        docNo: item.id,
        driver: item.driver,
        status,
        info: `${item.jobId} - ${formatCurrency(item.requestedAmount)}`
      });
    }
  });

  state.disbursements.forEach((item) => {
    if (!getLpjByDisbursementId(item.id)) {
      const job = getJobById(item.jobId);
      const eta = job?.etaReturnDate ? formatDate(job.etaReturnDate) : "-";
      rows.push({
        category: "LPJ Pending",
        docNo: item.id,
        driver: item.driver,
        status: "Menunggu LPJ",
        info: `ETA kembali ${eta}`
      });
    }
  });

  if (rows.length === 0) {
    els.dashboardQueueBody.innerHTML = emptyRow("Tidak ada antrian tindakan.");
    return;
  }

  els.dashboardQueueBody.innerHTML = rows
    .slice(0, 30)
    .map((item) => `
      <tr>
        <td>${safeText(item.category)}</td>
        <td>${safeText(item.docNo)}</td>
        <td>${safeText(item.driver)}</td>
        <td>${statusTag(item.status)}</td>
        <td>${safeText(item.info)}</td>
      </tr>
    `)
    .join("");
}

function onReportFilterSubmit(event) {
  event.preventDefault();
  renderReport();
}

function renderReport() {
  const month = els.reportMonth.value || new Date().toISOString().slice(0, 7);
  const rowsByKey = new Map();
  let totalJobs = 0;
  let totalCost = 0;
  let totalAdvance = 0;
  let totalBonus = 0;

  state.settlements.forEach((settlement) => {
    if (getMonthKey(settlement.processedDate) !== month) {
      return;
    }
    const lpj = state.lpjs.find((item) => item.id === settlement.lpjId);
    if (!lpj) return;
    const dis = getDisbursementById(lpj.disbursementId);
    if (!dis) return;

    const key = `${lpj.truck}__${lpj.driver}`;
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, {
        truck: lpj.truck,
        driver: lpj.driver,
        totalJobs: 0,
        totalCost: 0,
        totalAdvance: 0,
        totalSolar: 0,
        totalKm: 0,
        totalBonus: 0
      });
    }
    const row = rowsByKey.get(key);
    row.totalJobs += 1;
    row.totalCost += Number(lpj.totalRealization) || 0;
    row.totalAdvance += Number(dis.amount) || 0;
    row.totalSolar += Number(lpj.actualCosts?.solar) || 0;
    row.totalKm += Number(lpj.actualDistanceKm) || 0;
    row.totalBonus += Number(settlement.bonus) || 0;

    totalJobs += 1;
    totalCost += Number(lpj.totalRealization) || 0;
    totalAdvance += Number(dis.amount) || 0;
    totalBonus += Number(settlement.bonus) || 0;
  });

  currentReportRows = Array.from(rowsByKey.values()).map((row) => {
    const solarPerKm = row.totalKm > 0 ? row.totalSolar / row.totalKm : 0;
    const costPerKm = row.totalKm > 0 ? row.totalCost / row.totalKm : 0;
    const efficiency = row.totalAdvance > 0 ? ((row.totalAdvance - row.totalCost) / row.totalAdvance) * 100 : 0;
    return {
      ...row,
      solarPerKm,
      costPerKm,
      efficiency
    };
  });

  if (currentReportRows.length === 0) {
    els.reportTableBody.innerHTML = emptyRow("Belum ada data settlement pada bulan ini.");
  } else {
    els.reportTableBody.innerHTML = currentReportRows
      .sort((a, b) => b.totalJobs - a.totalJobs)
      .map((row) => `
        <tr>
          <td>${safeText(row.truck)}</td>
          <td>${safeText(row.driver)}</td>
          <td>${row.totalJobs}</td>
          <td>${formatCurrency(row.totalCost)}</td>
          <td>${formatCurrency(row.solarPerKm)}</td>
          <td>${formatCurrency(row.costPerKm)}</td>
          <td>${row.efficiency.toFixed(2)}%</td>
          <td>${formatCurrency(row.totalBonus)}</td>
        </tr>
      `)
      .join("");
  }

  els.reportTotalJobs.textContent = String(totalJobs);
  els.reportTotalCost.textContent = formatCurrency(totalCost);
  els.reportTotalAdvance.textContent = formatCurrency(totalAdvance);
  els.reportTotalBonus.textContent = formatCurrency(totalBonus);
}

function exportReportCsv() {
  if (currentReportRows.length === 0) {
    showToast("Tidak ada data laporan untuk di-export.", true);
    return;
  }
  const lines = [
    [
      "Truck",
      "Driver",
      "Total Job",
      "Total Biaya",
      "Total Uang Jalan",
      "Solar per KM",
      "Biaya per KM",
      "Efisiensi (%)",
      "Bonus"
    ].join(",")
  ];

  currentReportRows.forEach((row) => {
    lines.push(
      [
        csvCell(row.truck),
        csvCell(row.driver),
        row.totalJobs,
        row.totalCost,
        row.totalAdvance,
        row.solarPerKm.toFixed(2),
        row.costPerKm.toFixed(2),
        row.efficiency.toFixed(2),
        row.totalBonus
      ].join(",")
    );
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-trucking-${els.reportMonth.value || "bulanan"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Laporan CSV berhasil diunduh.");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function submitRouteStandard(event) {
  event.preventDefault();
  if (!guardPermission("route_manage", "Role Anda tidak boleh mengelola master rute.")) {
    return;
  }
  const routeName = els.routeName.value.trim();
  if (!routeName) {
    showToast("Nama rute wajib diisi.", true);
    return;
  }
  const payload = {
    route: routeName,
    distanceKm: Number(els.routeDistance.value) || 0,
    solar: Number(els.routeSolar.value) || 0,
    tol: Number(els.routeTol.value) || 0,
    meal: Number(els.routeMeal.value) || 0,
    parking: Number(els.routeParking.value) || 0,
    other: Number(els.routeOther.value) || 0
  };

  const existing = state.routeStandards.find((item) => item.route.toLowerCase() === routeName.toLowerCase());
  if (existing) {
    Object.assign(existing, payload);
    showToast("Master rute diperbarui.");
  } else {
    state.seq.route += 1;
    state.routeStandards.unshift({
      id: `RTE-${String(state.seq.route).padStart(4, "0")}`,
      ...payload
    });
    showToast("Master rute ditambahkan.");
  }

  persist();
  event.target.reset();
  renderAll();
}

function renderRouteStandards() {
  if (state.routeStandards.length === 0) {
    els.routeTableBody.innerHTML = emptyRow("Belum ada master rute.");
    return;
  }
  const rows = state.routeStandards.map((item) => {
    const total = sumCosts(item);
    return `
      <tr>
        <td>${safeText(item.route)}</td>
        <td>${safeText(item.distanceKm)} KM</td>
        <td>${formatCurrency(item.solar)}</td>
        <td>${formatCurrency(item.tol)}</td>
        <td>${formatCurrency(item.meal)}</td>
        <td>${formatCurrency(item.parking)}</td>
        <td>${formatCurrency(item.other)}</td>
        <td>${formatCurrency(total)}</td>
      </tr>
    `;
  });
  els.routeTableBody.innerHTML = rows.join("");
}

function renderRouteStandardOptions() {
  els.routeOptions.innerHTML = state.routeStandards
    .map((item) => `<option value="${safeText(item.route)}"></option>`)
    .join("");
}

function renderPrintRecordOptions() {
  const docType = els.printDocType.value || "job";
  const previous = els.printRecordId.value;
  const records = getPrintRecordsByType(docType);
  const options = [];

  if (records.length === 0) {
    options.push("<option value=\"\">Data tidak tersedia</option>");
  } else {
    options.push("<option value=\"\">Pilih Nomor Dokumen</option>");
    records.forEach((record) => {
      options.push(`<option value="${safeText(record.id)}">${safeText(record.label)}</option>`);
    });
  }

  els.printRecordId.innerHTML = options.join("");
  if (records.length > 0) {
    const hasPrevious = records.some((item) => item.id === previous);
    els.printRecordId.value = hasPrevious ? previous : records[0].id;
  }
  renderPrintPreview();
}

function getPrintRecordsByType(docType) {
  if (docType === "job") {
    return state.jobs.map((job) => ({
      id: job.id,
      label: `${job.id} - ${job.customer} - ${job.driver}`
    }));
  }
  if (docType === "advance") {
    return state.advances.map((advance) => ({
      id: advance.id,
      label: `${advance.id} - ${advance.jobId} - ${advance.driver}`
    }));
  }
  if (docType === "lpj") {
    return state.lpjs.map((lpj) => ({
      id: lpj.id,
      label: `${lpj.id} - ${lpj.jobId} - ${lpj.driver}`
    }));
  }
  if (docType === "cash-receipt") {
    return state.settlements
      .filter((item) => item.type === "Pengembalian Sisa")
      .map((item) => ({
        id: item.id,
        label: `${item.id} - ${item.jobId} - ${item.driver}`
      }));
  }
  return [];
}

function renderPrintPreview() {
  const ctx = getCurrentPrintContext(false);
  if (!ctx) {
    els.printPreview.innerHTML = "";
    els.printPreviewEmpty.textContent = "Pilih jenis dokumen dan nomor dokumen, lalu klik preview.";
    els.printPreviewEmpty.style.display = "block";
    return;
  }
  els.printPreview.innerHTML = ctx.documentHtml;
  els.printPreviewEmpty.style.display = "none";
}

function printCurrentDocument() {
  const ctx = getCurrentPrintContext(true);
  if (!ctx) return;

  // Pastikan dokumen terbaru tampil di preview.
  els.printPreview.innerHTML = ctx.documentHtml;
  els.printPreviewEmpty.style.display = "none";

  const previousTitle = document.title;
  const cleanup = () => {
    if (inlinePrintCleanupTimer) {
      clearTimeout(inlinePrintCleanupTimer);
      inlinePrintCleanupTimer = null;
    }
    document.body.classList.remove("inline-print-mode");
    document.title = previousTitle;
  };

  document.title = ctx.title;
  document.body.classList.add("inline-print-mode");

  const onAfterPrint = () => {
    window.removeEventListener("afterprint", onAfterPrint);
    cleanup();
  };
  window.addEventListener("afterprint", onAfterPrint, { once: true });

  // Fallback jika event afterprint tidak terpicu pada browser tertentu.
  inlinePrintCleanupTimer = setTimeout(() => {
    window.removeEventListener("afterprint", onAfterPrint);
    cleanup();
  }, 2500);

  try {
    window.print();
  } catch (_error) {
    cleanup();
    showToast("Browser gagal membuka dialog print.", true);
    return;
  }
}

function getCurrentPrintContext(showError) {
  const docType = els.printDocType.value || "job";
  const recordId = els.printRecordId.value;
  const companyName = (els.printCompanyName.value || "").trim() || "PT _________________________";
  const printDate = els.printDate.value || toDateInputValue(new Date());

  if (!recordId) {
    if (showError) {
      showToast("Pilih nomor dokumen yang akan dicetak.", true);
    }
    return null;
  }

  const documentHtml = buildPrintDocumentHtml(docType, recordId, companyName, printDate);
  if (!documentHtml) {
    if (showError) {
      showToast("Data dokumen tidak ditemukan.", true);
    }
    return null;
  }

  const titleMap = {
    job: "Form Job Order",
    advance: "Form Pengajuan Uang Jalan",
    lpj: "Form LPJ Uang Jalan",
    "cash-receipt": "Bukti Penerimaan Kas"
  };

  return {
    docType,
    recordId,
    title: `${titleMap[docType] || "Dokumen"} - ${recordId}`,
    documentHtml
  };
}

function buildPrintDocumentHtml(docType, recordId, companyName, printDate) {
  if (docType === "job") {
    const job = getJobById(recordId);
    if (!job) return "";
    return buildJobOrderPrintHtml(job, companyName, printDate);
  }
  if (docType === "advance") {
    const advance = getAdvanceById(recordId);
    if (!advance) return "";
    return buildAdvancePrintHtml(advance, companyName, printDate);
  }
  if (docType === "lpj") {
    const lpj = state.lpjs.find((item) => item.id === recordId);
    if (!lpj) return "";
    return buildLpjPrintHtml(lpj, companyName, printDate);
  }
  if (docType === "cash-receipt") {
    const settlement = state.settlements.find((item) => item.id === recordId && item.type === "Pengembalian Sisa");
    if (!settlement) return "";
    return buildCashReceiptPrintHtml(settlement, companyName, printDate);
  }
  return "";
}

function buildJobOrderPrintHtml(job, companyName, printDate) {
  const costs = job.estimatedCosts || {};
  return `
    <article class="print-sheet">
      <header class="print-head">
        <h3>JOB ORDER TRUCKING</h3>
        <p>${safeText(companyName)}</p>
      </header>
      <table class="print-meta">
        ${printMetaRow("No Job", job.id)}
        ${printMetaRow("Tanggal Cetak", formatDate(printDate))}
        ${printMetaRow("Tanggal Loading", formatDate(job.loadingDate))}
        ${printMetaRow("Estimasi Kembali Pool", formatDate(job.etaReturnDate))}
        ${printMetaRow("Nama Customer", job.customer)}
        ${printMetaRow("No DO / SP2", job.doSp2)}
        ${printMetaRow("Container No", job.containerNo)}
        ${printMetaRow("Size Container", job.containerSize)}
        ${printMetaRow("Rute Pengiriman", job.route)}
        ${printMetaRow("Driver", job.driver)}
        ${printMetaRow("No Truck", job.truck)}
        ${printMetaRow("Estimasi Jarak", `${job.distanceKmPlan || 0} KM`)}
      </table>
      <p class="print-section-title">Estimasi Biaya Operasional</p>
      <table class="print-table">
        <thead>
          <tr>
            <th>Komponen</th>
            <th>Estimasi</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Solar</td><td>${formatCurrency(costs.solar)}</td></tr>
          <tr><td>Tol</td><td>${formatCurrency(costs.tol)}</td></tr>
          <tr><td>Uang Makan Driver</td><td>${formatCurrency(costs.meal)}</td></tr>
          <tr><td>Parkir / Pelabuhan</td><td>${formatCurrency(costs.parking)}</td></tr>
          <tr><td>Lain-lain</td><td>${formatCurrency(costs.other)}</td></tr>
          <tr><th>Total Uang Jalan</th><th>${formatCurrency(job.estimatedTotal)}</th></tr>
        </tbody>
      </table>
      <p class="print-note">
        Catatan: Job Order ini menjadi dasar proses pengajuan uang jalan, operasional perjalanan, dan pertanggungjawaban LPJ.
      </p>
      <div class="print-sign-grid sign-3">
        ${printSignBox("Dibuat Oleh", "Staff Operasional")}
        ${printSignBox("Disetujui Oleh", "Manager Operasional")}
        ${printSignBox("Diterima Oleh", "Driver")}
      </div>
    </article>
  `;
}

function buildAdvancePrintHtml(advance, companyName, printDate) {
  const job = getJobById(advance.jobId);
  const disbursement = getDisbursementByAdvanceId(advance.id);
  const status = advanceStatus(advance);
  return `
    <article class="print-sheet">
      <header class="print-head">
        <h3>FORM PENGAJUAN UANG JALAN</h3>
        <p>${safeText(companyName)}</p>
      </header>
      <table class="print-meta">
        ${printMetaRow("No Pengajuan", advance.id)}
        ${printMetaRow("Tanggal Pengajuan", formatDate(advance.requestDate))}
        ${printMetaRow("Tanggal Cetak", formatDate(printDate))}
        ${printMetaRow("No Job", advance.jobId)}
        ${printMetaRow("Rute", advance.route)}
        ${printMetaRow("Driver", advance.driver)}
        ${printMetaRow("No Truck", advance.truck)}
        ${printMetaRow("Estimasi Biaya", formatCurrency(advance.estimateAmount))}
        ${printMetaRow("Total Uang Jalan", formatCurrency(advance.requestedAmount))}
        ${printMetaRow("Status Pembayaran", advance.paymentType)}
        ${printMetaRow("Status Pengajuan", status)}
        ${printMetaRow("No Register Uang Jalan", disbursement?.id || "-")}
        ${printMetaRow("Customer", job?.customer || "-")}
      </table>
      <div class="print-status-grid">
        <div class="print-status-item"><strong>Approval Staff:</strong> ${safeText(approvalStatusLabel(advance.approvals.staff))}</div>
        <div class="print-status-item"><strong>Approval Manager:</strong> ${safeText(approvalStatusLabel(advance.approvals.manager))}</div>
        <div class="print-status-item"><strong>Approval Finance:</strong> ${safeText(approvalStatusLabel(advance.approvals.finance))}</div>
      </div>
      <p class="print-note">
        Dokumen ini menjadi dasar resmi pencairan uang jalan. Nominal di luar form ini wajib melalui proses reimbursement.
      </p>
      <div class="print-sign-grid">
        ${printSignBox("Diajukan Oleh", "Driver / Operasional")}
        ${printSignBox("Disetujui Oleh", "Staff Operasional")}
        ${printSignBox("Disetujui Oleh", "Manager Operasional")}
        ${printSignBox("Disetujui Oleh", "Finance")}
      </div>
    </article>
  `;
}

function buildLpjPrintHtml(lpj, companyName, printDate) {
  const disbursement = getDisbursementById(lpj.disbursementId);
  const diff = calculateDifference(lpj);
  const type = getDifferenceType(diff);
  const costs = lpj.actualCosts || {};
  return `
    <article class="print-sheet">
      <header class="print-head">
        <h3>LAPORAN PERTANGGUNGJAWABAN UANG JALAN (LPJ)</h3>
        <p>${safeText(companyName)}</p>
      </header>
      <table class="print-meta">
        ${printMetaRow("No LPJ", lpj.id)}
        ${printMetaRow("No Job", lpj.jobId)}
        ${printMetaRow("No Register", disbursement?.id || "-")}
        ${printMetaRow("Driver", lpj.driver)}
        ${printMetaRow("No Truck", lpj.truck)}
        ${printMetaRow("Tanggal Kembali Pool", formatDateTime(lpj.returnAt))}
        ${printMetaRow("Tanggal Submit LPJ", formatDateTime(lpj.submitAt))}
        ${printMetaRow("Tanggal Cetak", formatDate(printDate))}
        ${printMetaRow("Status Waktu LPJ", lpj.isLate ? "Terlambat (> 24 jam)" : "On Time")}
        ${printMetaRow("Jarak Aktual", `${lpj.actualDistanceKm || 0} KM`)}
      </table>
      <p class="print-section-title">Realisasi Biaya Operasional</p>
      <table class="print-table">
        <thead>
          <tr>
            <th>Komponen</th>
            <th>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Solar</td><td>${formatCurrency(costs.solar)}</td></tr>
          <tr><td>Tol</td><td>${formatCurrency(costs.tol)}</td></tr>
          <tr><td>Parkir / Pelabuhan</td><td>${formatCurrency(costs.parking)}</td></tr>
          <tr><td>Makan Driver</td><td>${formatCurrency(costs.meal)}</td></tr>
          <tr><td>Lain-lain</td><td>${formatCurrency(costs.other)}</td></tr>
          <tr><th>Total Realisasi</th><th>${formatCurrency(lpj.totalRealization)}</th></tr>
          <tr><th>Uang Jalan</th><th>${formatCurrency(disbursement?.amount || 0)}</th></tr>
          <tr><th>Selisih (${safeText(type)})</th><th>${formatCurrency(diff)}</th></tr>
        </tbody>
      </table>
      <div class="print-status-grid">
        <div class="print-status-item"><strong>Struk Solar:</strong> ${lpj.proofs?.fuel ? "Ada" : "Tidak Ada"}</div>
        <div class="print-status-item"><strong>Struk Tol:</strong> ${lpj.proofs?.toll ? "Ada" : "Tidak Ada"}</div>
        <div class="print-status-item"><strong>Struk Parkir/Pelabuhan:</strong> ${lpj.proofs?.parking ? "Ada" : "Tidak Ada"}</div>
        <div class="print-status-item"><strong>Bukti Asli:</strong> ${lpj.proofs?.originalConfirmed ? "Sudah Diserahkan" : "Belum"}</div>
      </div>
      <p class="print-note">
        Catatan Driver: ${safeText(lpj.notes || "-")}
      </p>
      <div class="print-sign-grid sign-3">
        ${printSignBox("Dibuat Oleh", "Driver")}
        ${printSignBox("Diverifikasi Oleh", "Staff Operasional")}
        ${printSignBox("Disetujui Oleh", "Finance")}
      </div>
    </article>
  `;
}

function buildCashReceiptPrintHtml(settlement, companyName, printDate) {
  const lpj = state.lpjs.find((item) => item.id === settlement.lpjId);
  const nominal = Math.max(Number(settlement.difference) || 0, 0);
  const terbilang = toTerbilangRupiah(nominal);
  const receiptNo = `BPK-${settlement.id}`;
  return `
    <article class="print-sheet">
      <header class="print-head">
        <h3>BUKTI PENERIMAAN KAS</h3>
        <p>${safeText(companyName)}</p>
      </header>
      <table class="print-meta">
        ${printMetaRow("No Bukti", receiptNo)}
        ${printMetaRow("Tanggal Proses", formatDate(settlement.processedDate))}
        ${printMetaRow("Tanggal Cetak", formatDate(printDate))}
        ${printMetaRow("No Settlement", settlement.id)}
        ${printMetaRow("No LPJ", settlement.lpjId)}
        ${printMetaRow("No Job", settlement.jobId)}
        ${printMetaRow("Nama Driver", settlement.driver)}
        ${printMetaRow("No Truck", settlement.truck)}
        ${printMetaRow("Metode Penerimaan", settlement.method)}
      </table>
      <p class="print-section-title">Rincian Penerimaan</p>
      <table class="print-table">
        <thead>
          <tr>
            <th>Keterangan</th>
            <th>Nominal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pengembalian sisa uang jalan dari driver (${safeText(settlement.driver)}) untuk job ${safeText(settlement.jobId)}</td>
            <td>${formatCurrency(nominal)}</td>
          </tr>
          <tr>
            <th>Total Diterima</th>
            <th>${formatCurrency(nominal)}</th>
          </tr>
        </tbody>
      </table>
      <p class="print-note">
        Terbilang: <strong>${safeText(terbilang)}</strong><br>
        Referensi LPJ: ${safeText(lpj?.id || "-")}
      </p>
      <div class="print-sign-grid sign-3">
        ${printSignBox("Penyetor", "Driver")}
        ${printSignBox("Penerima", "Kasir / Finance")}
        ${printSignBox("Mengetahui", "Manager Keuangan")}
      </div>
    </article>
  `;
}

function printMetaRow(label, value) {
  return `<tr><td class="label">${safeText(label)}</td><td>${safeText(value ?? "-")}</td></tr>`;
}

function printSignBox(roleLabel, nameLabel) {
  return `
    <div class="print-sign-box">
      <div>${safeText(roleLabel)}</div>
      <div class="print-sign-line"></div>
      <div>${safeText(nameLabel)}</div>
    </div>
  `;
}

function approvalStatusLabel(timestamp) {
  if (!timestamp) return "Belum";
  return `Sudah (${formatDateTime(timestamp)})`;
}

function toTerbilangRupiah(value) {
  const words = toIndonesianWords(value);
  if (!words) return "Nol rupiah";
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`;
}

function toIndonesianWords(value) {
  const number = Math.floor(Math.abs(Number(value) || 0));
  const base = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas"
  ];

  function spell(n) {
    if (n < 12) return base[n];
    if (n < 20) return `${spell(n - 10)} belas`;
    if (n < 100) return `${spell(Math.floor(n / 10))} puluh${n % 10 ? ` ${spell(n % 10)}` : ""}`;
    if (n < 200) return `seratus${n - 100 ? ` ${spell(n - 100)}` : ""}`;
    if (n < 1000) return `${spell(Math.floor(n / 100))} ratus${n % 100 ? ` ${spell(n % 100)}` : ""}`;
    if (n < 2000) return `seribu${n - 1000 ? ` ${spell(n - 1000)}` : ""}`;
    if (n < 1000000) return `${spell(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${spell(n % 1000)}` : ""}`;
    if (n < 1000000000) return `${spell(Math.floor(n / 1000000))} juta${n % 1000000 ? ` ${spell(n % 1000000)}` : ""}`;
    if (n < 1000000000000) return `${spell(Math.floor(n / 1000000000))} miliar${n % 1000000000 ? ` ${spell(n % 1000000000)}` : ""}`;
    return `${spell(Math.floor(n / 1000000000000))} triliun${n % 1000000000000 ? ` ${spell(n % 1000000000000)}` : ""}`;
  }

  if (number === 0) return "nol";
  return spell(number).replace(/\s+/g, " ").trim();
}

function getPrintWindowStyles() {
  return `
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Times New Roman", "Cambria", serif;
    }
    .print-sheet {
      width: 190mm;
      margin: 0 auto;
      padding: 2mm;
      color: #111;
      font-family: "Times New Roman", "Cambria", serif;
    }
    .print-head { text-align: center; margin-bottom: 10px; }
    .print-head h3 { margin: 0; font-size: 18px; letter-spacing: 0.3px; }
    .print-head p { margin: 3px 0 0 0; font-size: 13px; }
    .print-meta, .print-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .print-meta td, .print-table th, .print-table td {
      border: 1px solid #3f4d50;
      padding: 6px 7px;
      font-size: 12px;
      vertical-align: top;
    }
    .print-meta td.label {
      width: 30%;
      font-weight: 700;
      background: #f2f5f5;
    }
    .print-table th {
      background: #f2f5f5;
      text-align: left;
      text-transform: none;
      letter-spacing: 0;
      font-size: 12px;
    }
    .print-section-title {
      margin-top: 10px;
      margin-bottom: 3px;
      font-size: 13px;
      font-weight: 700;
    }
    .print-note {
      margin-top: 10px;
      border: 1px solid #3f4d50;
      padding: 7px;
      font-size: 12px;
    }
    .print-status-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin-top: 8px;
    }
    .print-status-item {
      border: 1px solid #3f4d50;
      padding: 6px;
      font-size: 11px;
    }
    .print-sign-grid {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .print-sign-grid.sign-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .print-sign-box {
      text-align: center;
      font-size: 12px;
    }
    .print-sign-line {
      margin-top: 48px;
      border-top: 1px solid #111;
      height: 1px;
    }
  `;
}

function statusTag(label, forceType = "") {
  const lower = label.toLowerCase();
  let type = forceType;
  if (!type) {
    if (lower.includes("closed") || lower.includes("selesai") || lower.includes("ok") || lower.includes("siap")) {
      type = "ok";
    } else if (lower.includes("reimburse") || lower.includes("terlambat") || lower.includes("tolak")) {
      type = "danger";
    } else if (lower.includes("menunggu") || lower.includes("pending")) {
      type = "warn";
    } else {
      type = "neutral";
    }
  }
  return `<span class="tag ${type}">${safeText(label)}</span>`;
}

function emptyRow(message) {
  return `<tr><td colspan="12">${safeText(message)}</td></tr>`;
}
