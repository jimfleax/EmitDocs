import { honoApp } from './api/index.ts';

async function test() {
  const res = await honoApp.request('http://localhost/api/health');
  const data = await res.json();
  console.log("Health API Response:", data);
  process.exit(0);
}
test();
