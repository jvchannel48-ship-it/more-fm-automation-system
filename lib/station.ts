import 'server-only'
// TEMPORARY STUB - will be replaced
export async function getNowPlaying() { return { serverTime: Date.now(), offAir: true, boardOperatorEnabled: false, nextOnAir: null, signOffAt: null, tracks: [], nightVolumeActive: false, audioConfig: { masterVolume: 100, nightVolumePercent: 72, bassGainDb: 0, crossfaderEnabled: true, crossfaderCurve: 'constant-power', crossfadeSeconds: 3, replayGainEnabled: false, replayGainTargetLufs: -14 } } }
export async function recoverFailedTrack(_uid: string) { return getNowPlaying() }
export async function getAdminStatus() { return {} as any }
export async function queueDjMic(_asset: any) {}
export async function refreshQueue() {}
export async function runMorSyncTick() { return {} as any }
