// public/script.js
const API_BASE = window.location.origin + '/api';

let adminPassword = null;


// ---------- UI helpers ----------
function showSection(sectionId) {
  document.querySelectorAll('section').forEach(section => section.classList.remove('active'));
  const el = document.getElementById(sectionId);
  if (el) el.classList.add('active');
}

function showAlert(message, type = 'info') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => {
    alert.style.animation = 'fadeOut 0.5s ease-out forwards';
    setTimeout(() => alert.remove(), 500);
  }, 3000);
}

// ---------- Admin helper ----------
async function adminFetch(url, options = {}) {
  if (!adminPassword) {
    throw new Error('Not authenticated as admin');
  }
  options.headers = options.headers || {};
  options.headers['admin-password'] = adminPassword;
  return fetchJSON(url, options);
}


async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch(e) { data = text; }
  if (!res.ok) {
    const errMsg = (data && data.error) ? data.error : (typeof data === 'string' ? data : res.statusText);
    throw new Error(errMsg || `HTTP ${res.status}`);
  }
  return data;
}

// ---------- DOM elements ----------
const navShowSearch = document.getElementById('showSearch');
const navShowAdd = document.getElementById('showAddBook');
const navShowBorrow = document.getElementById('showBorrowReturn');
const navShowBorrowed = document.getElementById('showBorrowedBooks');
const adminLoginBtn = document.getElementById('adminLogin');

function closeMobileNav() {
  const nav = document.getElementById('navMenu');
  const toggle = document.getElementById('menuToggle');
  if (!nav) return;
  if (nav.classList.contains('nav-open')) {
    nav.classList.remove('nav-open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    }
  }
}

// Nav handlers: also collapse mobile menu after navigation
navShowSearch?.addEventListener('click', () => {
  showSection('searchSection');
  loadCategories();
  searchBooks();
  // collapse mobile nav when user selects a page
  if (window.innerWidth <= 768) closeMobileNav();
});
navShowAdd?.addEventListener('click', () => {
  showSection('addBookSection');
  if (window.innerWidth <= 768) closeMobileNav();
});
navShowBorrow?.addEventListener('click', () => {
  showSection('borrowReturnSection');
  if (window.innerWidth <= 768) closeMobileNav();
});
navShowBorrowed?.addEventListener('click', () => {
  showSection('borrowedBooksSection');
  loadBorrowedBooks();
  if (window.innerWidth <= 768) closeMobileNav();
});
adminLoginBtn?.addEventListener('click', () => {
  const ok = authenticateAdminPrompt();
  if (ok) showAlert('Admin mode enabled', 'success');
  if (window.innerWidth <= 768) closeMobileNav();
});

// Also add delegation: any button inside navMenu should collapse mobile nav when clicked
const navMenuEl = document.getElementById('navMenu');
if (navMenuEl) {
  navMenuEl.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.tagName === 'BUTTON') {
      // allow the button's normal handler to run first; collapse after a tiny delay
      setTimeout(() => {
        if (window.innerWidth <= 768) closeMobileNav();
      }, 50);
    }
  });
}

// Mobile hamburger/menu toggle logic
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');

if (menuToggle && navMenu) {
  // ensure ARIA attributes for accessibility
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-controls', 'navMenu');

  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const opened = navMenu.classList.toggle('nav-open');
    menuToggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
    // change icon/label
    menuToggle.textContent = opened ? '✕' : '☰';
  });

  // close menu on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (!navMenu.classList.contains('nav-open')) return;
    if (navMenu.contains(e.target) || menuToggle.contains(e.target)) return;
    navMenu.classList.remove('nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.textContent = '☰';
  });

  // close menu when resizing to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && navMenu.classList.contains('nav-open')) {
      navMenu.classList.remove('nav-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.textContent = '☰';
    }
  });
}

// ---------- Admin front-only flag (visual) ----------
let isAdminAuthenticated = false;
function authenticateAdminPrompt() {
  const pwd = prompt('Enter admin password:');
  if (!pwd) { alert('No password entered'); return false; }
  adminPassword = pwd;  // store it for reuse
  isAdminAuthenticated = true;
  updateAdminUI();
  return true;
}

function updateAdminUI() {
  if (isAdminAuthenticated) {
    adminLoginBtn.textContent = 'Admin Mode';
    adminLoginBtn.style.backgroundColor = '#27ae60';
    document.body.classList.add('admin-mode');
  } else {
    adminLoginBtn.textContent = 'Admin Login';
    adminLoginBtn.style.backgroundColor = '#3498db';
    document.body.classList.remove('admin-mode');
  }
}

// ---------- Search / display ----------
async function searchBooks() {
  const search = document.getElementById('searchInput')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';
  const bookId = document.getElementById('bookIdFilter')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category) params.append('category', category);
  if (status) params.append('status', status);
  if (bookId) params.append('book_id', bookId);

  try {
    const books = await fetchJSON(`${API_BASE}/books?${params.toString()}`);
    displayBooks(books || []);
  } catch (err) {
    console.error(err);
    showAlert('Error searching books: ' + err.message, 'error');
  }
}

