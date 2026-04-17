/**
 * Run this once with Node.js to download the Firebase compat bundle:
 *   node download-firebase.js
 *
 * It saves firebase-compat.js which is required by the extension.
 */
const https = require("https");
const fs = require("fs");

const url = "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
const url2 = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js";

function download(src, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest, { flags: "a" });
    https.get(src, res => {
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

(async () => {
  console.log("Downloading Firebase app compat...");
  await download(url, "firebase-compat.js");
  console.log("Downloading Firebase Firestore compat...");
  await download(url2, "firebase-compat.js");
  console.log("Done! firebase-compat.js is ready.");
})();
