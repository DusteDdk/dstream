'use strict';

const fs = require('fs');
const mm = require('music-metadata');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/db/metadata.sqlite');

function getArtistId(artist) {
    if(!artist) {
        return 1;
    }

    artist=artist.trim();
    return new Promise(resolve=>{
        db.get('SELECT id FROM artist WHERE name = ? COLLATE NOCASE', [artist], (err, row)=>{
            if(err) {
                console.error(err);
            } else {
                if(row) {
                    resolve(row.id);
                } else {
                    db.run('INSERT INTO artist (name) VALUES(?)', [artist], (err)=>{
                        console.log('Added artist:',artist);
                        resolve(getArtistId(artist));
                    });
                }
            }
        });
    });
}

function getAlbumId(artist, album, year) {
    if(!album || album === '') {
        return 1;
    }
    album=album.trim();
    const uniqname = `${artist}_${album}_${year}`.toUpperCase();

    return new Promise(resolve=>{
        db.get('SELECT id FROM album WHERE uniqname = ?', [uniqname], (err, row)=>{
            if(err) {
                console.error(err);
            } else {
                if(row) {
                    resolve(row.id);
                } else {
                    db.run('INSERT INTO album (name, uniqname) VALUES(?, ?)', [album, uniqname], (err)=>{
                        console.log('Added album:', uniqname);
                        resolve(  getAlbumId(artist, album, year) );
                    });
                }
            }
        });
    });
}

function addFile(file, next) {
    (async ()=>{
        let metadata;
        try {
            metadata = await mm.parseFile(file);
        } catch(e) {
            console.log('Metadata extract failed, adding anyway..');
        }

        let artistId=1;
        let year=0;
        let title=file;
        let track=0;
        let disk=0;
        let codec='-';
        let bitrate=0;
        let duration=0;
        let lossless=0;
        let albumId=1;
        let genre=0;

        try {
            const common = metadata.common;
            const format = metadata.format;
            artistId = await getArtistId(common.artist);
            year = common.year;
            title = common.title;
            track = common.track.no;
            disk = common.disk.no;
            codec = format.codec;
            bitrate = format.bitrate;
            duration = format.duration;
            lossless = format.lossless?1:0;
            albumId = await getAlbumId(artistId, common.album, year);
            genre = common.genre.join(',');
        } catch(e) {}

        db.run('INSERT INTO track (file, artist, album, year, title, track, disk, codec, bitrate, duration, lossless, genre) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[file, artistId, albumId, year, title, track, disk, codec, bitrate, duration, lossless, genre], (err)=>{
            if(err) {
                console.error('Error inserting '+file);
                console.error(err);
            }
            next();
        });
    })();
}

let files=0, dirs=0;

const filesToAdd=[];

function scan( dir ) {
	const ents = fs.readdirSync(dir, {withFileTypes: true});
	ents.forEach( ent=>{
		if(ent.isDirectory()) {
			scan(dir + '/' + ent.name);
			dirs++;
		}
		if(ent.isFile()) {
            const file = ent.name;
            if( file.match(/\.mp3$|\.wav$|\.ogg$|\.flac$|\.mp2$|\.wma$|\.m4a$/i)) {
                files++;
                filesToAdd.push({fileName: dir +'/'+file, inDb: false});
            }
		}
	});
}

function addFromArr(idx, done) {

    if(idx < filesToAdd.length) {
        const { fileName, inDb }= filesToAdd[idx];
        if( !inDb ) {
            newFiles++;
            console.log(`Adding file ${idx} of ${filesToAdd.length}: ${fileName} ...`);
            addFile(fileName, ()=>{
                addFromArr(idx+1, done);
            });
        } else {
            setImmediate( ()=>addFromArr(idx+1, done));
        }
    } else {
        done();
    }

}


console.log('Scan music dir...');
const started = new Date().getTime();
scan('/music');
const ended = new Date().getTime();
const seconds = ((ended-started)/1000).toFixed(3);
console.log(`Scanned ${files} files in ${dirs} dirs in ${seconds} seconds.`);

// Mark files in db
let filesInDb=0;
let newFiles=0;
let staleFiles=0;

const filesToRemove=[];
console.log('Check existing...');
const namesOnly = filesToAdd.map(e=>e.fileName);
db.each( 'SELECT file FROM track', [],(err,row)=>{
    const idx = namesOnly.indexOf(row.file);
    if(idx !== -1) {
        filesToAdd[idx].inDb=true;
        filesInDb++;
    } else {
        staleFiles++;
        console.log(`File ${row.file} no longer exists.`);
        filesToRemove.push(row.file);
    }
}, ()=>{
    console.log('Adding new files...');
    addFromArr(0, ()=>{

        if(filesToRemove.length) {
            console.log('Removing old files...');
            db.run('DELETE FROM track WHERE file IN ('+filesToRemove.map(e=>'?').join(',')+')', filesToRemove, (err)=>{
                if(err) {
                    console.log(err);
                }
                allDone();
            });
        } else {
            allDone();
        }

    });
});


async function allDone() {
    console.log(`New files: ${newFiles} Existing files: ${filesInDb} Delted files: ${staleFiles}`);
    console.log('Generating /list ...');
    await genList();
    console.log('List done.');
    db.close();
    console.log('Db closed.');
    console.log('Process exit.');
}

async function genList() {
    return new Promise(resolve=>{
    const db = new sqlite3.Database('/db/metadata.sqlite');

        const writeStream = fs.createWriteStream('/db/list.htm', { flags : 'w', flush: true});
        writeStream.write('<html><head><title>list</title><head><body><table width="100%" border=1><tr><td>codec</td><td>Album</td><td>Artist</td><td>Title</td><td>Year</td></tr>')
        db.each('SELECT track.rowid, year, duration,codec, file, title, artist.name AS artistName, album.name AS albumName FROM track INNER JOIN artist ON artist.id=track.artist INNER JOIN album ON album.id=track.album ORDER BY track.rowid DESC', async (err,row)=>{
            if(err) {
                console.log(err);
            }
            await new Promise( wr=>{
                const tt = `${row.title}<br>${row.id} : ${row.file.substr(7)}`;
                const r = `<tr><td>${row.codec}</td><td>${row.albumName}</td><td>${row.artistName}</td><td>${tt}</td><td>${row.year}</td></tr>\n`;
                writeStream.write(r, ()=>{
                    wr();
                });
            });
        },
        ()=>{
            writeStream.write('</table></body>');
            db.close();
            resolve();
        });
    });
}

