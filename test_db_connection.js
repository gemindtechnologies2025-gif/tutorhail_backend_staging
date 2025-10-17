/**
 * Quick Database Connection Test
 * Tests if MongoDB is running on port 27020
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.develop' });

const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...\n');
    
    const dbUri = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorhail';
    console.log('Database URI:', dbUri);
    
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // 5 second timeout
    });
    
    console.log('✅ Successfully connected to database!');
    
    // Test a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name));
    
    // Test User collection
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const userCount = await User.countDocuments();
    console.log('👥 Total users in database:', userCount);
    
    await mongoose.connection.close();
    console.log('✅ Connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Possible solutions:');
      console.log('1. Make sure MongoDB is running on port 27020');
      console.log('2. Check if the database name is correct');
      console.log('3. Try starting MongoDB: brew services start mongodb-community');
      console.log('4. Or start with: mongod --port 27020 --dbpath /path/to/your/data');
    }
    
    process.exit(1);
  }
};

testConnection();
