
let lastQuery=[];
let curPage=0;
function loadList(query, random, offset) {
        lastQuery=query.split(' ');

        let request;
        if(offset !== 0) {
            request = new Request('browse.json?p='+offset);
        } else {
            curPage=0;
            request = new Request((random)?'random.json':'tracks.json?q='+query);
        }

        return fetch(request).then( response=>{
            return  response.blob();
        }).then( blob=>{
            return blob.text();
        });
}

function getClass(idx) {
    return ((idx%2===0)?'a':'b');
}

let pl;
async function setList(random, offset) {
    const list = await loadList(document.getElementById('search').value, random, offset);
    pl = JSON.parse(list);

    document.getElementById('numres').innerHTML = pl.length;


    if(!random && lastQuery.length) {
        const art = lastQuery[0];
        const tra = lastQuery[ lastQuery.length-1 ];

        const rules = [
            { r: new RegExp('^'+art+'$','i'),     pa: 40, pt: 35 },
            { r: new RegExp( '^'+tra+'$', 'i'),   pa: 35, pt: 40 },
            { r: new RegExp( '^'+art, 'i'),       pa: 30, pt: 25 },
            { r: new RegExp( '^'+tra, 'i'),       pa: 25, pt: 30 },
            { r: new RegExp( art+'$', 'i'),       pa: 20, pt: 15 },
            { r: new RegExp( tra+'$', 'i'),       pa: 15, pt: 20 },
            { r: new RegExp( art, 'i'),           pa: 10, pt: 5  },
            { r: new RegExp( tra, 'i'),           pa: 5,  pt: 10 },
        ];
        
        if(curPage===0 && offset===0) {
            pl.forEach( (e)=>{
                e.score = 0;
                rules.forEach( r=>{
                    if( e.title && e.title.match(r.r) ) {
                        e.score += r.pt;
                    }
                    if( e.artistName && e.artistName.match(r.r)) {
                        e.score += r.pa;
                    }
                    if( e.codec && e.codec === 'FLAC') {
                        e.score += 100;
                    }
                });

            });
            pl.sort( (a,b)=>b.score - a.score );
        }
    }


    let html ='<table border=1 style="border: 1px solid black; border-collapse:collapse; width:100%">';
    pl.forEach( (track,idx)=>{
        const duration = `${(''+Math.floor(track.duration/60)).padStart(2,'0')}:${(''+Math.round(track.duration%60)).padStart(2,'0')}`;
        const fn = track.file.replaceAll("'", "\\'");
        html += '<tr class="'+getClass(idx)+'" id='+idx+'><td>'+track.codec.split(' ')[0]+'</td><td>'+track.albumName+'</td><td onclick="playFrom(\''+fn+'\','+idx+');">'+track.artistName+'</td><td onclick="add(\''+fn+'\');">'+((track.title!=='Untitled')?track.title:track.file )+'</td><td onclick="playNow(\''+fn+'\');">'+duration+'</td><td>'+track.year+'</td></tr>';
    });

    html+='</table>';

    document.getElementById('list').innerHTML=html;
}

const audio = new Audio();

let queue=[];

audio.addEventListener('ended', playNext);
let cpl=-1;

function stopAuto() {
    cpl=-1;
    document.getElementById('status').innerHTML='';
    audio.src='';
}

function playNext() {
    queue.shift();
    setQueue();
    if(queue.length) {
        play(queue[0]);
    } else if(pl.length && cpl !==-1 && cpl < pl.length) {
        play(pl[cpl].file);
        document.getElementById('status').innerHTML = 'Autoplay:<b onclick="stopAuto()">'+pl[cpl].file+'</b>&nbsp;&nbsp;&nbsp;<span id="playtime"></span>';
        cpl++;
    } else {
        cpl=-1;
        audio.src='';
        document.getElementById('toggle').value='.';
    }
}

function add(file) {
    cpl=-1;
    queue.push(file);
    setQueue();
    if(queue.length===1) {
        play(file);
    }
}

function setQueue() {
    document.getElementById('status').innerHTML = queue.map( (e,i)=>(i===0?'<b>':'')+'<span onclick="remove('+i+')">'+e+'</span>'+(i===0?'</b>&nbsp;&nbsp;<span id="playtime"></span>':'')).join('<br>');

}

function remove(idx) {
    if(idx===0) {
        playNext();
    } else {
        queue.splice(idx,1);
        setQueue();
    }
}

let playing=false;

function playFrom(file, idx) {
    add(file);
    if(idx+1 < pl.length);
    cpl = idx+1;
}

function playNow(file) {
    queue.splice(1,0,file);
    playNext();
}

function play(file) {
    audio.pause();
    audio.src = file;
    audio.load();
    audio.play();
    document.getElementById('toggle').value='⏸︎';
    playing=true;
    pl.forEach( (e,idx)=>{
        if(e.file === file) {
            document.getElementById(idx).className='p';
        } else {
            document.getElementById(idx).className=getClass(idx);
        }
    });
}

function toggle() {
    if(playing) {
        playing = false;
        audio.pause();
        document.getElementById('toggle').value='⏵︎';
    } else {
        playing = true;
        audio.play();
        document.getElementById('toggle').value='⏸︎';
    }
}

let tim = null;
document.addEventListener('DOMContentLoaded', ()=>{
    tim = document.getElementById('tim');

    tim.addEventListener('change', (event)=>{
        audio.currentTime = audio.duration / 100 * tim.value;
    });
});

document.addEventListener("keydown", (event)=>{
    if(document.activeElement !== document.getElementById('search')) {
        let hit=false;
        if(event.code === 'KeyH') {
            hit=true;
            const help = document.getElementById('help');
            console.log('help');
            if(help.style.display !== 'none') {
                help.style.display = 'none';
            } else {
                help.style.display = 'block';
            }
        }
        if(event.code === 'KeyJ') {
            hit=true;
            document.getElementById('search').focus();
        }

        if(event.code === 'Comma') {
            hit=true;
            if(curPage===0) {
                curPage=pl[0].id-1;
            } else {
                curPage-=10;
            }
            setList(false, curPage);
        }

        if(event.code === 'Period') {
            hit=true;
            if(curPage===0) {
                curPage=pl[0].id-1;
            } else {
                curPage+=10;
            }
            setList(false, curPage);
        }

        if(event.code === 'ArrowLeft') {
            hit=true;
            if(audio.currentTime < 10) {
                audio.currentTime=0;
            } else {
                audio.currentTime -= 10;
            }
        }

        if(event.code === 'ArrowRight') {
            hit=true;
            if(audio.currentTime + 10 < audio.duration) {
                audio.currentTime += 10;
            }
        }


        if(hit) {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    if(event.code === 'Insert') {
       playNext();
    }

    if(event.code === 'Enter') {
       add( pl[0].file);
    }

}, false);


let updateTime = setInterval( ()=>{
    const playtime = document.getElementById('playtime');
    if(playtime) {
        if(tim) {
            tim.value = ( 100 / audio.duration) * audio.currentTime;
        }
        const a = (''+Math.floor(audio.currentTime/60)).padStart(2, '0');
        const b = (''+Math.floor(audio.currentTime%60)).padStart(2, '0');
        const c = (''+Math.floor(audio.duration/60)).padStart(2, '0');
        const d = (''+Math.floor(audio.duration%60)).padStart(2,'0');
        playtime.innerHTML = `${a}:${b} / ${c}:${d}`;
        let file=audio.currentSrc;
        file = file.substr( file.lastIndexOf('/')+1 );
        file = file.substr( 0, file.lastIndexOf('.') );
        document.title=file.replaceAll('%20',' ');;
    }
},250);
