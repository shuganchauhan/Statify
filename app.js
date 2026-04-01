// ============================================================
//  STATIFY — NBA Player Explorer
//  API: balldontlie.io  |  IDs: searchInput, conferenceFilter,
//       sortOrder, playersContainer, prevBtn, nextBtn,
//       pageIndicator, playerCount, pagination
// ============================================================

const API_KEY = "84ba3e80-6200-4c1b-9d7d-cd2021993d93";
const BASE_URL = "https://api.balldontlie.io/v1/players";
const PER_PAGE = 25; // cards fetched per API call

// ── DOM refs ──────────────────────────────────────────────
const searchInput = document.getElementById("searchInput");
const conferenceFilter = document.getElementById("conferenceFilter");
const sortOrder = document.getElementById("sortOrder");
const playersContainer = document.getElementById("playersContainer");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageIndicator = document.getElementById("pageIndicator");
const playerCount = document.getElementById("playerCount");
const paginationEl = document.getElementById("pagination");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");

// ── State ─────────────────────────────────────────────────
let allPlayers = [];   // full local cache
let filtered = [];   // after search/filter/sort
let currentPage = 1;
const CARDS_PER_PAGE = 18;

// ── Fetch ALL players (walk cursor pages) ─────────────────
async function fetchAllPlayers() {
    showLoading(true);
    allPlayers = [];
    let cursor = null;

    try {
        do {
            // let url = `${BASE_URL}?per_page=100`;
            // if (cursor) url += `&cursor=${cursor}`;

            const res = await fetch(url, {
                headers: { Authorization: API_KEY }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            allPlayers = allPlayers.concat(json.data);
            cursor = json.meta?.next_cursor ?? null;

            // Update count while loading
            playerCount.textContent = `Loaded ${allPlayers.length} players…`;
        } while (cursor);

        applyFilters();
    } catch (err) {
        console.error("Fetch error:", err);
        showLoading(false);
        playerCount.textContent = "Failed to load players. Check your API key.";
    }
}

// ── Apply search + conference filter + sort ───────────────
function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const conf = conferenceFilter.value;
    const sort = sortOrder.value;

    filtered = allPlayers.filter(p => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        const teamName = (p.team?.full_name ?? "").toLowerCase();
        const matchSearch = !query || fullName.includes(query) || teamName.includes(query);
        const matchConf = conf === "all" || p.team?.conference === conf;
        return matchSearch && matchConf;
    });

    // Sort
    filtered.sort((a, b) => {
        const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
        const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
        return sort === "az"
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
    });

    currentPage = 1;
    renderPage();
}

// ── Render current page of cards ─────────────────────────
function renderPage() {
    showLoading(false);
    playersContainer.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * CARDS_PER_PAGE;
    const slice = filtered.slice(start, start + CARDS_PER_PAGE);

    // Empty state
    if (slice.length === 0) {
        emptyState.classList.remove("hidden");
        paginationEl.classList.add("hidden");
        playerCount.textContent = "No players match your filters";
        return;
    }

    emptyState.classList.add("hidden");

    // Render cards with staggered animation
    slice.forEach((player, i) => {
        const card = buildCard(player, i);
        playersContainer.appendChild(card);
    });

    // Pagination
    const showPagination = filtered.length > CARDS_PER_PAGE;
    paginationEl.classList.toggle("hidden", !showPagination);
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    pageIndicator.textContent = `Page ${currentPage} / ${totalPages}`;

    // Count
    playerCount.textContent =
        `Showing ${start + 1}–${Math.min(start + CARDS_PER_PAGE, filtered.length)} of ${filtered.length} players`;

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Build a single player card element ───────────────────
function buildCard(player, index) {
    const name = `${player.first_name} ${player.last_name}`;
    const team = player.team?.full_name ?? "Free Agent";
    const position = player.position || "—";
    const conf = player.team?.conference ?? "";
    const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

    const card = document.createElement("div");
    card.className = "player-card";
    card.style.animationDelay = `${index * 30}ms`;

    // Conference color for badge
    const confBadgeClass = conf === "East" ? "badge-east" : "badge-conf";

    card.innerHTML = `
    <div class="card-accent"></div>
    <div class="card-avatar">${initials}</div>
    <div class="card-name" title="${name}">${name}</div>
    <div class="card-team">${team}</div>
    <div class="card-badges">
      ${position !== "—" ? `<span class="badge badge-pos">${position}</span>` : ""}
      ${conf ? `<span class="badge ${confBadgeClass}">${conf}</span>` : ""}
    </div>
  `;

    return card;
}

// ── Loading helper ────────────────────────────────────────
function showLoading(show) {
    loadingState.classList.toggle("hidden", !show);
    if (show) {
        playersContainer.innerHTML = "";
        emptyState.classList.add("hidden");
        paginationEl.classList.add("hidden");
    }
}

// ── Event listeners ───────────────────────────────────────
searchInput.addEventListener("input", debounce(applyFilters, 300));
conferenceFilter.addEventListener("change", applyFilters);
sortOrder.addEventListener("change", applyFilters);

prevBtn.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderPage(); }
});
nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(filtered.length / CARDS_PER_PAGE);
    if (currentPage < totalPages) { currentPage++; renderPage(); }
});

// ── Debounce utility ─────────────────────────────────────
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ── Bootstrap ─────────────────────────────────────────────
fetchAllPlayers();
