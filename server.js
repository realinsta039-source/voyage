const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const PORT = process.env.PORT || 3000;

var mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

var DATA_FILE = path.join(__dirname, 'data_users.json');
var VOTES_FILE = path.join(__dirname, 'data_votes.json');

function readData(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; }
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

    if (pathname === '/api/users' && req.method === 'POST') {
        var body = '';
        req.on('data', function(chunk) { body += chunk; });
        req.on('end', function() {
            try {
                var users = JSON.parse(body);
                writeData(DATA_FILE, users);
                sendJSON(res, 200, { ok: true });
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
                var votes = JSON.parse(body);
                writeData(VOTES_FILE, votes);
                sendJSON(res, 200, { ok: true });
            } catch (e) {
                sendJSON(res, 400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    var filePath = '.' + pathname.split('?')[0];
    if (filePath === './') filePath = './carrefour-maldives.html';

    var ext = String(path.extname(filePath)).toLowerCase();
    var contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, function(err, content) {
        if (err) {
            if (err.code === 'ENOENT') {
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
