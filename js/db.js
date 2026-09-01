import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const dbase = getFirestore(app);

// ---------- Auth ----------
export function watchAuth(cb) {
  onAuthStateChanged(auth, cb);
}
export function signIn() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}
export function signOutUser() {
  return signOut(auth);
}

// ---------- Generic helpers ----------
async function getAll(colName, ...constraints) {
  const q = constraints.length
    ? query(collection(dbase, colName), ...constraints)
    : collection(dbase, colName);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Units ----------
export const Units = {
  list: () => getAll("units", orderBy("order", "asc")),
  add: (data) => addDoc(collection(dbase, "units"), data),
  update: (id, data) => updateDoc(doc(dbase, "units", id), data),
  remove: (id) => deleteDoc(doc(dbase, "units", id)),
};

// ---------- Tenancies ----------
export const Tenancies = {
  list: () => getAll("tenancies", orderBy("startDate", "desc")),
  listByUnit: (unitId) => getAll("tenancies", where("unitId", "==", unitId)),
  add: (data) => addDoc(collection(dbase, "tenancies"), data),
  update: (id, data) => updateDoc(doc(dbase, "tenancies", id), data),
  remove: (id) => deleteDoc(doc(dbase, "tenancies", id)),
};

// ---------- Payments ----------
export const Payments = {
  listByYear: (year) =>
    getAll(
      "payments",
      where("month", ">=", `${year}-01`),
      where("month", "<=", `${year}-12`)
    ),
  listByTenancy: (tenancyId) => getAll("payments", where("tenancyId", "==", tenancyId)),
  get: async (id) => {
    const s = await getDoc(doc(dbase, "payments", id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  },
  add: (data) => addDoc(collection(dbase, "payments"), data),
  update: (id, data) => updateDoc(doc(dbase, "payments", id), data),
  remove: (id) => deleteDoc(doc(dbase, "payments", id)),
};

// ---------- Expenses ----------
export const Expenses = {
  listByYear: (year) => getAll("expenses", where("year", "==", Number(year))),
  add: (data) => addDoc(collection(dbase, "expenses"), data),
  update: (id, data) => updateDoc(doc(dbase, "expenses", id), data),
  remove: (id) => deleteDoc(doc(dbase, "expenses", id)),
};

