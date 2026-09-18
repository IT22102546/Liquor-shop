const path = require('path');
const fs = require('fs');

// Try to find the app module
const possiblePaths = [
  './dist/app.module',
  './dist/src/app.module',
  '../../dist/apps/backend/app.module',
  '../../dist/apps/backend/src/app.module',
];

let AppModule = null;
let foundPath = null;

for (const p of possiblePaths) {
  try {
    const fullPath = path.resolve(p);
    if (fs.existsSync(fullPath + '.js') || fs.existsSync(fullPath + '.ts')) {
      AppModule = require(p);
      foundPath = p;
      console.log(`✅ Found app module at: ${p}`);
      break;
    }
  } catch (e) {
    // Continue trying
  }
}

if (!AppModule) {
  console.error('❌ Could not find app.module. Available files:');
  
  // Search for any .js files that might be the app module
  const findResult = require('child_process').execSync('dir /s *.js', { encoding: 'utf8' });
  console.log(findResult.substring(0, 500)); // Show first 500 chars
  
  process.exit(1);
}

const { NestFactory } = require('@nestjs/core');

async function bootstrap() {
  console.log('Creating application...');
  const app = await NestFactory.create(AppModule, { logger: false });
  
  const server = app.getHttpServer();
  const router = server._events?.request?._router;
  
  if (router && router.stack) {
    console.log(`\nFound ${router.stack.length} route layers`);
    
    const routes = [];
    router.stack.forEach(layer => {
      if (layer.route) {
        const path = layer.route.path;
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        routes.push({ methods, path });
      }
    });
    
    console.log('\nAll registered routes:');
    routes.sort((a, b) => a.path.localeCompare(b.path));
    routes.forEach(route => {
      console.log(`${route.methods} ${route.path}`);
    });
    
    console.log(`\nTotal routes: ${routes.length}`);
  } else {
    console.log('No router found');
  }
  
  await app.close();
}

bootstrap().catch(console.error);