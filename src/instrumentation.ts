export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { syncSeedDatabase } = await import("./lib/sync");
    const result = await syncSeedDatabase();
    console.info("Motion Drive startup sync complete", result);
  } catch (error) {
    console.error("Motion Drive startup sync failed", error);
  }
}
