import { useEffect, useState } from "react";
import axios from "axios";
import {
  Moon,
  Activity,
  BatteryCharging,
  Sparkles,
  Link2,
  RefreshCw,
  AlertTriangle,
  LogOut,
} from "lucide-react";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const BACKEND_URL = "https://optimalife-pearl.vercel.app/api/oura";
const COACH_URL = "https://optimalife-pearl.vercel.app/api/coach";

const CLIENT_ID = import.meta.env.VITE_OURA_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_OURA_REDIRECT_URI;
const OURA_SCOPES = "daily personal";

function createStateValue() {
  return Math.random().toString(36).slice(2);
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

function fallbackAdviceFromData({ sleep, readiness, activity }) {
  const advice = [];

  if ((sleep?.score ?? 0) < 75) {
    advice.push("Shift tonight’s bedtime earlier and keep the last hour low-stimulation.");
  }

  if ((readiness?.score ?? 0) < 75) {
    advice.push("Keep today recovery-forward with lighter movement and fewer high-stress commitments.");
  }

  if ((activity?.score ?? 0) < 75 && (readiness?.score ?? 0) >= 75) {
    advice.push("Your recovery looks decent, so a moderate walk or workout would be a good fit today.");
  }

  if ((sleep?.contributors?.efficiency ?? 100) < 85) {
    advice.push("Support better sleep quality tonight by dimming lights earlier and avoiding a heavy late meal.");
  }

  if (advice.length < 4) {
    advice.push("Get outside for 10–20 minutes of daylight early in the day.");
  }

  if (advice.length < 4) {
    advice.push("Stay hydrated and keep meals steady so your energy stays even.");
  }

  return advice.slice(0, 4);
}

function MetricCard({ title, score, icon: Icon, subtitle }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-white/10 p-6 shadow-xl hover:scale-[1.02] transition backdrop-blur-xl">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-zinc-400">{title}</div>
        <div className="bg-white/10 p-2 rounded-lg">
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
      </div>

      <div className="text-5xl font-semibold text-white mt-2">
        {score ?? "--"}
      </div>

      <div className={`text-sm mt-1 ${score != null ? scoreColor(score) : "text-zinc-500"}`}>
        {score != null ? scoreLabel(score) : "No data"}
      </div>

      <div className="text-xs text-zinc-500 mt-2">{subtitle}</div>
    </div>
  );
}

