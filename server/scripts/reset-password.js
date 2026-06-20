const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

async function resetPassword() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const email = 'healthcaresurgicalmart@gmail.com';
  const newPassword = 'test123';
  const passwordHash = await bcrypt.hash(newPassword, 12);
  
  // Update in new schema
  const shopDb = client.db('shop_6a020466789ca874348b2557');
  const result1 = await shopDb.collection('users').updateOne(
    { email },
    { $set: { passwordHash, password: passwordHash, updatedAt: new Date() } }
  );
  
  // Update in old schema
  const systemDb = client.db(process.env.DB_NAME);
  const result2 = await systemDb.collection('shop_health_care_01_users').updateOne(
    { email },
    { $set: { password: passwordHash, passwordHash, updatedAt: new Date() } }
  );
  
  console.log(`\n✅ Password reset for ${email}`);
  console.log(`   New password: ${newPassword}`);
  console.log(`   Updated in new schema: ${result1.modifiedCount} document(s)`);
  console.log(`   Updated in old schema: ${result2.modifiedCount} document(s)`);
  console.log();
  
  await client.close();
}

resetPassword().catch(console.error);
