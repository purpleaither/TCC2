const {chromium, firefox, webkit} = require('playwright');

const browsers = {chromium, firefox, webkit};
const name = process.env.TCC_BROWSER || 'chromium';
if (!Object.hasOwn(browsers, name)) throw Error('Navegador inválido: ' + name);
module.exports = browsers[name];
