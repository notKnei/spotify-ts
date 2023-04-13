"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = __importDefault(require("express"));
const Express = (0, express_1.default)();
const { client_id, client_secret, redirect_uri } = process.env;
let state;
let a_token;
let r_token;
Express.get('/poop', (req, res) => {
    state = node_crypto_1.default.randomUUID();
    res.redirect('https://accounts.spotify.com/authorize?' +
        new URLSearchParams({
            response_type: 'code',
            scope: 'user-read-playback-state user-read-currently-playing',
            client_id,
            redirect_uri,
            state,
        }).toString());
});
Express.get('/callback', async (req, res) => {
    if (req.query['state'] !== state) {
        console.error('State Mismatch.');
        return res.redirect('/#' +
            new URLSearchParams({
                error: 'state_mismatch',
            }).toString());
    }
    const error = req.query['error'] ?? null;
    if (error) {
        console.error('Error: ' + error);
        return res.status(403).send({ success: false, cause: 'Error', error });
    }
    const code = req.query['code'] ?? null;
    if (!code) {
        console.error('Missing code');
        return res.status(403).send({ success: false, cause: 'Missing Code' });
    }
    setInterval(() => getToken({}, r_token), (getToken(res, code) - 30) * 1e3);
    if (!res.headersSent)
        res
            .status(200)
            .send({ success: true, message: 'You can close this page, or head to /curentPlayingTrack' });
    return;
});
Express.get('/currentPlayingTrack', async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const songs = await (async function () {
        const headers = new Headers();
        headers.set('Authorization', `Bearer ${a_token}`);
        const song = [null, null];
        song[0] = await fetch('https://api.spotify.com/v1/me/player/currently-playing?', {
            headers,
        }).then((data) => (data.body === null ? null : data.json()));
        if (song[0])
            return song;
        song[1] = await fetch('https://api.spotify.com/v1/me/player/recently-played?', {
            headers,
        }).then((data) => data.json());
        return song;
    })();
    if (songs[0] !== null && !isError(songs[0])) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const current = songs[0].item;
        return res.status(200).send({
            success: true,
            data: {
                album: cleanAlbumData(current.album),
                artists: current.artists,
                id: current.id,
                image: current.album.images,
                name: current.name,
            },
        });
    }
    if (songs[1] !== null && !isError(songs[1])) {
        const previous = songs[1].items[0].track;
        return res.status(200).send({
            success: true,
            data: {
                album: cleanAlbumData(previous.album),
                artists: previous.artists,
                id: previous.id,
                image: previous.album.images,
                name: previous.name,
            },
        });
    }
    return res.status(400).send({
        success: false,
        message: 'poop',
        data: null,
    });
});
Express.listen(8080, () => console.log('Online'));
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ // @ts-expect-error Generics suck
function getToken(response, code) {
    const headers = new Headers();
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    headers.set('Authorization', `Basic ${Buffer.from(client_id + ':' + client_secret).toString('base64')}`);
    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('redirect_uri', redirect_uri);
    let validFor = 3600;
    fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers,
        body,
    })
        .then((data) => data.json())
        .then((data) => {
        a_token = data['access_token'];
        r_token = data['refresh_token'];
        validFor = data['expires_in'];
        console.log('Updated tokens!');
    })
        .catch((err) => {
        console.error(err);
        if (response.keys().length !== 0)
            response.redirect('/#' +
                new URLSearchParams({
                    error: 'fetch_error',
                }).toString());
    });
    return validFor;
}
function isError(a) {
    // @ts-expect-error Unknown
    return !!a.error;
}
function cleanAlbumData(album) {
    delete album.available_markets;
    return album;
}
//# sourceMappingURL=index.js.map