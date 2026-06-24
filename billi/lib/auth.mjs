// Passcode lock for Billi.
//
// When BILLI_PASSCODE is set (always set it on any host reachable off your own
// machine), every page and API call requires a valid session cookie, obtained
// by entering the passcode once. With no BILLI_PASSCODE set, auth is off — fine
// for local use on your own Mac, never for a public URL.
//
// The session cookie holds an HMAC of the passcode under a server secret, so
// the passcode itself is never stored in the cookie and the value can't be
// forged without the secret.

import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "billi_session";

export function authEnabled() {
  return Boolean(process.env.BILLI_PASSCODE);
}

// A stable secret for signing. Derived from the passcode if none is given, so
// auth still works with just BILLI_PASSCODE set.
function secret() {
  return process.env.BILLI_SESSION_SECRET || `billi:${process.env.BILLI_PASSCODE}`;
}

function expectedToken() {
  return createHmac("sha256", secret()).update("session-v1").digest("hex");
}

export function checkPasscode(passcode) {
  const given = String(passcode || "");
  const real = String(process.env.BILLI_PASSCODE || "");
  if (!real || given.length !== real.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(real));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function isAuthed(req) {
  if (!authEnabled()) return true;
  const token = parseCookies(req)[COOKIE];
  if (!token) return false;
  const expected = expectedToken();
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function sessionCookie(req) {
  const https = (req.headers["x-forwarded-proto"] || "").includes("https");
  const parts = [
    `${COOKIE}=${expectedToken()}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`, // 30 days
  ];
  if (https) parts.push("Secure");
  return parts.join("; ");
}

// A small self-contained login page (no external assets needed).
export function loginPage() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Billi</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font:16px/1.5 system-ui,-apple-system,sans-serif; color:#f3eefb;
    background:radial-gradient(60% 45% at 50% 0%,#3a2c52,transparent 70%),linear-gradient(160deg,#241a34,#1a1426 60%,#1e1830); }
  form { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); border-radius:22px;
    padding:34px 30px; width:min(360px,90vw); text-align:center; backdrop-filter:blur(16px); }
  h1 { font-family:Georgia,serif; font-style:italic; font-weight:600; margin:0 0 6px; font-size:34px; }
  h1 em { color:#8685fd; font-style:italic; }
  p { color:rgba(243,238,251,0.6); margin:0 0 22px; font-size:14px; }
  input { width:100%; padding:13px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.25);
    background:rgba(255,255,255,0.1); color:#fff; font-size:16px; text-align:center; letter-spacing:0.3em; }
  input::placeholder { letter-spacing:normal; color:rgba(243,238,251,0.4); }
  button { margin-top:14px; width:100%; padding:13px; border:none; border-radius:999px; cursor:pointer;
    background:#8685fd; color:#fff; font-size:15px; font-weight:600; }
  .err { color:#f0a3a3; font-size:13px; min-height:18px; margin-top:10px; }
</style>
</head><body>
<form id="f">
  <h1>Bil<em>li</em></h1>
  <p>Enter your passcode</p>
  <input id="p" type="password" inputmode="numeric" placeholder="passcode" autocomplete="current-password" autofocus />
  <button type="submit">Unlock</button>
  <div class="err" id="e"></div>
</form>
<script>
  const f=document.getElementById('f'),p=document.getElementById('p'),e=document.getElementById('e');
  f.addEventListener('submit',async(ev)=>{ev.preventDefault();e.textContent='';
    const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({passcode:p.value})});
    if(r.ok){location.href='/';}else{e.textContent='Wrong passcode';p.value='';p.focus();}});
</script>
</body></html>`;
}
