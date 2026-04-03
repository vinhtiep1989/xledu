require('dotenv').config();

const admin = require('firebase-admin');

function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

function resolveCredential() {
  const inlineServiceAccount =
    parseJsonEnv('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    parseJsonEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON');

  if (inlineServiceAccount) {
    return admin.credential.cert(inlineServiceAccount);
  }

  return admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  const options = {
    credential: resolveCredential()
  };

  if (projectId) {
    options.projectId = projectId;
  }

  admin.initializeApp(options);
}

const authAdmin = admin.auth();
const dbAdmin = admin.firestore();

module.exports = { admin, authAdmin, dbAdmin };
