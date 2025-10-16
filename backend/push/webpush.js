// /push/webpush.js
import webpush from "web-push";
import dotenv from "dotenv";
dotenv.config();

// Validate required envs for VAPID
const required = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[WebPush] Missing env: ${k}`);
  }
}

// Configure VAPID
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,           
  process.env.VAPID_PUBLIC_KEY,      // public key
  process.env.VAPID_PRIVATE_KEY      // private key
);

export const getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY;

export const sendToSubscription = async (subscription, payloadObj) => {
  const payload = JSON.stringify(payloadObj ?? { title: "Hello", body: "Test push" });
  return webpush.sendNotification(subscription, payload);
};

export default webpush;