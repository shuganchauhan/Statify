const API_URL = "https://api.balldontlie.io/v1/players";
const API_KEY = "84ba3e80-6200-4c1b-9d7d-cd2021993d93";
const STORAGE_KEYS = {
  favorites: "statifyFavorites"
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("playerGrid")) {
    initAppPage();
  }
});

function initAppPage() {
  const state = {
    currentView: "all",
    currentPage: 1,
    perPage: 12,
    totalPages: 1,
    searchInput: "",
    query: "",
    sort: "name-asc",
    team: "",
    players: [],
    favoritePlayers: [],
    nextCursor: null,
    previousCursors: [],
    isLoading: false,
    error: ""
  };

  const elements = {
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    teamFilter: document.getElementById("teamFilter"),
    playerGrid: document.getElementById("playerGrid"),
    loadingState: document.getElementById("loadingState"),
    errorState: document.getElementById("errorState"),
    emptyState: document.getElementById("emptyState"),
    resultsTitle: document.getElementById("resultsTitle"),
    resultsMeta: document.getElementById("resultsMeta"),
    resultsEyebrow: document.getElementById("resultsEyebrow"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    pageIndicator: document.getElementById("pageIndicator"),
    allPlayersTab: document.getElementById("allPlayersTab"),
    favoritesTab: document.getElementById("favoritesTab")
  };

  elements.sortSelect.addEventListener("change", () => {
    state.sort = elements.sortSelect.value;
    renderApp(state, elements);
  });

  elements.teamFilter.addEventListener("change", () => {
    state.team = elements.teamFilter.value;
    renderApp(state, elements);
  });

  elements.prevBtn.addEventListener("click", () => handlePreviousPage(state, elements));
  elements.nextBtn.addEventListener("click", () => handleNextPage(state, elements));

  [elements.allPlayersTab, elements.favoritesTab].forEach((tab) => {
    tab.addEventListener("click", () => {
      if (state.currentView === tab.dataset.view) {
        return;
      }

      state.currentView = tab.dataset.view;
      updateTabState(state, elements);
      renderApp(state, elements);
    });
  });

  const debouncedSearch = debounce((value) => {
    state.query = value.trim();
    resetPagination(state);
    fetchPlayers(state, elements);
  }, 300);

  elements.searchInput.addEventListener("input", (event) => {
    state.searchInput = event.target.value;
    debouncedSearch(state.searchInput);
  });

  updateTabState(state, elements);
  fetchPlayers(state, elements);
}

async function fetchPlayers(state, elements) {
  state.isLoading = true;
  state.error = "";
  renderApp(state, elements);

  try {
    const url = new URL(API_URL);
    url.searchParams.set("per_page", String(state.perPage));

    if (state.query) {
      url.searchParams.set("search", state.query);
    }

    const cursor = getCursorForCurrentPage(state);
    if (cursor !== null) {
      url.searchParams.set("cursor", String(cursor));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    state.players = Array.isArray(payload.data) ? payload.data : [];
    state.favoritePlayers = getFavoritePlayers();
    state.nextCursor = payload.meta?.next_cursor ?? null;
    state.totalPages = state.nextCursor ? state.currentPage + 1 : state.currentPage;

    const teams = uniqueTeamsFromLists(state.players, state.favoritePlayers);
    populateTeamFilter(teams, state.team, elements.teamFilter);
  } catch (error) {
    state.error = error.message || "Something went wrong while fetching players.";
    state.players = [];
    state.nextCursor = null;
    state.totalPages = state.currentPage;
  } finally {
    state.isLoading = false;
    renderApp(state, elements);
  }
}

function renderApp(state, elements) {
  state.favoritePlayers = getFavoritePlayers();

  const activeList = state.currentView === "favorites" ? state.favoritePlayers : state.players;
  const filteredList = applyClientFilters(activeList, state);

  elements.resultsTitle.textContent = state.currentView === "favorites" ? "Favorite Players" : "All Players";
  elements.resultsEyebrow.textContent = state.currentView === "favorites" ? "Saved Locally" : "Live Results";
  elements.pageIndicator.textContent = `Page ${state.currentPage}`;

  elements.loadingState.classList.toggle("hidden", !state.isLoading);
  elements.errorState.classList.toggle("hidden", !state.error);
  elements.emptyState.classList.toggle("hidden", state.isLoading || state.error || filteredList.length > 0);
  elements.playerGrid.classList.toggle("hidden", state.isLoading || !!state.error || filteredList.length === 0);

  if (state.error) {
    elements.errorState.textContent = `Unable to load players. ${state.error}`;
  }

  const viewLabel = state.currentView === "favorites" ? "favorites" : "players";
  elements.resultsMeta.textContent = state.isLoading
    ? "Loading players..."
    : `${filteredList.length} ${viewLabel} shown`;

  elements.prevBtn.disabled = state.isLoading || state.currentPage === 1 || state.currentView === "favorites";
  elements.nextBtn.disabled = state.isLoading || !state.nextCursor || state.currentView === "favorites";

  if (!state.isLoading && !state.error && filteredList.length > 0) {
    elements.playerGrid.innerHTML = filteredList.map((player) => createPlayerCard(player, state)).join("");
    attachFavoriteHandlers(state, elements);
  } else if (filteredList.length === 0) {
    elements.playerGrid.innerHTML = "";
  }
}

function createPlayerCard(player, state) {
  const teamName = player.team?.full_name || "No team available";
  const position = player.position || "N/A";
  const fullName = `${player.first_name} ${player.last_name}`;
  const isFavorite = getFavoritePlayers().some((favorite) => favorite.id === player.id);

  return `
    <article class="player-card">
      <div class="player-card-header">
        <div>
          <h3 class="player-name">${highlightMatch(escapeHtml(fullName), state.query)}</h3>
          <div class="player-meta">
            <span>${position}</span>
            <span class="player-meta-dot" aria-hidden="true"></span>
            <span>ID ${player.id}</span>
          </div>
        </div>
        <span class="player-badge">${escapeHtml(player.team?.abbreviation || "NBA")}</span>
      </div>

      <p class="player-team">${escapeHtml(teamName)}</p>

      <div class="player-meta">
        <span>First Name: ${highlightMatch(escapeHtml(player.first_name), state.query)}</span>
      </div>
      <div class="player-meta">
        <span>Last Name: ${highlightMatch(escapeHtml(player.last_name), state.query)}</span>
      </div>

      <button
        class="favorite-toggle ${isFavorite ? "is-active" : ""}"
        type="button"
        data-player-id="${player.id}"
      >
        ${isFavorite ? "Remove Favorite" : "Add Favorite"}
      </button>
    </article>
  `;
}

function attachFavoriteHandlers(state, elements) {
  const buttons = elements.playerGrid.querySelectorAll(".favorite-toggle");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = Number(button.dataset.playerId);
      const sourcePlayers = [...state.players, ...state.favoritePlayers];
      const player = sourcePlayers.find((item) => item.id === playerId);

      if (!player) {
        return;
      }

      toggleFavorite(player);
      const teams = uniqueTeamsFromLists(state.players, getFavoritePlayers());
      populateTeamFilter(teams, state.team, elements.teamFilter);
      renderApp(state, elements);
    });
  });
}

