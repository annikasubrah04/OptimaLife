export default async function handler(req, res) {
  // Allow frontend requests (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing access token" });
    }

    // Get date range: last 7 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const [sleepRes, readinessRes, activityRes] = await Promise.all([
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      ),
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      ),
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      ),
    ]);

    if (!sleepRes.ok || !readinessRes.ok || !activityRes.ok) {
      return res.status(500).json({
        error: "Failed to fetch data from Oura",
        sleepStatus: sleepRes.status,
        readinessStatus: readinessRes.status,
        activityStatus: activityRes.status,
      });
    }

    const sleep = await sleepRes.json();
    const readiness = await readinessRes.json();
    const activity = await activityRes.json();

    res.status(200).json({
      sleep,
      readiness,
      activity,
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
}