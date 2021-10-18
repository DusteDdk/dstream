const compression = require('compression');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(compression({level:7}));
app.use(bodyParser.json());
const port = 3000;
const spawn = require('child_process').spawn;

const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('/db/metadata.sqlite');

db.serialize( ()=>{
    db.run('CREATE TABLE IF NOT EXISTS track (id INTEGER PRIMARY KEY AUTOINCREMENT, file TEXT UNIQUE, artist INTEGER, album INTEGER, title TEXT, genre TEXT, lossless INTEGER, codec TEXT, bitrate INTEGER, duration REAL, track INTEGER, disk INTEGER, year INTEGER)');
    db.run('CREATE INDEX IF NOT EXISTS trackIdx ON track (file, title, year)');
    db.run('CREATE TABLE IF NOT EXISTS artist (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)');
    db.run('CREATE INDEX IF NOT EXISTS artIdx ON artist (name)');
    db.run('INSERT OR IGNORE INTO artist (name) VALUES ("-")');
    db.run('CREATE TABLE IF NOT EXISTS album (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, uniqname UNIQUE)');
    db.run('CREATE INDEX IF NOT EXISTS  alIdx ON album (name)');
    db.run('INSERT OR IGNORE INTO album (name) VALUES("-")');
});

app.use('/music/', express.static('/music'));
app.use('/', express.static('/src/html/'));


app.use('/random.json', (req, res)=>{
    const data = [];

    db.each('SELECT year, duration,codec, file, title, artist.name AS artistName, album.name AS albumName FROM track INNER JOIN artist ON artist.id=track.artist INNER JOIN album ON album.id=track.album ORDER BY RANDOM() LIMIT 25', [], (err,row)=>{
        if(err) {
            console.log(err);
        }
        data.push(row);
    }, ()=>{
            return res.send(data);
    });
});

app.use('/tracks.json', (req, res)=>{
    const data = [];
    const query = req.query.q.split(' ');
    const likes = query.map( ()=>{ return ' file LIKE ?'; }).join(' AND ');
    const qargs = query.map( e=>'%'+e+'%');

    db.each('SELECT track.id as id, year, duration,codec, file, title, artist.name AS artistName, album.name AS albumName FROM track INNER JOIN artist ON artist.id=track.artist INNER JOIN album ON album.id=track.album WHERE'+likes+' LIMIT 300', qargs, (err,row)=>{
        if(err) {
            console.log(err);
        }
        data.push(row);
    }, ()=>{
            return res.send(data);
    });
});

app.use('/browse.json', (req, res)=>{
    const data = [];
    
    const offset=parseInt(req.query.p);

    db.each('SELECT year, duration,codec, file, title, artist.name AS artistName, album.name AS albumName FROM track INNER JOIN artist ON artist.id=track.artist INNER JOIN album ON album.id=track.album LIMIT ?, 30', [offset], (err,row)=>{
        if(err) {
            console.log(err);
        }
        data.push(row);
    }, ()=>{
            return res.send(data);
    });
});

app.listen(port, () => {
  console.log(`Server listening at on port ${port}`)
});

let scanner = null;
let lastScanIo = 'No scans started..';

app.use('/scan', (req, res)=>{
    const query = req.query;

    if(query.start) {
        if(scanner) {
            return res.send('Already scanning!');
        }

        scanner = spawn('node', ['./scanner.js']);
        lastScanIo= new Date()+' Started scanning...\n';
        scanner.stdout.on('data', (data)=>{
            lastScanIo += data.toString();
        });
        scanner.stderr.on('data', (data)=>{
            lastScanIo += data.toString();
        });
        scanner.on('close', (code)=>{
            lastScanIo += '\nScan ended: '+new Date()+' with code: '+code;
            scanner=null;
        });
    }

    db.each('SELECT COUNT(*) as numTracks FROM track', [], (err, row)=>{
	if(!err && row) {
	        res.send( ( row.numTracks+' tracks in db.\n'+( (!scanner)?'<a href="/scan?start=true">Scan library</a>':'<a href="/scan">Refresh</a>' )+'\n<a href="/">Back to player</a>\n'+lastScanIo).replace( /\n/g, '<br>'));
	} else {
		res.send('Some error:'+ err.message);
	}
    });

});

