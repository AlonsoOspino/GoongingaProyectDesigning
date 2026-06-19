const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DEFAULT_IDLE_DISCONNECT_MS = 60_000;

const idleDisconnectEnabled = process.env.PRISMA_IDLE_DISCONNECT !== "false";
let activeRequests = 0;
let idleDisconnectTimer = null;

function getIdleDisconnectMs() {
  const configured = Number(process.env.PRISMA_IDLE_DISCONNECT_MS);
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_IDLE_DISCONNECT_MS;
}

function clearIdleDisconnectTimer() {
  if (!idleDisconnectTimer) return;
  clearTimeout(idleDisconnectTimer);
  idleDisconnectTimer = null;
}

function scheduleIdleDisconnect(delayMs = getIdleDisconnectMs()) {
  if (!idleDisconnectEnabled) return;
  clearIdleDisconnectTimer();

  idleDisconnectTimer = setTimeout(async () => {
    idleDisconnectTimer = null;
    if (activeRequests > 0) return;

    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error("[prisma] Failed to disconnect idle client:", error?.message || error);
    }
  }, delayMs);

  if (typeof idleDisconnectTimer.unref === "function") {
    idleDisconnectTimer.unref();
  }
}

prisma.$requestStarted = () => {
  if (!idleDisconnectEnabled) return;
  activeRequests += 1;
  clearIdleDisconnectTimer();
};

prisma.$requestFinished = () => {
  if (!idleDisconnectEnabled) return;
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) {
    scheduleIdleDisconnect();
  }
};

prisma.$disconnectWhenIdle = (delayMs = 0) => {
  if (!idleDisconnectEnabled || activeRequests > 0) return;
  scheduleIdleDisconnect(delayMs);
};

module.exports = prisma;
