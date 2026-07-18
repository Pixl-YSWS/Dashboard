import { publicStats, publicGallery } from "@/lib/db";
import { GrowthChart } from "@/app/_components/GrowthChart";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pixl — live stats",
  description: "Ships, hours and pixels from the Pixl YSWS, live.",
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="pixl-card p-5 text-center">
      <div className="text-3xl font-semibold tabular-nums leading-tight">{value}</div>
      <div className="text-sm text-ink/55 mt-1">{label}</div>
    </div>
  );
}

export default async function StatsPage() {
  const [stats, gallery] = await Promise.all([publicStats(30), publicGallery(12)]);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <div className="text-center">
          <a href="https://pixl.rsvp" className="inline-block">
            <span className="text-4xl font-bold tracking-tight text-brand">PIXL</span>
          </a>
          <h1 className="text-xl font-semibold mt-2">Live stats</h1>
          <p className="text-sm text-ink/55 mt-1">
            Teenagers building games, getting paid in pixels.{" "}
            <a href="https://pixl.rsvp" className="text-brand hover:underline">
              Join in →
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Tile label="players" value={stats.players.toLocaleString("en-US")} />
          <Tile label="projects approved" value={stats.approvedProjects.toLocaleString("en-US")} />
          <Tile label="in review right now" value={stats.inReview.toLocaleString("en-US")} />
          <Tile label="hours of making" value={stats.totalHours.toLocaleString("en-US")} />
          <Tile
            label="pixels in circulation"
            value={stats.pixelsCirculating.toLocaleString("en-US")}
          />
          <Tile label="reviews done" value={stats.reviews.toLocaleString("en-US")} />
        </div>

        <div className="pixl-card p-5">
          <GrowthChart
            title="Ships per day (last 30 days)"
            series="projects"
            kind="daily"
            points={stats.shipsSeries}
          />
        </div>

        {gallery.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Fresh off the press</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gallery.map((p) => (
                <a
                  key={p.id}
                  href={p.demo_url || "https://pixl.rsvp"}
                  target="_blank"
                  rel="noreferrer"
                  className="pixl-card overflow-hidden hover:-translate-y-0.5 transition-transform"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="w-full h-36 object-cover border-b border-[var(--line)]"
                    />
                  ) : (
                    <div className="w-full h-36 grid place-items-center bg-[var(--surface-2)] border-b border-[var(--line)] text-3xl">
                      🎮
                    </div>
                  )}
                  <div className="p-3">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-ink/55 truncate">
                      by {p.owner}
                      {p.approved_hours != null ? ` · ${p.approved_hours}h` : ""}
                    </div>
                    {p.description && (
                      <div className="text-xs text-ink/60 mt-1 line-clamp-2">{p.description}</div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-ink/45 pb-6">
          Updated live ·{" "}
          <a href="https://pixl.rsvp" className="hover:text-brand">
            pixl.rsvp
          </a>
        </div>
      </div>
    </div>
  );
}
