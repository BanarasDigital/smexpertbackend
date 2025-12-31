import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";

const KEY_FILE = process.env.SERVICE_ACCOUNT_KEY_PATH;
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
});

async function getAccessToken() {
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res || !res.token) throw new Error("Failed to get access token");
  return res.token;
}

// export async function sendToToken(token, payload) {
//   const accessToken = await getAccessToken();

//   const message = {
//     message: {
//       token,

//       // ✅ REQUIRED FOR APK SYSTEM NOTIFICATION
//       notification: {
//         title: payload.notification.title,
//         body: payload.notification.body,
//       },

//       data: {
//         ...payload.data, // used for routing
//       },

//       android: {
//         priority: "HIGH",
//         notification: {
//           channelId: "default",
//           sound: "default",
//         },
//       },
//     },
//   };

//   const res = await fetch(FCM_URL, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(message),
//   });

//   return res.json();
// }

// utils/fcmClient.js
export async function sendToToken(token, payload) {
  const accessToken = await getAccessToken();

  const message = {
    message: {
      token,

      notification: {
        title: payload.data.title,
        body: payload.data.body,
      },

      data: payload.data,

      android: {
        priority: "HIGH",
        notification: {
          channelId: "default",
          sound: "default",
        },
      },
    },
  };

  const res = await fetch(FCM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  return res.json();
}


