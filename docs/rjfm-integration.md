# 100.3 RJFM integration

The home page connects to the public audio stream listed by OnlineRadio.ph for 100.3 RJFM, Makati:

- Stream: `https://stream.zeno.fm/as29d8g0g4duv`
- Station page: <https://onlineradio.ph/40-rjfm-100-3.html>
- Playlist page: <https://onlineradio.ph/playlist/40-rjfm-100-3.html>
- Station identity: RJFM 100.3, Rajah Broadcasting Network, Makati, Metro Manila.

`/api/rjfm` fetches the public station page and exposes a small snapshot containing the recent “Last played” rows and “Top songs” rows. The UI refreshes metadata every 30 seconds and labels it as potentially lagging the audio because the listing is a third-party public metadata source.

The app does not claim to be the official RJFM website and does not intentionally hide a playback delay. Production rebroadcasting should be used only with permission from the station/stream provider and in accordance with applicable music and broadcast rights.
