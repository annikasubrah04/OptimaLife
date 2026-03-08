import { GoogleGenAI } from "@google/genai";

function normalizeAdvice(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function sleepDurationText(totalSleepSeconds) {
  if (!totalSleepSeconds || Number.isNaN(totalSleepSeconds)) return "unknown";
  const hours = Math.floor(totalSleepSeconds / 3600);
  const minutes = Math.floor((totalSleepSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Missing GEMINI_API_KEY in Vercel environment variables.",
    });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const { sleep, readiness, activity } = body;

    if (!sleep && !readiness && !activity) {
      return res.status(400).json({
        error: "Missing sleep, readiness, and activity payload.",
      });
    }

    const totalSleepSeconds = sleep?.contributors?.total_sleep ?? null;
    const sleepEfficiency = sleep?.contributors?.efficiency ?? null;
    const deepSleep = sleep?.contributors?.deep_sleep ?? null;
    const remSleep = sleep?.contributors?.rem_sleep ?? null;
    const restfulness = sleep?.contributors?.restfulness ?? null;
    const timing = sleep?.contributors?.timing ?? null;

    const recoveryIndex = readiness?.contributors?.recovery_index ?? null;
    const previousNight = readiness?.contributors?.previous_night ?? null;
    const previousDayActivity = readiness?.contributors?.previous_day_activity ?? null;
    const sleepBalance = readiness?.contributors?.sleep_balance ?? null;
    const activityBalance = readiness?.contributors?.activity_balance ?? null;
    const hrvBalance = readiness?.contributors?.hrv_balance ?? null;
    const restingHeartRate = readiness?.contributors?.resting_heart_rate ?? null;
    const bodyTemperature = readiness?.contributors?.body_temperature ?? null;
    const temperatureDeviation = readiness?.temperature_deviation ?? null;

    const steps = activity?.steps ?? null;
    const activeCalories = activity?.active_calories ?? null;
    const equivalentWalkingDistance = activity?.equivalent_walking_distance ?? null;
    const mediumActivityTime = activity?.medium_activity_time ?? null;
    const highActivityTime = activity?.high_activity_time ?? null;
    const inactivityAlerts = activity?.inactivity_alerts ?? null;

    const prompt = `
You are a calm, premium wellness coach for a recovery-focused lifestyle app.

Your job:
- Give exactly 4 actionable recommendations for today.
- Keep each recommendation concise: 1 sentence each.
- Be specific, practical, and supportive.
- Focus on sleep, recovery, movement, hydration, stress, and timing.
- Do not mention that you are an AI.
- Do not restate all the raw numbers.
- Return plain text with one bullet per line.

User's latest Oura data:
Sleep score: ${sleep?.score ?? "unknown"}
Readiness score: ${readiness?.score ?? "unknown"}
Activity score: ${activity?.score ?? "unknown"}

Sleep duration: ${sleepDurationText(totalSleepSeconds)}
Sleep efficiency: ${sleepEfficiency ?? "unknown"}
Deep sleep score: ${deepSleep ?? "unknown"}
REM sleep score: ${remSleep ?? "unknown"}
Restfulness: ${restfulness ?? "unknown"}
Sleep timing: ${timing ?? "unknown"}

Recovery index: ${recoveryIndex ?? "unknown"}
Previous night contribution: ${previousNight ?? "unknown"}
Previous day activity contribution: ${previousDayActivity ?? "unknown"}
Sleep balance: ${sleepBalance ?? "unknown"}
Activity balance: ${activityBalance ?? "unknown"}
HRV balance: ${hrvBalance ?? "unknown"}
Resting heart rate contribution: ${restingHeartRate ?? "unknown"}
Body temperature contribution: ${bodyTemperature ?? "unknown"}
Temperature deviation: ${temperatureDeviation ?? "unknown"}

Steps: ${steps ?? "unknown"}
Active calories: ${activeCalories ?? "unknown"}
Equivalent walking distance: ${equivalentWalkingDistance ?? "unknown"}
Medium activity time (seconds): ${mediumActivityTime ?? "unknown"}
High activity time (seconds): ${highActivityTime ?? "unknown"}
Inactivity alerts: ${inactivityAlerts ?? "unknown"}

Tone:
- serene
- encouraging
- polished
- wellness-retreat vibe
`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text?.trim() || "";
    const adviceItems = normalizeAdvice(text);

    if (!adviceItems.length) {
      return res.status(500).json({
        error: "Gemini returned an empty response.",
      });
    }

    return res.status(200).json({
      advice: text,
      adviceItems,
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Unknown server error",
    });
  }
}