function RecommendationCard({ items, aiStatus, aiError }) {
  return (
    <div className="sticky top-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-emerald-400/10 to-teal-400/10 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-cyan-500/20 p-3 rounded-xl">
          <Sparkles className="h-5 w-5 text-cyan-300" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">
            AI Lifestyle Coach
          </h2>
          <p className="text-sm text-zinc-400">
            {aiStatus === "live"
              ? "Gemini-generated recommendations"
              : aiStatus === "fallback"
              ? "Fallback recommendations"
              : aiStatus === "loading"
              ? "Generating advice..."
              : "Personalized recommendations"}
          </p>
        </div>
      </div>

      {aiError ? (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
          Gemini request failed, so the app is showing backup recommendations.
          <div className="mt-1 text-amber-200/80">{aiError}</div>
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-4 text-sm text-zinc-100"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("oura_access_token") || ""
  );

  const [ouraData, setOuraData] = useState({
    sleep: null,
    readiness: null,
    activity: null,
  });

  const [history, setHistory] = useState([]);
  const [aiAdvice, setAiAdvice] = useState([]);
  const [aiStatus, setAiStatus] = useState("idle");
  const [aiError, setAiError] = useState("");

  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");

    if (token) {
      localStorage.setItem("oura_access_token", token);
      setAccessToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    setAuthLoading(false);
  }, []);

  const connectOura = () => {
    const state = createStateValue();

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
    setAccessToken("");
    setOuraData({
      sleep: null,
      readiness: null,
      activity: null,
    });
    setAiAdvice([]);
    setAiStatus("idle");
    setAiError("");
    setHistory([]);
  };

  const fetchOuraData = async () => {
    if (!accessToken) return;

    setLoading(true);
    setError("");
    setAiError("");

    try {
      const response = await axios.get(BACKEND_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const sleep = response.data.sleep?.data?.[0] ?? null;
      const readiness = response.data.readiness?.data?.[0] ?? null;
      const activity = response.data.activity?.data?.[0] ?? null;

      const formatted = {
        sleep,
        readiness,
        activity,
      };

      setOuraData(formatted);

      const sleepSeries = response.data.sleep?.data ?? [];
      const readinessSeries = response.data.readiness?.data ?? [];
      const activitySeries = response.data.activity?.data ?? [];

      const chartData = sleepSeries
        .slice(0, 7)
        .map((d, i) => ({
          day: d.day?.slice(5) ?? `Day ${i + 1}`,
          sleep: d.score ?? null,
          readiness: readinessSeries[i]?.score ?? null,
          activity: activitySeries[i]?.score ?? null,
        }))
        .reverse();

      setHistory(chartData);

      setAiStatus("loading");

      try {
        const ai = await axios.post(COACH_URL, formatted, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        console.log("Gemini coach response:", ai.data);

        const parsedAdvice = Array.isArray(ai.data?.adviceItems)
          ? ai.data.adviceItems.filter(Boolean)
          : typeof ai.data?.advice === "string"
          ? ai.data.advice
              .split("\n")
              .map((a) => a.replace(/^[-•\d.)\s]+/, "").trim())
              .filter(Boolean)
          : [];

        if (parsedAdvice.length > 0) {
          setAiAdvice(parsedAdvice);
          setAiStatus("live");
          setAiError("");
        } else {
          const fallback = fallbackAdviceFromData(formatted);
          setAiAdvice(fallback);
          setAiStatus("fallback");
          setAiError("Gemini returned an empty response.");
        }
      } catch (coachErr) {
        console.error(
          "Gemini coach error:",
          coachErr?.response?.data || coachErr?.message || coachErr
        );

        const fallback = fallbackAdviceFromData(formatted);
        setAiAdvice(fallback);
        setAiStatus("fallback");

        const backendMessage =
          coachErr?.response?.data?.error ||
          coachErr?.response?.data?.message ||
          coachErr?.message ||
          "Unknown AI request error.";

        setAiError(backendMessage);
      }

      setLastUpdated(new Date().toLocaleString());
    } catch (ouraErr) {
      console.error("Oura fetch error:", ouraErr?.response?.data || ouraErr?.message || ouraErr);
      setError("Failed to fetch Oura data.");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && accessToken) {
      fetchOuraData();
    }
  }, [authLoading, accessToken]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#031926] via-[#062c3f] to-[#02121a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.12),transparent_40%)] pointer-events-none"></div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="mb-14">
          <h1 className="text-5xl font-semibold tracking-tight mb-3">
            Lifestyle Coach
          </h1>

          <p className="text-zinc-400 max-w-xl leading-relaxed">
            Transform your sleep, readiness, and activity signals into calm,
            intentional decisions for recovery, focus, and energy.
          </p>

          <div className="mt-6 flex gap-3">
            {!accessToken ? (
              <button
                onClick={connectOura}
                className="flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-slate-900 px-5 py-3 rounded-full font-medium shadow-lg transition"
              >
                <Link2 className="h-4 w-4" />
                Connect Oura
              </button>
            ) : (
              <>
                <button
                  onClick={fetchOuraData}
                  className="flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-slate-900 px-5 py-3 rounded-full shadow-lg"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>

                <button
                  onClick={disconnectOura}
                  className="flex items-center gap-2 border border-white/20 px-5 py-3 rounded-full"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
              </>
            )}
          </div>

          <p className="text-sm text-zinc-500 mt-3">
            {lastUpdated ? `Last updated: ${lastUpdated}` : ""}
          </p>
        </header>

        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-400 p-4 rounded-xl">
            <AlertTriangle className="inline mr-2 h-4 w-4" />
            {error}
          </div>
        )}

        <main className="grid gap-10 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-12">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.05)]">
              <h2 className="text-xl font-semibold text-white mb-6">
                Health Dashboard
              </h2>

              <div className="grid sm:grid-cols-3 gap-6">
                <MetricCard
                  title="Sleep Score"
                  score={ouraData.sleep?.score}
                  icon={Moon}
                  subtitle={ouraData.sleep?.day}
                />

                <MetricCard
                  title="Readiness Score"
                  score={ouraData.readiness?.score}
                  icon={BatteryCharging}
                  subtitle={ouraData.readiness?.day}
                />

                <MetricCard
                  title="Activity Score"
                  score={ouraData.activity?.score}
                  icon={Activity}
                  subtitle={ouraData.activity?.day}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-xl font-semibold mb-6">
                7-Day Trends
              </h2>

              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history}>
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis domain={[50, 100]} stroke="#94a3b8" />
                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="sleep"
                    stroke="#22d3ee"
                    strokeWidth={4}
                    dot={{ r: 4 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="readiness"
                    stroke="#34d399"
                    strokeWidth={4}
                    dot={{ r: 4 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="activity"
                    stroke="#60a5fa"
                    strokeWidth={4}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <aside>
            <RecommendationCard
              items={aiAdvice}
              aiStatus={aiStatus}
              aiError={aiError}
            />
          </aside>
        </main>
      </div>
    </div>
  );
}