function applyClientFilters(players, state) {
  let list = [...players];

  if (state.team) {
    list = list.filter((player) => (player.team?.full_name || "") === state.team);
  }

  if (state.currentView === "favorites" && state.query) {
    const term = state.query.toLowerCase();
    list = list.filter((player) => {
      const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
      return fullName.includes(term);
    });
  }

  list.sort((playerA, playerB) => {
    const nameA = `${playerA.first_name} ${playerA.last_name}`.toLowerCase();
    const nameB = `${playerB.first_name} ${playerB.last_name}`.toLowerCase();

    return state.sort === "name-desc" ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
  });

  return list;
}

function populateTeamFilter(teams, selectedTeam, selectElement) {
  const options = ['<option value="">All teams</option>']
    .concat(
      teams.map((team) => {
        const isSelected = selectedTeam === team ? "selected" : "";
        return `<option value="${escapeAttribute(team)}" ${isSelected}>${escapeHtml(team)}</option>`;
      })
    )
    .join("");

  selectElement.innerHTML = options;
}

function uniqueTeamsFromLists(...lists) {
  const teams = new Set();

  lists.flat().forEach((player) => {
    const teamName = player?.team?.full_name;
    if (teamName) {
      teams.add(teamName);
    }
  });

  return Array.from(teams).sort((a, b) => a.localeCompare(b));
}

function handleNextPage(state, elements) {
  if (!state.nextCursor) {
    return;
  }

  state.previousCursors[state.currentPage] = state.nextCursor;
  state.currentPage += 1;
  fetchPlayers(state, elements);
}

function handlePreviousPage(state, elements) {
  if (state.currentPage === 1) {
    return;
  }

  state.currentPage -= 1;
  fetchPlayers(state, elements);
}

function getCursorForCurrentPage(state) {
  if (state.currentPage === 1) {
    return null;
  }

  return state.previousCursors[state.currentPage - 1] ?? null;
}

function resetPagination(state) {
  state.currentPage = 1;
  state.totalPages = 1;
  state.nextCursor = null;
  state.previousCursors = [];
}

function updateTabState(state, elements) {
  const allActive = state.currentView === "all";
  elements.allPlayersTab.classList.toggle("is-active", allActive);
  elements.favoritesTab.classList.toggle("is-active", !allActive);
  elements.allPlayersTab.setAttribute("aria-selected", String(allActive));
  elements.favoritesTab.setAttribute("aria-selected", String(!allActive));
}

function toggleFavorite(player) {
  const favorites = getFavoritePlayers();
  const exists = favorites.some((item) => item.id === player.id);
  const nextFavorites = exists
    ? favorites.filter((item) => item.id !== player.id)
    : [...favorites, player];

  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(nextFavorites));
}

function getFavoritePlayers() {
  return readStorage(STORAGE_KEYS.favorites, []);
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function debounce(callback, delay) {
  let timeoutId;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

function highlightMatch(text, query) {
  if (!query) {
    return text;
  }

  const safeQuery = escapeRegExp(query.trim());
  if (!safeQuery) {
    return text;
  }

  const regex = new RegExp(`(${safeQuery})`, "ig");
  return text.replace(regex, "<mark>$1</mark>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
