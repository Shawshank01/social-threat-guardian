// /scripts/generateKey.js

//node run generateKey.js to get new VAPID keys
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("=== VAPID Keys ===");
console.log("VAPID_PUBLIC_KEY=", publicKey);
console.log("VAPID_PRIVATE_KEY=", privateKey);