function displayBooks(books) {
  const resultsDiv = document.getElementById('searchResults');
  if (!resultsDiv) return;
  if (!books || books.length === 0) { resultsDiv.innerHTML = '<p>No books found</p>'; return; }

  resultsDiv.innerHTML = books.map(book => {
    const borrowedInfo = (book.status === 'Borrowed' && book.borrower_name) ?
      `<div class="borrower-info"><p><strong>Borrowed by:</strong> ${book.borrower_name}</p>
       <p><strong>Borrow date:</strong> ${book.borrowed_at ? new Date(book.borrowed_at).toLocaleString() : 'Unknown'}</p></div>` : '';

    const delBtn = `<button class="delete-btn" onclick="deleteBook('${escapeHtml(book.book_id)}')">Delete</button>`;

    return `
      <div class="book-card ${book.status === 'Borrowed' ? 'borrowed-book-card' : ''}">
        ${isAdminAuthenticated ? delBtn : ''}
        <h3>${escapeHtml(book.title)}</h3>
        <p><strong>Book ID:</strong> ${escapeHtml(book.book_id)}</p>
        <p><strong>Author:</strong> ${escapeHtml(book.author || 'N/A')}</p>
        <p><strong>Category:</strong> ${escapeHtml(book.category || 'N/A')}</p>
        <p><strong>Status:</strong> <span class="status-${(book.status || '').toLowerCase()}">${escapeHtml(book.status || '')}</span></p>
        ${borrowedInfo}
      </div>
    `;
  }).join('');
}

// simple escaping for injected values
function escapeHtml(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------- Delete (admin) ----------
async function deleteBook(bookId) {
  if (!confirm(`Delete book ${bookId}?`)) return;
  try {
    await adminFetch(`${API_BASE}/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' });
    showAlert('Book deleted', 'success');
    searchBooks();
  } catch (err) {
    console.error(err);
    showAlert('Error deleting book: ' + err.message, 'error');
  }
}

// ---------- Borrowed list ----------
async function loadBorrowedBooks() {
  try {
    const rows = await fetchJSON(`${API_BASE}/borrowed-books`);
    const div = document.getElementById('borrowedBooksList');
    if (!div) return;
    if (!rows || rows.length === 0) { div.innerHTML = '<p>No books are currently borrowed</p>'; return; }
    div.innerHTML = rows.map(r => `
      <div class="book-card borrowed-book-card">
        ${isAdminAuthenticated ? `<button class="delete-btn" onclick="deleteBook('${escapeHtml(r.book_id)}')">Delete</button>` : ''}
        <h3>${escapeHtml(r.title)}</h3>
        <p><strong>Book ID:</strong> ${escapeHtml(r.book_id)}</p>
        <p><strong>Author:</strong> ${escapeHtml(r.author || 'N/A')}</p>
        <div class="borrower-info">
          <p><strong>Borrowed by:</strong> ${escapeHtml(r.borrower_name)}</p>
          <p><strong>Borrow date:</strong> ${r.borrowed_at ? new Date(r.borrowed_at).toLocaleString() : 'Unknown'}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    showAlert('Error loading borrowed books: ' + err.message, 'error');
  }
}

// ---------- Categories ----------
async function loadCategories() {
  try {
    const books = await fetchJSON(`${API_BASE}/books`);
    const cats = [...new Set((books || []).map(b => b.category).filter(Boolean))];
    const sel = document.getElementById('categoryFilter');
    if (!sel) return;
    // clear except first option
    while (sel.options.length > 1) sel.remove(1);
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading categories', err);
  }
}

// ---------- Add book (admin) ----------
document.getElementById('addBookForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const book = {
    book_id: document.getElementById('book_id')?.value?.trim(),
    title: document.getElementById('title')?.value?.trim(),
    author: document.getElementById('author')?.value?.trim(),
    category: document.getElementById('category')?.value?.trim(),
  };
  if (!book.book_id || !book.title) { showAlert('Book ID and title required', 'error'); return; }
  try {
    await adminFetch(`${API_BASE}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book)
    });
    showAlert('Book added', 'success');
    document.getElementById('addBookForm').reset();
    searchBooks();
  } catch (err) {
    console.error(err);
    showAlert('Error adding book: ' + err.message, 'error');
  }
});

// ---------- Borrow / return ----------
document.getElementById('borrowBtn')?.addEventListener('click', borrowBook);
document.getElementById('returnBtn')?.addEventListener('click', returnBook);


async function borrowBook() {
  const bookId = document.getElementById('borrowBookId')?.value?.trim();
  const borrowerName = document.getElementById('borrowerName')?.value?.trim();
  if (!bookId || !borrowerName) { showAlert('Please enter both Book ID and your name', 'error'); return; }
  try {
    await fetchJSON(`${API_BASE}/books/borrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, borrower_name: borrowerName })
    });
    showAlert('Book borrowed', 'success');
    document.getElementById('borrowBookId').value = '';
    document.getElementById('borrowerName').value = '';
    searchBooks();
    loadBorrowedBooks();
  } catch (err) {
    console.error(err);
    showAlert('Error borrowing book: ' + err.message, 'error');
  }
}

async function returnBook() {
  const bookId = document.getElementById('returnBookId')?.value?.trim();
  if (!bookId) { showAlert('Please enter Book ID', 'error'); return; }
  try {
    await fetchJSON(`${API_BASE}/books/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId })
    });
    showAlert('Book returned', 'success');
    document.getElementById('returnBookId').value = '';
    searchBooks();
    loadBorrowedBooks();
  } catch (err) {
    console.error(err);
    showAlert('Error returning book: ' + err.message, 'error');
  }
}

// ---------- Init page ----------
showSection('searchSection');
loadCategories();
searchBooks();
