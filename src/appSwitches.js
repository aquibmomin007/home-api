// Master switch for backend feature routes. Health stays on even when all apps are off.
export const API_APP_SWITCHES = Object.freeze({
  all: true,
  checklist: true,
  grocery: true,
  climate: true,
  bus: true,
  flights: false,
});

export function isApiAppEnabled(appName) {
  if (!(appName in API_APP_SWITCHES)) {
    throw new Error(`Unknown API app switch: ${appName}`);
  }

  return API_APP_SWITCHES.all && API_APP_SWITCHES[appName];
}
