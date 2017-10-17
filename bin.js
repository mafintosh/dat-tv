#!/usr/bin/env node

var hyperdrive = require('hyperdrive')
var hyperdiscovery = require('hyperdiscovery')
var storage = require('dat-storage')
var minimist = require('minimist')
var walker = require('folder-walker')
var each = require('stream-each')
var path = require('path')
var proc = require('child_process')
var http = require('http')
var serve = require('hyperdrive-http')

var argv = minimist(process.argv.slice(2))

var key = argv._[0]
var dir = argv._[1]

if (!dir) {
  dir = key
  key = null
}

if (key) {
  key = key.replace('dat://', '').replace(/\//g, '')
}

var archive = hyperdrive(storage(dir), key, {latest: true, sparse: true})
var playlist = []

archive.on('ready', function () {
  console.log('Dat key: dat://' + archive.key.toString('hex'))
  hyperdiscovery(archive)
  if (archive.writable) index()
  else play()
})

function play () {
  console.log('Playing dat')

  var playing = false

  check()
  archive.metadata.on('append', check)

  function check () {
    archive.readFile('/playlist.json', 'utf-8', function (err, str) {
      if (err || !str || playing) return
      playing = true

      var list = JSON.parse(str)

      var total = list.map(function (item) {
        return item.duration
      }).reduce(function (a, b) {
        return a + b
      })

      var offset = Math.floor(Date.now() / 1000) % Math.round(total)

      while (offset > list[0].duration) {
        var first = list.shift()
        offset -= first.duration
        list.push(first)
      }

      var urls = ''
      var server = http.createServer()
      var onrequest = serve(archive)

      server.on('request', function (req, res) {
        if (req.url === '/') return res.end(urls)
        onrequest(req, res)
      })

      server.listen(0, function () {
        list.forEach(function (item) {
          urls += 'http://localhost:' + server.address().port + item.name + '\n'
        })
        proc.spawn('mplayer', [
          '-playlist', 'http://localhost:' + server.address().port,
          '-ss', '' + offset
        ], {
          stdio: 'inherit'
        }).on('exit', function () {
          process.exit()
        })
      })
    })
  }
}

function index () {
  console.log('Sharing dat')

  each(walker('/', {fs: archive}),
    function (data, next) {
      var filename = path.join(dir, data.filepath)

      proc.exec('ffprobe -i ' + filename + ' -show_entries format=duration -v quiet -of csv="p=0"', function (err, out) {
        if (err) return next()
        out = out.trim()
        if (!out || !Number(out)) return next()

        playlist.push({
          name: data.filepath,
          duration: Number(out)
        })

        next()
      })
    }, function (err) {
      if (err) throw err
      playlist.sort(function (a, b) {
        return a.name.localeCompare(b.name)
      })

      archive.readFile('/playlist.json', 'utf-8', function (_, str) {
        var serialized = JSON.stringify(playlist, null, 2) + '\n'
        if (serialized === str) return console.log('Playlist unchanged...')
        archive.writeFile('/playlist.json', serialized, function (err) {
          if (err) throw err
          console.log('Wrote playlist...')
        })
      })
    }
  )
}
