import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, doc,
    getDoc, setDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Global xavfsiz obyekt
window.firebaseDB = {
    // 1. Rasmlarni yuklash (Faqat admin ruxsati bilan storage rules orqali himoyalanadi)
    async uploadImage(fileOrBase64) {
        if (!fileOrBase64) return null;
        try {
            const fileName = `quiz_images/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
            const fileRef = ref(storage, fileName);
            if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:image')) {
                await uploadString(fileRef, fileOrBase64, 'data_url');
            } else {
                await uploadBytes(fileRef, fileOrBase64);
            }
            return await getDownloadURL(fileRef);
        } catch (error) {
            console.error("Storage xatoligi:", error);
            return null;
        }
    },

    // 2. Testni saqlash (Bazadagi xavfsizlik qoidalari buni himoya qiladi)
    async saveQuiz(quizData) {
        try {
            const quizzesRef = collection(db, "quizzes");
            const docRef = await addDoc(quizzesRef, {
                ...quizData,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Quiz saqlashda xatolik:", error);
            throw new Error("Ruxsat berilmadi: Faqat adminlar test qo'shishi mumkin.");
        }
    },

    // 3. Parolni tekshirish
    async getQuizPassword(quizId) {
        try {
            const docRef = doc(db, "quizzes", quizId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data().password : null;
        } catch (error) {
            console.error("Parol olishda xato:", error);
            return null;
        }
    },

    // 4. Testlar ro'yxatini olish
    async getTestsList() {
        try {
            const quizzesRef = collection(db, "quizzes");
            const q = query(quizzesRef, orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(), // Barcha ma'lumotlarni olish
                questionsCount: doc.data().questions?.length || 0
            }));
        } catch (e) {
            console.error("Ro'yxatda xato:", e);
            return [];
        }
    },

    // 5. Foydalanuvchi funksiyalari
    async getUser(telegramId) {
        if (!telegramId) return null;
        const userRef = doc(db, "users", telegramId.toString());
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? userSnap.data() : null;
    },

    async saveUser(telegramId, userData) {
        if (!telegramId) return;
        const userRef = doc(db, "users", telegramId.toString());
        await setDoc(userRef, userData, { merge: true });
    },

    // app.js va admin.js metodlari uchun zarur ulanishlar
    db, doc, getDoc, collection
};