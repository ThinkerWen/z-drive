import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TrendPoint {
  date: string;
  views: number;
  downloads: number;
}

function toDateOnly(dateText: string): string {
  return dateText.slice(0, 10);
}

function buildLast14DaysSeries(data: TrendPoint[]) {
  const byDate = new Map<string, TrendPoint>();
  data.forEach((item) => {
    byDate.set(toDateOnly(item.date), {
      date: toDateOnly(item.date),
      views: item.views ?? 0,
      downloads: item.downloads ?? 0,
    });
  });

  const result: Array<TrendPoint & { shortDate: string }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 13; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    const found = byDate.get(key);

    result.push({
      date: key,
      shortDate: `${mm}/${dd}`,
      views: found?.views ?? 0,
      downloads: found?.downloads ?? 0,
    });
  }

  return result;
}

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const chartData = buildLast14DaysSeries(data);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 12, right: 10, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.18)" />
        <XAxis dataKey="shortDate" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(203,185,160,0.75)",
            background: "rgba(255,255,255,0.96)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="views"
          name="浏览"
          stroke="#ea580c"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="downloads"
          name="下载"
          stroke="#0891b2"
          strokeWidth={2.2}
          dot={{ r: 2.5 }}
          activeDot={{ r: 4.5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
