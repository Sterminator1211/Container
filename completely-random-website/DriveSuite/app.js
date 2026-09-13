// Front-end logic for Drive Suite
(async function () {
  const signinBtn = document.getElementById('signin-btn');
  const userArea = document.getElementById('user-area');
  const filesContainer = document.getElementById('files');
  const loadingEl = document.getElementById('loading');
  const searchInput = document.getElementById('search-input');
  const filterBtn = document.getElementById('filter-btn');
  const sortBtn = document.getElementById('sort-btn');
  const filterMenu = document.getElementById('filter-menu');
  const sortMenu = document.getElementById('sort-menu');
  const filterType = document.getElementById('filter-type');
  const applyFilter = document.getElementById('apply-filter');
  const clearFilter = document.getElementById('clear-filter');
  const sortBy = document.getElementById('sort-by');
  const sortDir = document.getElementById('sort-dir');
  const applySort = document.getElementById('apply-sort');
  const pageSizeSelect = document.getElementById('page-size');
  const summary = document.getElementById('summary');

  let state = {
    search: '',
    fileType: 'all',
    sortBy: 'modifiedTime',
    sortDir: 'desc',
    pageSize: 50
  };

  // Toggle menus
  filterBtn.addEventListener('click', () => {
    filterMenu.classList.toggle('d-none');
    sortMenu.classList.add('d-none');
  });
  sortBtn.addEventListener('click', () => {
    sortMenu.classList.toggle('d-none');
    filterMenu.classList.add('d-none');
  });

  applyFilter.addEventListener('click', () => {
    state.fileType = filterType.value;
    state.pageSize = Number(pageSizeSelect.value);
    filterMenu.classList.add('d-none');
    fetchAndRenderFiles();
  });
  clearFilter.addEventListener('click', () => {
    filterType.value = 'all';
    pageSizeSelect.value = '50';
    state.fileType = 'all';
    state.pageSize = 50;
    filterMenu.classList.add('d-none');
    fetchAndRenderFiles();
  });

  applySort.addEventListener('click', () => {
    state.sortBy = sortBy.value;
    state.sortDir = sortDir.value;
    sortMenu.classList.add('d-none');
    fetchAndRenderFiles();
  });

  // Debounce search
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      fetchAndRenderFiles();
    }, 450);
  });

  // Fetch user info, or show sign-in
  async function getUser() {
    try {
      const res = await fetch('/api/user');
      if (res.status === 401) throw new Error('not signed in');
      const user = await res.json();
      // Replace sign-in with user info & sign out
      userArea.innerHTML = `
        <div class="me-3 text-white text-end pe-2">
          <div style="font-weight:600">${user.name || user.email}</div>
          <div style="font-size:0.85rem;opacity:0.9">${user.email}</div>
        </div>
        <a href="/logout" class="btn btn-light btn-sm">Sign out</a>
      `;
      summary.innerHTML = `<small class="text-muted">Signed in as ${user.email}</small>`;
      return true;
    } catch (err) {
      // show sign in button
      userArea.innerHTML = `<a href="/auth" id="signin-btn" class="btn btn-outline-light">Sign in with Google</a>`;
      summary.innerHTML = '';
      return false;
    }
  }

  function showLoading(show = true) {
    loadingEl.classList.toggle('d-none', !show);
  }

  async function fetchAndRenderFiles() {
    showLoading(true);
    filesContainer.innerHTML = '';
    const params = new URLSearchParams({
      q: state.search,
      fileType: state.fileType,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      pageSize: state.pageSize
    });
    try {
      const res = await fetch('/api/files?' + params.toString());
      if (res.status === 401) {
        // Not authenticated, redirect to /auth
        window.location = '/auth';
        return;
      }
      const data = await res.json();
      const files = data.files || [];
      if (!files.length) {
        filesContainer.innerHTML = `<div class="col-12"><div class="alert alert-light">No files found.</div></div>`;
      } else {
        filesContainer.innerHTML = files.map(fileCardHtml).join('');
      }
    } catch (err) {
      filesContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error loading files.</div></div>`;
      console.error(err);
    } finally {
      showLoading(false);
    }
  }

  function fileCardHtml(f) {
    const name = escapeHtml(f.name || 'Untitled');
    const mime = f.mimeType || '';
    const modified = f.modifiedTime ? new Date(f.modifiedTime).toLocaleString() : '';
    const size = f.size ? humanSize(Number(f.size)) : '';
    const icon = f.iconLink ? `<img src="${f.iconLink}" alt="" class="file-icon">` : `<div class="file-icon"><i class="fa fa-file"></i></div>`;
    const owner = (f.owners && f.owners[0] && f.owners[0].displayName) ? f.owners[0].displayName : '';
    const viewLink = f.webViewLink ? `href="${f.webViewLink}" target="_blank" rel="noopener"` : '';
    return `
      <div class="col">
        <div class="card p-3 h-100">
          <div class="d-flex align-items-center gap-3">
            <div>${icon}</div>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-start">
                <h6 class="mb-1">${name}</h6>
                <small class="text-muted">${size}</small>
              </div>
              <div class="text-muted small">${mime} ${owner ? ' • ' + owner : ''}</div>
            </div>
          </div>
          <div class="mt-3 d-flex justify-content-between align-items-center">
            <small class="text-muted">Modified: ${modified}</small>
            <div>
              <a ${viewLink} class="btn btn-sm btn-outline-primary">Open</a>
            </div>
          </div>
        </div>
      </div>`;
  }

  // Utilities
  function humanSize(bytes) {
    if (!bytes) return '';
    const units = ['B','KB','MB','GB','TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length-1) {
      bytes /= 1024; i++;
    }
    return `${bytes.toFixed(bytes < 10 ? 2 : 1)} ${units[i]}`;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Init
  const signedIn = await getUser();
  if (signedIn) {
    fetchAndRenderFiles();
  }
})();