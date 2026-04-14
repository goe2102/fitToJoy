// Open-Meteo — free, no API key required
// Docs: https://open-meteo.com/en/docs

export type WeatherData = {
  temp: number          // °C
  code: number          // WMO weather code
  label: string         // human-readable condition
  icon: string          // Ionicons name
  precipProb: number    // 0–100 %
  windKph: number       // km/h
}

// ─── WMO weather code → label + icon ─────────────────────────────────────────

function decodeWMO(code: number): { label: string; icon: string } {
  if (code === 0)              return { label: 'Clear sky',        icon: 'sunny-outline' }
  if (code === 1)              return { label: 'Mainly clear',     icon: 'sunny-outline' }
  if (code === 2)              return { label: 'Partly cloudy',    icon: 'partly-sunny-outline' }
  if (code === 3)              return { label: 'Overcast',         icon: 'cloud-outline' }
  if (code <= 48)              return { label: 'Foggy',            icon: 'cloud-outline' }
  if (code <= 55)              return { label: 'Drizzle',          icon: 'rainy-outline' }
  if (code <= 57)              return { label: 'Freezing drizzle', icon: 'rainy-outline' }
  if (code <= 65)              return { label: 'Rain',             icon: 'rainy-outline' }
  if (code <= 67)              return { label: 'Freezing rain',    icon: 'rainy-outline' }
  if (code <= 75)              return { label: 'Snow',             icon: 'snow-outline' }
  if (code === 77)             return { label: 'Snow grains',      icon: 'snow-outline' }
  if (code <= 82)              return { label: 'Rain showers',     icon: 'rainy-outline' }
  if (code <= 86)              return { label: 'Snow showers',     icon: 'snow-outline' }
  if (code === 95)             return { label: 'Thunderstorm',     icon: 'thunderstorm-outline' }
  if (code <= 99)              return { label: 'Thunderstorm',     icon: 'thunderstorm-outline' }
  return { label: 'Unknown', icon: 'cloud-outline' }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchWeather(
  latitude: number,
  longitude: number,
  date: string,       // YYYY-MM-DD
  startTime: string,  // HH:MM
): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&hourly=temperature_2m,weathercode,precipitation_probability,windspeed_10m` +
      `&timezone=auto` +
      `&start_date=${date}&end_date=${date}`

    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()

    const times: string[] = json.hourly?.time ?? []
    if (!times.length) return null

    // Find the index of the hour closest to start_time
    const [h, m] = startTime.split(':').map(Number)
    const targetHour = h + m / 60
    let bestIdx = 0
    let bestDiff = Infinity
    times.forEach((t, i) => {
      const hourStr = t.split('T')[1] ?? '00:00'
      const [hh, mm] = hourStr.split(':').map(Number)
      const diff = Math.abs(hh + mm / 60 - targetHour)
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
    })

    const temp      = Math.round(json.hourly.temperature_2m[bestIdx])
    const code      = json.hourly.weathercode[bestIdx] as number
    const precipProb = json.hourly.precipitation_probability[bestIdx] as number ?? 0
    const windKph   = Math.round(json.hourly.windspeed_10m[bestIdx])
    const { label, icon } = decodeWMO(code)

    return { temp, code, label, icon, precipProb, windKph }
  } catch {
    return null
  }
}
