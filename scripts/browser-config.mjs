export const browserConfig = {
  playwrightModule: process.env.MERO_PLAYWRIGHT_MODULE || process.env.RELAY_PLAYWRIGHT_MODULE,
  chromeExecutable: process.env.MERO_CHROME || process.env.RELAY_CHROME,
  engine: process.env.MERO_BROWSER || process.env.RELAY_BROWSER,
};
