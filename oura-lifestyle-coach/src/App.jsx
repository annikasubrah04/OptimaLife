import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Moon,
  Activity,
  BatteryCharging,
  HeartPulse,
  Link2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  LogOut,
} from "lucide-react";

const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_API_BASE = "https://api.ouraring.com/v2";

const CLIENT_ID = import.meta.env.VITE_OURA_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_OURA_REDIRECT_URI;
const OURA_SCOPES = "daily personal";

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function createStateValue() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function scoreLabel(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  return "Needs attention";
}

function scoreColor(score) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-cyan-400";
  if (score >= 55) return "text-amber-400";
  return "text-rose-400";
}

function extractLatestRecord(responseData) {
  if (!responseData || !Array.isArray(responseData.data) || responseData.data.length === 0) {
    return null;
  }

  return [...responseData.data].sort((a, b) => {
    const aDate = new Date(a.day ?? 0).getTime();
    const bDate = new Date(b.day ?? 0).getTime();
    return bDate - aDate;
  })[0];
}

function getErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    const apiDetail =
      error.response?.data?.detail ||
      error.response?.data?.title ||
      error.response?.data?.error_description;

    if (apiDetail) return apiDetail;

    if (error.response?.status === 401) {
      return "Your Oura session is no longer valid. Please reconnect your account.";
    }

    if (error.response?.status === 403) {
      return "This app is missing the required Oura scopes. Reconnect and allow access to daily data.";
    }

    if (error.response?.status === 429) {
      return "Rate limit reached. Wait a moment, then refresh again.";
    }

    if (error.message) return error.message;
  }

  return "Something went wrong while talking to the Oura API.";
}

function buildRecommendations({ sleep, readiness, activity }) {
  const recs = [];

  const sleepScore = sleep?.score ?? null;
  const readinessScore = readiness?.score ?? null;
  const activityScore = activity?.score ?? null;

  const contributors = readiness?.contributors || {};
  const sleepDurationSeconds = sleep?.contributors?.total_sleep ?? null;
  const efficiency = sleep?.contributors?.efficiency ?? null;
  const recoveryIndex = contributors.recovery_index ?? null;
  const temperature = contributors.temperature ?? null;
  const previousDayActivity = readiness?.contributors?.previous_day_activity ?? null;

  if (sleepScore !== null && sleepScore < 70) {
    recs.push("Go to bed about 30 minutes earlier tonight and keep your wind-down screen-free for the last hour.");
  }

  if (sleepScore !== null && sleepScore < 60) {
    recs.push("Skip late caffeine today and aim for a lighter evening so your body has a better shot at recovery.");
  }

  if (readinessScore !== null && readinessScore < 70) {
    recs.push("Avoid high-intensity cardio today. Choose a walk, mobility session, or light strength work instead.");
  }

  if (readinessScore !== null && readinessScore < 60) {
    recs.push("Protect recovery today: reduce workload where possible, hydrate more intentionally, and prioritize an earlier bedtime.");
  }

  if (activityScore !== null && activityScore < 70 && readinessScore !== null && readinessScore >= 75) {
    recs.push("Your recovery looks solid, so this is a good day to add a purposeful workout or a longer walk to raise activity.");
  }

  if (activityScore !== null && activityScore > 85 && readinessScore !== null && readinessScore < 70) {
    recs.push("Your activity has been strong, but recovery is lagging. Keep movement gentle today and avoid stacking another hard session.");
  }

  if (sleepDurationSeconds !== null && sleepDurationSeconds < 7 * 3600) {
    recs.push("Try to add at least 45–60 more minutes of sleep opportunity tonight by starting your bedtime routine earlier.");
  }

  if (efficiency !== null && efficiency < 75) {
    recs.push("Improve sleep quality by keeping your room cooler, dimming lights earlier, and avoiding heavy meals close to bedtime.");
  }

  if (recoveryIndex !== null && recoveryIndex < 70) {
    recs.push("Treat today like a recovery-focused day: keep exercise moderate, eat consistently, and build in a short afternoon reset.");
  }

  if (temperature !== null && temperature < 70) {
    recs.push("Your body may be under extra strain. Take it easier, stay hydrated, and consider an earlier night if you feel run down.");
  }

  if (previousDayActivity !== null && previousDayActivity < 70 && activityScore !== null && activityScore < 75) {
    recs.push("Break up sedentary time with short movement snacks today—10 minutes after meals is a great place to start.");
  }

  if (
    sleepScore !== null &&
    readinessScore !== null &&
    activityScore !== null &&
    sleepScore >= 82 &&
    readinessScore >= 82 &&
    activityScore >= 75
  ) {
    recs.push("You’re in a strong zone today. This is a good day for deep work, a quality workout, and keeping your routine consistent.");
  }

  const uniqueRecs = [...new Set(recs)];

  if (uniqueRecs.length < 3) {
    uniqueRecs.push(
      "Anchor your day with a consistent meal schedule and hydration target so energy stays stable from morning through evening."
    );
  }

  if (uniqueRecs.length < 4) {
    uniqueRecs.push(
      "Get outside for 10–20 minutes of daylight early in the day to support energy, mood, and your sleep timing tonight."
    );
  }

  return uniqueRecs.slice(0, 5);
}

