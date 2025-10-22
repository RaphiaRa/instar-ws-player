/** ws-player INSTAR websocket player 
 */

// error log helper
function log_err(msg) {
    console.error('instar-ws-player: ' + msg);
}

function log_info(msg) {
    console.info('instar-ws-player: ' + msg);
}

class BrowserInfo {
    constructor() {
        const ua = navigator.userAgent;
        this.is_edge = /Edg/.test(ua) || /Edge/.test(ua);
        this.is_safari = /^((?!chrome|android).)*safari/i.test(ua);
        this.is_chrome = /Chrome/.test(ua) && !/Edge|Edg|OPR/.test(ua);
        this.is_firefox = /Firefox/.test(ua);
    }
}

class Player {
    append_to_buffer(videoChunk) {
        // maybe check whether we're actually playin?
        if (!this.source_buffer) {
            return;
        }
        try {
            this.source_buffer.appendBuffer(videoChunk);
        } catch (e) {
            log_err(e);
        }
    }

    on_packet() {
        if (!this.source_buffer.updating) {
            if (this.queue.length > 0) {
                const data = this.queue.shift();
                this.append_to_buffer(data);
            } else { // the queue runs empty, so we must force-feed the next packet
                this.started = false;
            }
        }
    }

    on_source_error(_) {
        log_err("Media source error: This happened probably because of a decoding error. Has the correct video codec been selected?");
    }

    on_ws_message(ev) {
        const msg = ev.data;
        if (typeof msg === 'string') {
            // don't do anything for now
        } else {
            // msg reader
            const reader = new FileReader();
            reader.onload = function (ev) {
                const buffer = ev.target.result;
                if (!this.started) {
                    this.append_to_buffer(buffer);
                    this.started = true;
                    return;
                }
                this.queue.push(buffer);
            }.bind(this);
            reader.readAsArrayBuffer(msg);
        }
        // NOTE: the web server has a idle-timeout of 60 seconds,
        // so we need to send a keep-alive message regulary
        this.keep_alive_count++;
        if (this.keep_alive_count >= 10 && this.ws.readyState == WebSocket.OPEN) {
            this.keep_alive_count = 0;
            this.ws.send("keep-alive");
        }
    }

    on_ws_error(ev) {
        log_err("Websocket error: " + ev);
    }

    on_ws_open(ev) {
        log_info('open ws connection: ' + ev);
        this.onready();
    }

    constructor(ms, ws, mime, substream, onready) {
        // ms
        ms.addEventListener('sourceopen',
            function () {
                if (this.source_buffer) {
                    return;
                }
                this.source_buffer = ms.addSourceBuffer(mime);
                this.source_buffer.addEventListener("updateend", this.on_packet.bind(this));
                this.source_buffer.addEventListener("error", this.on_source_error.bind(this));
            }.bind(this)
        );
        ms.addEventListener('sourceclose',
            function () {
                this.source_buffer = undefined;
            }.bind(this)
        );
        this.ms = ms;

        // ws
        ws.timeoutInterval = 3000;
        ws.onmessage = this.on_ws_message.bind(this);
        ws.onopen = this.on_ws_open.bind(this);
        ws.onclose = function (_) {
        }
        ws.onerror = function (ev) {
            log_err('ws connection error' + ev);
        }
        this.ws = ws;
        this.substream = substream;
        this.onready = onready;

        this.browser = new BrowserInfo();
        this.keep_alive_count = 0;
        this.queue = [];
    }

    start() {
        if (this.ws.readyState != WebSocket.OPEN) {
            log_err("webSocket is not open: " + this.ws.readyState);
            return;
        }
        this.ws.send(('livestream/' + this.substream));
    }

    stop() {
        if (this.ws.readyState != WebSocket.OPEN) {
            log_err("webSocket is not open: " + this.ws.readyState);
            return;
        }
        this.ws.send('stop/livestream');
    }
};

function create_media_source(video) {
    if (!window.MediaSource) {
        log_err("No Media Source API available");
        return null;
    }
    const noaudio = video.getAttribute('noaudio');
    const venc = video.getAttribute('venc');
    const codecToVideoMIME = {
        'h264hp': 'avc1.64001E',
        'h264mp': 'avc1.4d002a',
        'h264bp': 'avc1.4D001E',
        'h265a': 'hev1.2.4.L120.B0',
    };
    let mime = 'video/mp4; codecs="'
    mime += codecToVideoMIME[venc] ?? 'avc1.4D001E';
    if (!noaudio) {
        mime += ', mp4a.40.2';
    }
    mime += '"';
    if (!MediaSource.isTypeSupported(mime)) {
        log_err("MIME type not supported: " + mime);
    }
    const ms = new MediaSource();
    if (video.src) {
        URL.revokeObjectURL(video.src);
    }
    video.src = window.URL.createObjectURL(ms);
    return [ms, mime];
}

function build_ws_url(host, user, pass, insecure) {
    const protocol = insecure ? 'ws' : 'wss';
    return protocol + '://' + user + ':' + pass + '@' + host + '/ws';
}

function create_player_from_element(e, onready) {
    const result = create_media_source(e);
    if (!result) {
        return null;
    }
    const [ms, mime] = result;
    const host = e.getAttribute('host');
    const user = e.getAttribute('user');
    const pass = e.getAttribute('pass');
    const insecure = e.getAttribute('insecure') !== null;
    const ws_url = build_ws_url(host, user, pass, insecure);
    const WS = typeof ReconnectingWebSocket !== "undefined" ? ReconnectingWebSocket : WebSocket;
    const ws = new WS(ws_url);
    const substream = e.getAttribute('substream') ?? '12';
    return new Player(ms, ws, mime, substream, onready);
}

document.addEventListener("DOMContentLoaded", () => {
    const elements = document.querySelectorAll(".instar-ws");
    for (const e of elements) {
        const player = create_player_from_element(e, function () {
            player.start();
        });
        e.ctrl = player;
    }
});
