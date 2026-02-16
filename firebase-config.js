// 1. Firebase modullarini import qilish (CDN orqali)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import {
    getFirestore, collection, getDocs, query, orderBy, doc,
    getDoc, setDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 2. Firebase Konfiguratsiyasi
const firebaseConfig = {
    apiKey: "AIzaSyD9swW0q42RDlxK5sJO4VSdUJZJVgifyH8",
    authDomain: "webbot-1db30.firebaseapp.com",
    projectId: "webbot-1db30",
    storageBucket: "webbot-1db30.firebasestorage.app",
    messagingSenderId: "329422258981",
    appId: "1:329422258981:web:38edc6733c853918d910cc",
    measurementId: "G-8PNV2E2J64"
};

// 3. Firebase-ni ishga tushirish
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// 4. Global xavfsiz obyekt (window.firebaseDB)
window.firebaseDB = {
    // Bazaga ulanish obyekti (agar kerak bo'lsa tashqarida ishlatish uchun)
    db, 

    // Rasmlarni yuklash
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

    // Testni saqlash
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

    // Parolni tekshirish
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

    // Testlar ro'yxatini olish
    async getTestsList() {
        try {
            const quizzesRef = collection(db, "quizzes");
            const q = query(quizzesRef, orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                questionsCount: doc.data().questions?.length || 0
            }));
        } catch (e) {
            console.error("Ro'yxatda xato:", e);
            return [];
        }
    },

    // Foydalanuvchi ma'lumotlarini olish
    async getUser(telegramId) {
        if (!telegramId) return null;
        try {
            const userRef = doc(db, "users", telegramId.toString());
            const userSnap = await getDoc(userRef);
            return userSnap.exists() ? userSnap.data() : null;
        } catch (error) {
            console.error("User olishda xato:", error);
            return null;
        }
    },

    // Foydalanuvchini saqlash yoki yangilash
    async saveUser(telegramId, userData) {
        if (!telegramId) return;
        try {
            const userRef = doc(db, "users", telegramId.toString());
            await setDoc(userRef, userData, { merge: true });
        } catch (error) {
            console.error("User saqlashda xato:", error);
        }
    }
};