function MetricCard({ title, score, icon: Icon, subtitle }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">{score ?? "--"}</h3>
          <p className={`mt-1 text-sm font-medium ${score != null ? scoreColor(score) : "text-zinc-500"}`}>
            {score != null ? scoreLabel(score) : "No data"}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-900/80 p-3 ring-1 ring-white/10">
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
      </div>
      <p className="text-sm text-zinc-400">{subtitle}</p>
    </div>
  );
}

function RecommendationCard({ items }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 p-6 shadow-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-cyan-400/15 p-3">
          <Sparkles className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Today’s lifestyle coaching</h2>
          <p className="text-sm text-zinc-300">Generated from your latest Oura sleep, readiness, and activity data.</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <p className="text-sm leading-6 text-zinc-100">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [accessToken, setAccessToken] = useState(localStorage.getItem("oura_access_token") || "");
  const [ouraData, setOuraData] = useState({
    sleep: null,
    readiness: null,
    activity: null,
  });
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const returnedState = params.get("state");
    const savedState = localStorage.getItem("oura_oauth_state");
    const oauthError = params.get("error");

    if (oauthError) {
      setError("Oura authorization was not completed. Please try connecting again.");
      setAuthLoading(false);
      return;
    }

    if (token) {
      if (savedState && returnedState && savedState !== returnedState) {
        setError("OAuth state validation failed. Please reconnect your account.");
        setAuthLoading(false);
        return;
      }

      localStorage.setItem("oura_access_token", token);
      localStorage.removeItem("oura_oauth_state");
      setAccessToken(token);

      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }

    setAuthLoading(false);
  }, []);

  const recommendations = useMemo(() => buildRecommendations(ouraData), [ouraData]);

  const connectOura = () => {
    setError("");

    if (!CLIENT_ID || !REDIRECT_URI) {
      setError("Missing Oura environment variables. Add VITE_OURA_CLIENT_ID and VITE_OURA_REDIRECT_URI to your .env file.");
      return;
    }

    const state = createStateValue();
    localStorage.setItem("oura_oauth_state", state);

    const authUrl = new URL(OURA_AUTH_URL);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", OURA_SCOPES);
    authUrl.searchParams.set("state", state);

    window.location.href = authUrl.toString();
  };

  const disconnectOura = () => {
    localStorage.removeItem("oura_access_token");
    localStorage.removeItem("oura_oauth_state");
    setAccessToken("");
    setOuraData({ sleep: null, readiness: null, activity: null });
    setLastUpdated("");
    setError("");
  };

  const fetchOuraData = async () => {
    if (!accessToken) return;

    setLoading(true);
    setError("");

    try {
      const startDate = getDateDaysAgo(7);
      const endDate = getTodayDateString();

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      };

      const [sleepRes, readinessRes, activityRes] = await Promise.all([
        axios.get(`${OURA_API_BASE}/usercollection/daily_sleep`, {
          headers,
          params: { start_date: startDate, end_date: endDate },
        }),
        axios.get(`${OURA_API_BASE}/usercollection/daily_readiness`, {
          headers,
          params: { start_date: startDate, end_date: endDate },
        }),
        axios.get(`${OURA_API_BASE}/usercollection/daily_activity`, {
          headers,
          params: { start_date: startDate, end_date: endDate },
        }),
      ]);

      setOuraData({
        sleep: extractLatestRecord(sleepRes.data),
        readiness: extractLatestRecord(readinessRes.data),
        activity: extractLatestRecord(activityRes.data),
      });

      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && accessToken) {
      fetchOuraData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, accessToken]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.18),_transparent_30%),radial-gradient(circle_at_right,_rgba(16,185,129,0.12),_transparent_20%),linear-gradient(to_bottom,_#09090b,_#111827,_#09090b)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
            <div className="grid gap-8 p-6 md:grid-cols-[1.3fr_0.9fr] md:p-10">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                  <ShieldCheck className="h-4 w-4" />
                  Oura-powered wellness coaching
                </div>

                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Lifestyle Coach
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                  Connect your Oura account and turn your latest sleep, readiness, and activity scores into
                  practical decisions for training, recovery, and daily energy.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {!accessToken ? (
                    <button
                      onClick={connectOura}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-300"
                    >
                      <Link2 className="h-4 w-4" />
                      Connect Oura
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={fetchOuraData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        {loading ? "Refreshing..." : "Refresh data"}
                      </button>

                      <button
                        onClick={disconnectOura}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-white transition hover:bg-white/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-4 text-sm text-zinc-400">
                  {lastUpdated ? `Last updated: ${lastUpdated}` : "No synced data yet."}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="mb-2 flex items-center gap-2 text-zinc-300">
                    <Moon className="h-4 w-4 text-cyan-300" />
                    Sleep
                  </div>
                  <p className="text-sm leading-6 text-zinc-400">
                    Use nightly recovery signals to guide bedtime, caffeine timing, and intensity.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="mb-2 flex items-center gap-2 text-zinc-300">
                    <BatteryCharging className="h-4 w-4 text-emerald-300" />
                    Readiness
                  </div>
                  <p className="text-sm leading-6 text-zinc-400">
                    Decide whether to push, maintain, or back off based on recovery and strain.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="mb-2 flex items-center gap-2 text-zinc-300">
                    <Activity className="h-4 w-4 text-violet-300" />
                    Activity
                  </div>
                  <p className="text-sm leading-6 text-zinc-400">
                    Balance movement and recovery so your week stays productive without tipping into burnout.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Connection issue</p>
              <p className="mt-1 text-sm text-rose-100/90">{error}</p>
            </div>
          </div>
        )}

        <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                title="Sleep Score"
                score={ouraData.sleep?.score ?? null}
                icon={Moon}
                subtitle={ouraData.sleep?.day ? `Latest entry: ${ouraData.sleep.day}` : "Waiting for data"}
              />
              <MetricCard
                title="Readiness Score"
                score={ouraData.readiness?.score ?? null}
                icon={BatteryCharging}
                subtitle={ouraData.readiness?.day ? `Latest entry: ${ouraData.readiness.day}` : "Waiting for data"}
              />
              <MetricCard
                title="Activity Score"
                score={ouraData.activity?.score ?? null}
                icon={Activity}
                subtitle={ouraData.activity?.day ? `Latest entry: ${ouraData.activity.day}` : "Waiting for data"}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-white/5 p-3">
                  <HeartPulse className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Data snapshot</h2>
                  <p className="text-sm text-zinc-400">The latest daily summaries pulled from Oura.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-zinc-300">Sleep</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-400">
                    {JSON.stringify(ouraData.sleep, null, 2)}
                  </pre>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-zinc-300">Readiness</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-400">
                    {JSON.stringify(ouraData.readiness, null, 2)}
                  </pre>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-zinc-300">Activity</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-400">
                    {JSON.stringify(ouraData.activity, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          <aside>
            <RecommendationCard items={recommendations} />
          </aside>
        </main>
      </div>
    </div>
  );
}