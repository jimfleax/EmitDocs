import { honoApp } from './api/index.ts';

async function test() {
  console.log("Sending request 1...");
  await honoApp.request('http://localhost/api/');
  
  console.log("Sending request 2...");
  await honoApp.request('http://localhost/api/');
  
  console.log("Sending request 3...");
  await honoApp.request('http://localhost/api/');
  
  console.log("Test finished!");
  process.exit(0);
}
test();
