export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // slow/IPv6-less networks: Node's 250ms happy-eyeballs timeout causes "fetch failed" to Meta/Google
    const dns = await import("node:dns");
    const net = await import("node:net");
    dns.setDefaultResultOrder("ipv4first");
    net.setDefaultAutoSelectFamily(false);
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
