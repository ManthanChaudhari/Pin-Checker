const https = require("https");
const fs = require("fs");

https.get("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js", res => {
  const file = fs.createWriteStream("firebase-auth-compat.js");
  res.pipe(file);
  file.on("finish", () => { file.close(); console.log("done"); });
}).on("error", e => { console.error(e.message); process.exit(1); });
