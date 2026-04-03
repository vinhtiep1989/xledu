// Sample Express handler for POST /api/admin/delete-user
// Requires firebase-admin initialization elsewhere.

const admin = require('firebase-admin');

async function deleteUserHandler(req, res) {
  try {
    const requester = req.user || {};
    const requesterRoles = Array.isArray(requester.roles) ? requester.roles : [];
    const isAdmin = requesterRoles.includes('admin') || requester.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const uidFromClient = String(req.body?.uid || '').trim();
    const docId = String(req.body?.docId || '').trim();

    if (!email) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED' });
    }

    const requesterEmail = String(requester.email || '').trim().toLowerCase();
    if (requesterEmail && requesterEmail === email) {
      return res.status(400).json({ error: 'CANNOT_DELETE_SELF' });
    }

    const db = admin.firestore();
    const usersCol = db.collection('users');

    let authUser = null;
    try {
      authUser = uidFromClient
        ? await admin.auth().getUser(uidFromClient)
        : await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err?.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    const uid = authUser?.uid || uidFromClient || '';

    const refs = new Map();
    const addRef = (ref) => {
      if (ref?.path) refs.set(ref.path, ref);
    };

    const directKeys = [docId, email, uid].filter(Boolean);
    for (const key of directKeys) {
      const ref = usersCol.doc(key);
      const snap = await ref.get();
      if (snap.exists) addRef(ref);
    }

    const emailSnap = await usersCol.where('email', '==', email).get();
    emailSnap.forEach((doc) => addRef(doc.ref));

    if (uid) {
      const uidSnap = await usersCol.where('uid', '==', uid).get();
      uidSnap.forEach((doc) => addRef(doc.ref));

      const authUidSnap = await usersCol.where('authUid', '==', uid).get();
      authUidSnap.forEach((doc) => addRef(doc.ref));
    }

    let firestoreDeleted = true;
    if (refs.size) {
      const batch = db.batch();
      for (const ref of refs.values()) batch.delete(ref);
      await batch.commit();
    }

    const verifyDocChecks = [];
    for (const key of directKeys) {
      verifyDocChecks.push(usersCol.doc(key).get());
    }
    const verifyDirect = await Promise.all(verifyDocChecks);
    firestoreDeleted = verifyDirect.every((snap) => !snap.exists);

    if (firestoreDeleted && email) {
      const verifyEmail = await usersCol.where('email', '==', email).limit(1).get();
      firestoreDeleted = verifyEmail.empty;
    }
    if (firestoreDeleted && uid) {
      const verifyUid = await usersCol.where('uid', '==', uid).limit(1).get();
      const verifyAuthUid = await usersCol.where('authUid', '==', uid).limit(1).get();
      firestoreDeleted = verifyUid.empty && verifyAuthUid.empty;
    }

    let authDeleted = false;
    if (authUser?.uid) {
      await admin.auth().deleteUser(authUser.uid);
      authDeleted = true;
    }

    if (authDeleted && authUser?.uid) {
      try {
        await admin.auth().getUser(authUser.uid);
        authDeleted = false;
      } catch (err) {
        if (err?.code !== 'auth/user-not-found') throw err;
        authDeleted = true;
      }
    }

    if (!authDeleted) {
      return res.status(409).json({
        error: 'DELETE_AUTH_NOT_CONFIRMED',
        email,
        uid,
        firestoreDeleted
      });
    }

    if (!firestoreDeleted) {
      return res.status(409).json({
        error: 'DELETE_FIRESTORE_NOT_CONFIRMED',
        email,
        uid,
        authDeleted
      });
    }

    return res.json({
      success: true,
      deleted: true,
      authDeleted: true,
      firestoreDeleted: true,
      email,
      uid
    });
  } catch (error) {
    console.error('delete-user failed:', error);
    return res.status(500).json({
      error: error?.code || error?.message || 'DELETE_USER_FAILED'
    });
  }
}

module.exports = { deleteUserHandler };
