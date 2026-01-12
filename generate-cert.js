const selfsigned = require('selfsigned');
const fs = require('fs');
const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, { days: 365 });
fs.writeFileSync('server.key', pems.private);
fs.writeFileSync('server.cert', pems.cert);
console.log('Self-signed certificate and key generated!');