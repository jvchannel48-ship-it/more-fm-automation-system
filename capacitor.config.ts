import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rjfm.app',
  appName: 'RJ FM',
  webDir: 'out',
  server: {
    url: 'https://rjfm.com',
    cleartext: false,
    allowNavigation: ['rjfm.com', 'www.rjfm.com'],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
}

export default config
