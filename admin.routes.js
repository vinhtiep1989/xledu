const express = require('express');
const { admin, authAdmin, dbAdmin } = require('./firebaseAdmin');

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRoles(data) {
  const rawRoles = Array.isArray(data && data.roles)
    ? data.roles
    : (data && data.role ? [data.role] : []);

  return [...new Set(
    rawRoles
      .map((role) => String(role || '').trim().toLowerCase())
      .filter((role) => ['teacher', 'manager', 'admin'].includes(role))
  )];
}

function isInvalidTokenError(error) {
  return [
    'auth/argument-error',
    'auth/id-token-expired',
    'auth/id-token-revoked',
    'auth/invalid-id-token'
  ].includes(error && error.code);
}

function isFirebaseAdminConfigError(error) {
  const message = String((error && error.message) || '').toLowerCase();

  return (
    message.includes('project id') ||
    message.includes('application default credentials') ||
    message.includes('credential implementation')
  );
}

async function getUserProfileByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  const directDoc = await dbAdmin.collection('users').doc(normalizedEmail).get();
  if (directDoc.exists) {
    return { id: directDoc.id, ...(directDoc.data() || {}) };
  }

  const snap = await dbAdmin
    .collection('users')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (!snap.empty) {
    return { id: snap.docs[0].id, ...(snap.docs[0].data() || {}) };
  }

  return null;
}

async function getUserProfileRefByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  const directRef = dbAdmin.collection('users').doc(normalizedEmail);
  const directDoc = await directRef.get();
  if (directDoc.exists) {
    return { ref: directRef, data: directDoc.data() || {} };
  }

  const snap = await dbAdmin
    .collection('users')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (!snap.empty) {
    return { ref: snap.docs[0].ref, data: snap.docs[0].data() || {} };
  }

  return null;
}

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const err = new Error('NO_TOKEN');
    err.statusCode = 401;
    throw err;
  }

  const idToken = match[1];
  let decoded;

  try {
    decoded = await authAdmin.verifyIdToken(idToken);
  } catch (error) {
    if (isInvalidTokenError(error)) {
      const err = new Error('INVALID_TOKEN');
      err.statusCode = 401;
      throw err;
    }

    throw error;
  }

  const requesterEmail = normalizeEmail(decoded.email);
  if (!requesterEmail) {
    const err = new Error('INVALID_TOKEN');
    err.statusCode = 401;
    throw err;
  }

  const requesterProfile = await getUserProfileByEmail(requesterEmail);
  const roles = normalizeRoles(requesterProfile || {});

  if (!roles.includes('admin')) {
    const err = new Error('FORBIDDEN');
    err.statusCode = 403;
    throw err;
  }

  return {
    uid: decoded.uid,
    email: requesterEmail,
    profile: requesterProfile
  };
}

router.post('/set-temp-password', async (req, res) => {
  try {
    const requester = await requireAdmin(req);

    const email = normalizeEmail(req.body && req.body.email);
    const newPassword = String((req.body && req.body.newPassword) || '');

    if (!email) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'WEAK_PASSWORD' });
    }

    const userRecord = await authAdmin.getUserByEmail(email);

    await authAdmin.updateUser(userRecord.uid, {
      password: newPassword
    });

    await authAdmin.revokeRefreshTokens(userRecord.uid);

    const profileEntry = await getUserProfileRefByEmail(email);
    const payload = {
      email,
      uid: userRecord.uid,
      authUid: userRecord.uid,
      passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordStorageVersion: 'none',
      passwordRemovedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: requester.email,
      password: admin.firestore.FieldValue.delete()
    };

    if (profileEntry && profileEntry.ref) {
      await profileEntry.ref.set(payload, { merge: true });
    } else {
      await dbAdmin.collection('users').doc(email).set(payload, { merge: true });
    }

    return res.status(200).json({
      success: true,
      authUpdated: true,
      uid: userRecord.uid,
      email
    });
  } catch (error) {
    console.error('set-temp-password error:', error);

    const message = String((error && error.message) || '');

    if (message.includes('NO_TOKEN')) {
      return res.status(401).json({ error: 'NO_TOKEN' });
    }
    if (message.includes('INVALID_TOKEN')) {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }
    if (message.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    if (error && error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }
    if (error && error.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'WEAK_PASSWORD' });
    }
    if (isFirebaseAdminConfigError(error)) {
      return res.status(500).json({
        error: 'FIREBASE_ADMIN_NOT_CONFIGURED'
      });
    }

    return res.status(500).json({
      error: 'SET_PASSWORD_FAILED',
      message: (error && error.message) || 'Unknown error'
    });
  }
});

module.exports = router;
