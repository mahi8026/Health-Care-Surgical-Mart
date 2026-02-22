// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGCOhLgDSooqfDzDKDfJhDjv0VaiauJrA",
  authDomain: "health-care-60ee6.firebaseapp.com",
  projectId: "health-care-60ee6",
  storageBucket: "health-care-60ee6.firebasestorage.app",
  messagingSenderId: "650347403792",
  appId: "1:650347403792:web:d4ead8c6ce94991fbdc895",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;
