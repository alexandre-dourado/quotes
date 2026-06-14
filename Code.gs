// ============================================================
// QUOTES — Google Apps Script Backend
// ============================================================

const CONFIG = {
  GITHUB_TOKEN: 'GITHUB_TOKEN',
  GITHUB_OWNER: 'GITHUB_OWNER',
  GITHUB_REPO: 'GITHUB_REPO',
  DATABASE_FILE: 'DATABASE_FILE',
};

// ============================================================
// SETUP
// ============================================================

function setupGithub(token, owner, repo, file) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.GITHUB_TOKEN, token);
  props.setProperty(CONFIG.GITHUB_OWNER, owner || 'alexandre-dourado');
  props.setProperty(CONFIG.GITHUB_REPO, repo || 'quotes');
  props.setProperty(CONFIG.DATABASE_FILE, file || 'quotes.json');
  return { success: true, data: { message: 'GitHub configured.' } };
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Quotes');
  if (!sheet) {
    sheet = ss.insertSheet('Quotes');
  }
  sheet.clearContents();
  const headers = ['id', 'text', 'author', 'source', 'tags', 'createdAt', 'updatedAt'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return { success: true, data: { message: 'Sheet configured.' } };
}

function initializeRepository() {
  const emptyDb = {
    meta: {
      version: 1,
      lastQuoteId: 0,
      updatedAt: new Date().toISOString(),
    },
    quotes: [],
  };
  const result = _saveToGithub(emptyDb);
  if (!result.success) return result;
  return { success: true, data: { message: 'Repository initialized.' } };
}

// ============================================================
// GITHUB I/O
// ============================================================

function _getGithubConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty(CONFIG.GITHUB_TOKEN),
    owner: props.getProperty(CONFIG.GITHUB_OWNER),
    repo: props.getProperty(CONFIG.GITHUB_REPO),
    file: props.getProperty(CONFIG.DATABASE_FILE),
  };
}

