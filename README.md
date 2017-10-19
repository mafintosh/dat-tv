# dat-tv

Turn a Dat into a TV stream.

```
npm install -g dat-tv
```

Currently requires mplayer to play and ffmpeg to share, PR welcome for more support

## Usage

First add some media files (audio/video) to a dat

``` sh
# exit it when done
dat my-media
```

Then use `dat-tv` to share it

``` sh
# requires ffmpeg to share
dat-tv my-media
```

Running the above will print the dat key.
On another computer that has mplayer then run

```
dat-tv <key-from-above> /tmp/my-channel
```

Running this should start streaming the video. Note that all viewers will
be watching the same thing, just as normal flow tv.

## License

MIT
