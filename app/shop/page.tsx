import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import { listShopItems } from "@/lib/db";
import { addShopItem, toggleShopItem, deleteShopItem } from "@/app/actions";
import { PendingButton } from "@/app/_components/PendingButton";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const items = await listShopItems();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink tracking-tight">Shop</h1>
        <p className="text-sm text-ink/55 mt-1 max-w-2xl">
          Items shown in the in-game Pixl shop. Purchases aren&apos;t enabled yet — players can
          only browse, so feel free to stock the shelves.
        </p>
      </div>

      <div className="pixl-card p-5 md:p-6">
        <div className="text-base font-semibold mb-4">Add an item</div>
        <form action={addShopItem} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block sm:col-span-2">
              <span className="block text-sm font-medium mb-1.5">Name</span>
              <input
                name="name"
                required
                maxLength={60}
                placeholder="e.g. Holo Sticker"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Price (pixels)</span>
              <input
                name="price"
                type="number"
                min={0}
                required
                placeholder="60"
                className="pixl-input w-full text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Description</span>
            <input
              name="description"
              maxLength={300}
              placeholder="Holographic, shimmery. Looks great on a laptop."
              className="pixl-input w-full text-sm"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Options (optional)</span>
              <input
                name="options"
                placeholder="red, blue, green"
                className="pixl-input w-full text-sm"
              />
              <span className="block text-xs text-ink/45 mt-1">
                Comma-separated variants, if the item has any.
              </span>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Image (optional)</span>
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="block w-full text-sm text-ink/70 file:pixl-btn file:bg-[var(--surface)] file:text-ink file:text-sm file:mr-3 file:border-[var(--line)]"
              />
              <span className="block text-xs text-ink/45 mt-1">PNG/JPG/WebP, max 4 MB.</span>
            </label>
          </div>
          <div className="flex justify-end">
            <PendingButton
              className="pixl-btn bg-brand text-white border-transparent"
              pendingText="Adding… (uploading the image can take a few seconds)"
            >
              Add item
            </PendingButton>
          </div>
        </form>
      </div>

      <div>
        <div className="text-sm font-medium text-ink/60 mb-3">
          {items.length} item{items.length === 1 ? "" : "s"} · only active ones show in game
        </div>
        {items.length === 0 ? (
          <div className="pixl-card p-8 text-center text-ink/55 text-sm">
            Empty shelves. Add the first item above.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className={`pixl-card p-4 flex gap-4 ${item.active ? "" : "opacity-60"}`}>
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover border border-[var(--line)] shrink-0 [image-rendering:pixelated]"
                  />
                ) : (
                  <span className="grid place-items-center w-20 h-20 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] shrink-0 text-2xl">
                    🛍️
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{item.name}</span>
                    <span className="badge bg-mint/30 dark:bg-mint/20 tabular-nums">
                      {item.price} px
                    </span>
                    {!item.active && <span className="badge bg-parch">hidden</span>}
                  </div>
                  {item.description && (
                    <div className="text-sm text-ink/60 mt-1">{item.description}</div>
                  )}
                  {item.options.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {item.options.map((o) => (
                        <span key={o} className="badge bg-black/[0.05] dark:bg-white/[0.08] text-ink/70">
                          {o}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <form action={toggleShopItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="active" value={item.active ? "0" : "1"} />
                      <button className="pixl-btn bg-[var(--surface)] text-ink text-sm">
                        {item.active ? "Hide" : "Show"}
                      </button>
                    </form>
                    <form action={deleteShopItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="pixl-btn bg-transparent text-rose-600 border-rose-200 dark:border-rose-500/30 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
