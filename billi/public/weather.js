// Billi dashboard — local weather.
// Today's icon and high/low for wherever Cara is. No API key: Open-Meteo is
// free and CORS-friendly. Location comes from the browser first, then an IP
// fallback if she declines the prompt. Units follow the country (Fahrenheit in
// the US, Celsius elsewhere — so it does the right thing after the Lyon move).

const el = {
  box: document.getElementById("weather"),
  icon: document.getElementById("weather-icon"),
  hi: document.getElementById("w-hi"),
  lo: document.getElementById("w-lo"),
  place: document.getElementById("weather-place"),
};

// WMO weather codes -> a simple emoji icon.
function codeToIcon(code) {
  if (code === 0) return "☀️";
  if (code === 1) return "🌤️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code === 85 || code === 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

// Fahrenheit only in the handful of places that use it; Celsius everywhere else.
function unitForCountry(countryCode) {
  return ["US", "BS", "KY", "LR", "PW", "FM", "MH"].includes(countryCode)
    ? "fahrenheit"
    : "celsius";
}

function browserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

async function ipLocation() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d.latitude !== "number") return null;
    return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country_code };
  } catch {
    return null;
  }
}

// Reverse-geocode a city name + country (no key). Best-effort.
async function describe(lat, lon) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (!res.ok) return {};
    const d = await res.json();
    return { city: d.city || d.locality || d.principalSubdivision, country: d.countryCode };
  } catch {
    return {};
  }
}

async function load() {
  let loc = await browserLocation();
  let city, country;
  if (loc) {
    const info = await describe(loc.lat, loc.lon);
    city = info.city;
    country = info.country;
  } else {
    loc = await ipLocation();
    if (!loc) return; // give up quietly
    city = loc.city;
    country = loc.country;
  }

  const unit = unitForCountry(country);
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
        `&temperature_unit=${unit}&timezone=auto&forecast_days=1`,
    );
    if (!res.ok) return;
    const d = await res.json();
    const code = d.daily.weather_code[0];
    const hi = Math.round(d.daily.temperature_2m_max[0]);
    const lo = Math.round(d.daily.temperature_2m_min[0]);

    el.icon.textContent = codeToIcon(code);
    el.hi.textContent = hi;
    el.lo.textContent = lo;
    el.place.textContent = city ? city : "";
    el.box.title = `Today in ${city || "your area"}: high ${hi}°, low ${lo}°`;
    el.box.hidden = false;
  } catch {
    /* weather is a nicety — stay hidden on failure */
  }
}

load();
