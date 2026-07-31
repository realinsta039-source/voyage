const http = require('http');
const fs = require('fs');
const path = require('path');
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

http.createServer(function(req, res) {
    var filePath = '.' + req.url.split('?')[0];
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
