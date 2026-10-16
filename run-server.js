import { createServer } from './server.js';
const port = Number(process.env.PORT || 3000);
createServer().listen(port, '0.0.0.0', () => console.log(`IP Locator listening on port ${port}`));
