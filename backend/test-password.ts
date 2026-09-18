import * as bcrypt from 'bcryptjs';

const password = 'Armigo@2026';
const hash = '$2b$10$.e7l/rRMPgZovVJ98pzQL.uHnQzNnZwY9DGr/MstZ5E9.BAedVdgS';

async function test() {
  const isValid = await bcrypt.compare(password, hash);
  console.log('Password verification:', isValid ? '✅ OK' : '❌ Failed');
  
  // Also show what hash would be generated for this password
  const newHash = await bcrypt.hash(password, 10);
  console.log('New hash for same password:', newHash);
}

test();