import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rjfm.app',
  appName: 'RJ FM',
  webDir: 'public',
  server: {
    url: 'https://rjfm.com',
    cleartext: false,
    allowNavigation: ['rjfm.com', 'www.rjfm.com'],
  },
}

export default config
