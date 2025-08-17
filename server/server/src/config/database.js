const mongoose = require('mongoose');

const connectDatabase = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena';
        
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4 // Use IPv4
        };

        const conn = await mongoose.connect(mongoUri, options);
        
        console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
        console.log(`📁 Base de données: ${conn.connection.name}`);
        
        // Gestion des événements de connexion
        mongoose.connection.on('error', (err) => {
            console.error('❌ Erreur MongoDB:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB déconnecté');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnecté');
        });
        
    } catch (error) {
        console.error('❌ Erreur de connexion MongoDB:', error.message);
        process.exit(1);
    }
};

const disconnectDatabase = async () => {
    try {
        await mongoose.connection.close();
        console.log('📴 MongoDB déconnecté proprement');
    } catch (error) {
        console.error('❌ Erreur lors de la déconnexion MongoDB:', error);
    }
};

// Fermeture propre de la base de données
process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
});

module.exports = {
    connectDatabase,
    disconnectDatabase
};
