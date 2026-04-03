try {
  const { authAdmin, dbAdmin, admin } = require('./firebaseAdmin');

  console.log('Firebase Admin OK');
  console.log('Project ID:', admin.app().options.projectId || '(auto-detect)');
  console.log('Auth loaded:', !!authAdmin);
  console.log('Firestore loaded:', !!dbAdmin);
} catch (error) {
  console.error('Firebase Admin init failed');
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
}
