import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rjfm.app',
  appName: 'RJ FM',
  webDir: 'public',
  server: {
    url: 'https://more-fm-automation-system-bgah.onrender.com/',
    cleartext: false,
    allowNavigation: ['more-fm-automation-system-bgah.onrender.com'],
  },
}

export default config
