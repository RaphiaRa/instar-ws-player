#### INSTAR Websocket Stream Player



Example:
```html
<body>
    <h1>INSTAR WebSocket Player (fMP4 via MSE)</h1>
    <video class="instar-ws" host="192.168.0.7:443" user="viewer" pass="viewer" venc="h264" substream="12"
        controls autoplay muted></video>
    <script type="module" src="./ws-player.js"></script>
</body>
```

#### Attributes



- **`noaudio`**  
  Disables audio completely.
- **`insecure`**  
  Disables SSL/TLS. When using this attribute, make sure to change the `host` port to the corresponding HTTP port.
- **`venc`**  
  Specifies the video encoding. Possible values: `h264`, `h265`.
- **`substream`**  
  Specifies the substream or channel to be used.