function _getFileInfo() {
  const { token, owner, repo, file } = _getGithubConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${file}`;
  const response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() === 404) return null;
  return JSON.parse(response.getContentText());
}

function loadDatabase() {
  try {
    const info = _getFileInfo();
    if (!info) {
      return { success: true, data: { meta: { version: 1, lastQuoteId: 0, updatedAt: '' }, quotes: [] } };
    }
    const content = Utilities.newBlob(Utilities.base64Decode(info.content.replace(/\n/g, ''))).getDataAsString();
    return { success: true, data: JSON.parse(content) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function _saveToGithub(db) {
  try {
    const { token, owner, repo, file } = _getGithubConfig();
    db.meta.updatedAt = new Date().toISOString();
    const content = Utilities.base64Encode(Utilities.newBlob(JSON.stringify(db, null, 2)).getBytes());
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${file}`;
    const info = _getFileInfo();
    const payload = {
      message: `update: ${new Date().toISOString()}`,
      content: content,
    };
    if (info) payload.sha = info.sha;
    const response = UrlFetchApp.fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const code = response.getResponseCode();
    if (code !== 200 && code !== 201) {
      return { success: false, error: `GitHub returned ${code}: ${response.getContentText()}` };
    }
    return { success: true, data: { message: 'Saved to GitHub.' } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// CRUD
// ============================================================

function addQuote(payload) {
  try {
    const { text, author, source, tags } = payload;
    if (!text || !author) return { success: false, error: 'text and author are required.' };
    const dbResult = loadDatabase();
    if (!dbResult.success) return dbResult;
    const db = dbResult.data;
    const now = new Date().toISOString();
    db.meta.lastQuoteId += 1;
    const quote = {
      id: db.meta.lastQuoteId,
      text: text.trim(),
      author: author.trim(),
      source: (source || '').trim(),
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
    };
    db.quotes.push(quote);
    const saveResult = _saveToGithub(db);
    if (!saveResult.success) return saveResult;
    syncSheet_(db);
    return { success: true, data: quote };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateQuote(payload) {
  try {
    const { id, text, author, source, tags } = payload;
    if (!id) return { success: false, error: 'id is required.' };
    const dbResult = loadDatabase();
    if (!dbResult.success) return dbResult;
    const db = dbResult.data;
    const idx = db.quotes.findIndex(q => q.id === Number(id));
    if (idx === -1) return { success: false, error: `Quote ${id} not found.` };
    const q = db.quotes[idx];
    if (text !== undefined) q.text = text.trim();
    if (author !== undefined) q.author = author.trim();
    if (source !== undefined) q.source = source.trim();
    if (tags !== undefined) q.tags = Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [];
    q.updatedAt = new Date().toISOString();
    const saveResult = _saveToGithub(db);
    if (!saveResult.success) return saveResult;
    syncSheet_(db);
    return { success: true, data: q };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteQuote(payload) {
  try {
    const { id } = payload;
    if (!id) return { success: false, error: 'id is required.' };
    const dbResult = loadDatabase();
    if (!dbResult.success) return dbResult;
    const db = dbResult.data;
    const idx = db.quotes.findIndex(q => q.id === Number(id));
    if (idx === -1) return { success: false, error: `Quote ${id} not found.` };
    db.quotes.splice(idx, 1);
    const saveResult = _saveToGithub(db);
    if (!saveResult.success) return saveResult;
    syncSheet_(db);
    return { success: true, data: { message: `Quote ${id} deleted.` } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// SHEET SYNC
// ============================================================

function syncSheet_(db) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Quotes');
    if (!sheet) {
      sheet = ss.insertSheet('Quotes');
    }
    sheet.clearContents();
    const headers = ['id', 'text', 'author', 'source', 'tags', 'createdAt', 'updatedAt'];
    const rows = [headers, ...db.quotes.map(q => [
      q.id, q.text, q.author, q.source,
      (q.tags || []).join(', '),
      q.createdAt, q.updatedAt,
    ])];
    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  } catch (e) {
    Logger.log('Sheet sync error: ' + e.message);
  }
}

function syncSheet() {
  try {
    const dbResult = loadDatabase();
    if (!dbResult.success) return dbResult;
    syncSheet_(dbResult.data);
    return { success: true, data: { message: 'Sheet synced.' } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// EXPORT
// ============================================================

function exportMarkdown() {
  try {
    const dbResult = loadDatabase();
    if (!dbResult.success) return dbResult;
    const quotes = dbResult.data.quotes;
    const byAuthor = {};
    quotes.forEach(q => {
      if (!byAuthor[q.author]) byAuthor[q.author] = [];
      byAuthor[q.author].push(q);
    });
    let md = '';
    Object.keys(byAuthor).sort().forEach(author => {
      md += `# ${author}\n\n`;
      byAuthor[author].forEach(q => {
        md += `## #${q.id}\n\n`;
        md += `> ${q.text}\n\n`;
        if (q.source) md += `Fonte: ${q.source}\n\n`;
        if (q.tags && q.tags.length) md += `Tags: ${q.tags.join(', ')}\n\n`;
        md += '---\n\n';
      });
    });
    return { success: true, data: { markdown: md } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// HTTP HANDLERS
// ============================================================

function doGet(e) {
  const action = e.parameter.action;
  let result;
  if (action === 'getData') {
    result = loadDatabase();
  } else {
    result = { success: false, error: `Unknown GET action: ${action}` };
  }
  return _jsonResponse(result);
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {}
  const action = body.action || e.parameter.action;
  let result;
  switch (action) {
    case 'createQuote':
      result = addQuote(body);
      break;
    case 'updateQuote':
      result = updateQuote(body);
      break;
    case 'deleteQuote':
      result = deleteQuote(body);
      break;
    case 'syncSheet':
      result = syncSheet();
      break;
    case 'exportMarkdown':
      result = exportMarkdown();
      break;
    default:
      result = { success: false, error: `Unknown action: ${action}` };
  }
  return _jsonResponse(result);
}

function _jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
