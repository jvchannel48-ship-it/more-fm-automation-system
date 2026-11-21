import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rjfm.app',
  appName: 'RJ FM',
  webDir: 'public',
  server: {
    url: 'https://rj-fm-radio-production.up.railway.app',
    cleartext: false,
    allowNavigation: ['rj-fm-radio-production.up.railway.app'],
  },
}

export default config
