
let lastQuery = [];
let curPage = 0;
function loadList(query, random, offset) {
    lastQuery = query.split(' ');

    let request;
    if (offset !== 0) {
        request = new Request('browse.json?p=' + offset);
    } else {
        curPage = 0;
        request = new Request((random) ? 'random.json' : 'tracks.json?q=' + query);
    }

    return fetch(request).then(response => {
        return response.blob();
    }).then(blob => {
        return blob.text();
    });
}

function getClass(idx) {
    return ((idx % 2 === 0) ? 'a' : 'b');
}

let pl;
async function setList(random, offset) {
    const list = await loadList(document.getElementById('search').value, random, offset);
    pl = JSON.parse(list);

    document.getElementById('numres').innerHTML = pl.length;


    if (!random && lastQuery.length) {
        const art = lastQuery[0];
        const tra = lastQuery[lastQuery.length - 1];

        const rules = [
            { r: new RegExp('^' + art + '$', 'i'), pa: 40, pt: 35 },
            { r: new RegExp('^' + tra + '$', 'i'), pa: 35, pt: 40 },
            { r: new RegExp('^' + art, 'i'), pa: 30, pt: 25 },
            { r: new RegExp('^' + tra, 'i'), pa: 25, pt: 30 },
            { r: new RegExp(art + '$', 'i'), pa: 20, pt: 15 },
            { r: new RegExp(tra + '$', 'i'), pa: 15, pt: 20 },
            { r: new RegExp(art, 'i'), pa: 10, pt: 5 },
            { r: new RegExp(tra, 'i'), pa: 5, pt: 10 },
        ];

        if (curPage === 0 && offset === 0) {
            pl.forEach((e) => {
                e.score = 0;
                rules.forEach(r => {
                    if (e.title && e.title.match(r.r)) {
                        e.score += r.pt;
                    }
                    if (e.artistName && e.artistName.match(r.r)) {
                        e.score += r.pa;
                    }
                    if (e.codec && e.codec === 'FLAC') {
                        e.score += 100;
                    }
                });

            });
            pl.sort((a, b) => b.score - a.score);
        }
    }

    let html = '<table border=1 style="border: 1px solid black; border-collapse:collapse; width:100%">';
    pl.forEach((track, idx) => {
        const duration = `${('' + Math.floor(track.duration / 60)).padStart(2, '0')}:${('' + Math.round(track.duration % 60)).padStart(2, '0')}`;
        const fn = track.file.replaceAll("'", "\\'").replaceAll('#', '%23');
        html += '<tr class="' + getClass(idx) + '" id=' + idx + '><td>' + track.codec.split(' ')[0] + '</td><td>' + track.albumName + '</td><td onclick="playFrom(\'' + fn + '\',' + idx + ');" class="c">' + track.artistName + '</td><td onclick="add(\'' + fn + '\');" class="c">' + ((track.title !== 'Untitled') ? track.title : track.file) + '</td><td onclick="playNow(\'' + fn + '\');" class="c">' + duration + '</td><td>' + track.year + '</td></tr>';
    });

    html += '</table>';

    document.getElementById('list').innerHTML = html;
}

const audio = new Audio();

let queue = [];

audio.addEventListener('ended', playNext);
let cpl = -1;

function stopAuto() {
    cpl = -1;
    document.getElementById('status').innerHTML = '';
    audio.src = '';
}

function playNext() {
    queue.shift();
    setQueue();
    if (queue.length) {
        play(queue[0]);
    } else if (pl.length && cpl !== -1 && cpl < pl.length) {
        play(pl[cpl].file);
        document.getElementById('status').innerHTML = 'Autoplay:<b onclick="stopAuto()" class="c">' + pl[cpl].file + '</b>&nbsp;&nbsp;&nbsp;<span id="playtime"></span>';
        cpl++;
    } else {
        cpl = -1;
        audio.src = '';
        document.getElementById('toggle').value = '.';
    }
}

function add(file) {
    cpl = -1;
    queue.push(file);
    setQueue();
    if (queue.length === 1) {
        play(file);
    }
}

function setQueue() {
    document.getElementById('status').innerHTML = queue.map((e, i) => (i === 0 ? '<b>' : '') + '<span class="c" onclick="remove(' + i + ')">' + e + '</span>' + (i === 0 ? '</b>&nbsp;&nbsp;<span id="playtime"></span>' : '')).join('<br>');

}

function remove(idx) {
    if (idx === 0) {
        playNext();
    } else {
        queue.splice(idx, 1);
        setQueue();
    }
}

let playing = false;

function playFrom(file, idx) {
    add(file);
    if (idx + 1 < pl.length);
    cpl = idx + 1;
}

function playNow(file) {
    queue.splice(1, 0, file);
    playNext();
}

function play(file) {
    audio.pause();

    if (document.getElementById('silly').checked && file.endsWith('.flac')) {
        file = '/flac' + file;
    }
    audio.src = file;
    audio.load();
    audio.play();
    document.getElementById('toggle').value = '⏸︎';
    playing = true;
    pl.forEach((e, idx) => {
        if (e.file === file) {
            document.getElementById(idx).className = 'p';
        } else {
            document.getElementById(idx).className = getClass(idx);
        }
    });
}

function toggle() {
    if (playing) {
        playing = false;
        audio.pause();
        document.getElementById('toggle').value = '⏵︎';
    } else {
        playing = true;
        audio.play();
        document.getElementById('toggle').value = '⏸︎';
    }
}

let tim = null;
document.addEventListener('DOMContentLoaded', () => {
    tim = document.getElementById('tim');

    tim.addEventListener('change', (event) => {
        audio.currentTime = audio.duration / 100 * tim.value;
    });
});

async function toggleFullscreen(doc) {
    isFullScreen = !isFullScreen;

    if (isFullScreen) {
        await canvas.requestFullscreen();
        setTimeout(() => {
            canvas.width = window.screen.width;
            canvas.height = window.screen.height;
            width = canvas.width;
            height = canvas.height;
            step = width / binCount;
        }, 100);

    } else {
        doc.exitFullscreen();
        height = 400;
        canvas.height = 400;
        width = canvas.width;
        step = width / binCount;
    }

}

document.addEventListener("keydown", async (event) => {
    if (document.activeElement !== document.getElementById('search')) {
        let hit = false;
        if (event.code === 'KeyH') {
            hit = true;
            const help = document.getElementById('help');
            if (help.style.display !== 'none') {
                help.style.display = 'none';
            } else {
                help.style.display = 'block';
            }
        }
        if (event.code === 'KeyJ') {
            hit = true;
            document.getElementById('search').focus();
        }

        if (event.code === 'Comma') {
            hit = true;
            if (curPage === 0) {
                curPage = pl[0].id - 1;
            } else {
                curPage -= 10;
            }
            setList(false, curPage);
        }

        if (event.code === 'Period') {
            hit = true;
            if (curPage === 0) {
                curPage = pl[0].id - 1;
            } else {
                curPage += 10;
            }
            setList(false, curPage);
        }

        if (event.code === 'ArrowLeft') {
            hit = true;
            if (audio.currentTime < 10) {
                audio.currentTime = 0;
            } else {
                audio.currentTime -= 10;
            }
        }

        if (event.code === 'ArrowRight') {
            hit = true;
            if (audio.currentTime + 10 < audio.duration) {
                audio.currentTime += 10;
            }
        }
        if (event.code === 'KeyV') {
            hit = true;
            if (visIsInit && showVis) {

                fallStyle++;

                if (fallStyle > 1) {
                    fallStyle = 0;
                    toggleVis()
                }
            } else {
                toggleVis();
            }
        }
        if (event.code == 'KeyM') {
            hit = true;
            if (!visIsInit) {
                return;
            }
            toggleMono();
        }
        if (event.code === 'KeyF') {
            hit = true;
            if (!visIsInit) {
                return;
            }

            await toggleFullscreen(document);


            event.stopPropagation();
            event.preventDefault();
        }


        if (hit) {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    if (event.code === 'Insert') {
        playNext();
    }

    if (event.code === 'Enter') {
        add(pl[0].file);
    }

}, false);


let updateTime = setInterval(() => {
    const playtime = document.getElementById('playtime');
    if (playtime) {
        if (tim) {
            tim.value = (100 / audio.duration) * audio.currentTime;
        }
        const a = ('' + Math.floor(audio.currentTime / 60)).padStart(2, '0');
        const b = ('' + Math.floor(audio.currentTime % 60)).padStart(2, '0');
        const c = ('' + Math.floor(audio.duration / 60)).padStart(2, '0');
        const d = ('' + Math.floor(audio.duration % 60)).padStart(2, '0');
        playtime.innerHTML = `${a}:${b} / ${c}:${d}`;
        let file = audio.currentSrc;
        file = file.substr(file.lastIndexOf('/') + 1);
        file = file.substr(0, file.lastIndexOf('.'));
        document.title = file.replaceAll('%20', ' ');;
    }
}, 250);



let visIsInit = false;

let showVis;
let togglePop;
let ctx;
let src;
let splitter;
let fftSize;
let leftAnalyser;
let rightAnalyser;
let binCount;
let canvas;
let t;
let freql;
let freqr;
let width;
let step;

let bassHist;
let avgbass;
let isFullScreen;
let height;
let isMono;
let fallSpeed;
let fallStyle;
let toggleMono;
let smooth;
let monoNode = null;

async function toggleVis() {
    if (visIsInit) {
        showVis = !showVis;

        if (showVis) {
            showVis = false;

            setTimeout(() => {
                canvas.style.display = 'block';
                showVis = true;
                draw();
            }, 200);
        } else {
            canvas.style.display = 'none';
        }

        return;
    }
    visIsInit = true;
    showVis = true;

    ctx = new (window.AudioContext || window.webkitAudioContext)();
    src = ctx.createMediaElementSource(audio);

    splitter = ctx.createChannelSplitter(2);
    src.connect(splitter);

    fftSize = 2048;

    leftAnalyser = ctx.createAnalyser();
    rightAnalyser = ctx.createAnalyser();


    leftAnalyser.fftSize = fftSize;
    rightAnalyser.fftSize = fftSize;
    leftAnalyser.smoothingTimeConstant = 0;
    rightAnalyser.smoothingTimeConstant = 0;

    smooth = function (s) {
        leftAnalyser.smoothingTimeConstant = s;
        rightAnalyser.smoothingTimeConstant = s;
    }

    binCount = rightAnalyser.frequencyBinCount;

    splitter.connect(leftAnalyser, 0);
    splitter.connect(rightAnalyser, 1);


    src.connect(ctx.destination);

    canvas = document.createElement('canvas');
    visWin = window;
    document.body.insertBefore(canvas, document.body.firstChild);



    t = canvas.getContext('2d');

    setTimeout(() => canvas.addEventListener('click', togglePop), 200);

    freql = new Uint8Array(binCount);
    freqr = new Uint8Array(binCount);

    canvas.style.width = "100%";
    canvas.style.display = "block";

    width = 100;
    step = 1;
    canvas.height = 400;
    isFullScreen = false;
    height = canvas.height;
    isMono = false;
    fallSpeed = 1;
    fallStyle = 0;

    function onResize(win, doc) {
        if (!isFullScreen) {
            const dpr = Math.max(1, win.devicePixelRatio || 1);
            if (doc) {
                canvas.width = Math.round(document.getElementById('list').getBoundingClientRect().width * dpr);
                canvas.height = 400;
            }
            else {
                canvas.width = win.innerWidth;
                canvas.height = win.innerHeight;
            }
            width = canvas.width;
            height = canvas.height;
            step = width / binCount;
        }
        t.fillStyle = `rgb(0,0,0)`;
        t.fillRect(0, 0, width, canvas.height);
    }

    window.addEventListener('resize', () => onResize(window, document));
    onResize(window, document);


    function srcToUrl(src) {
        const srcString = `(${src.toString()})();`
        const blob = new Blob([srcString], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }

    // lazy hack because I don't want more files, and I still want syntax highlighting..
    const url = srcToUrl(() => {
        class Monoize extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [];
            }
            process(inputs, outputs, parameters) {
                const input = inputs[0];
                const output = outputs[0];
                if (output.length == 2 && output[0].length == output[1].length) {
                    const il = input[0] || new Float32Array(output[0].length);
                    const ol = output[0];
                    const ir = input[1] || new Float32Array(output[1].length);
                    const or = output[1];

                    for (let i = 0; i < or.length; i++) {
                        const v = (il[i] + ir[i]) / 2;
                        or[i] = v;
                        ol[i] = v;
                    }
                }

                return false;
            }
        }
        registerProcessor('Monoize', Monoize);
    });

    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url); // optional cleanup after load


    if (!monoNode) {
        monoNode = new AudioWorkletNode(ctx, 'Monoize', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            parameterData: {},
            processorOptions: {}
        });
    }

    toggleMono = function () {
        isMono = !isMono;



        if (isMono) {
            src.disconnect();
            //            src.disconnect(ctx.destination);
            //          src.disconnect(splitter);
            src.connect(monoNode);

            monoNode.connect(ctx.destination);
            monoNode.connect(splitter);

        } else {
            //monoNode.disconnect(ctx.destination);
            //monoNode.disconnect(splitter);
            src.disconnect();
            monoNode.disconnect();
            src.connect(ctx.destination);
            src.connect(splitter);
        }

    }

    draw = function () {
        leftAnalyser.getByteFrequencyData(freql);
        rightAnalyser.getByteFrequencyData(freqr);

        const halfHeight = height / 2;
        const cHeight = halfHeight * 0.07;
        const wfHeight = halfHeight - cHeight;

        const bwfBegin = wfHeight + cHeight + cHeight;


        t.drawImage(canvas, 0, fallSpeed, width, wfHeight, 0, 0, width, wfHeight);
        t.drawImage(canvas, 0, bwfBegin - fallSpeed, width, wfHeight, 0, bwfBegin, width, wfHeight);

        let lx = 0;

        for (let i = 0; i < binCount; i++) {
            const l = freql[i];
            const r = freqr[i];
            const d = Math.abs(l - r);

            if (fallStyle == 0) {
                t.fillStyle = `rgb(${l},${r},${d})`;
                t.fillRect(lx, wfHeight, step, cHeight);

                t.fillStyle = `rgb(${r},${l},${d})`;
                t.fillRect(lx, wfHeight + cHeight, step, cHeight);
            } else {
                t.fillStyle = `rgb(${l},${l - 255},${l - 255})`;
                t.fillRect(lx, wfHeight, step, cHeight);

                t.fillStyle = `rgb(${r},${r - 255},${r - 255})`;
                t.fillRect(lx, wfHeight + cHeight, step, cHeight);
            }
            lx += step;

        }

        if (showVis) {
            visWin.requestAnimationFrame(draw);
        }

    };

    draw();
    // popout

    //const host   = document.getElementById('canvasHost');
    let win = null;
    togglePop = () => {

        if (win) {
            return;
        }
        win = window.open('', '', 'width=900,height=700');
        if (!win) { alert('Popup blocked'); return; }

        win.document.write(`
    <!doctype html>
    <title>DSTream viz</title>
    <style>
      html,body{margin:0;height:100%}
      body{background:#111}
      canvas{display:block;width:100%;height:100%}
    </style>
    `);
        win.document.close();

        canvas.removeEventListener('click', togglePop);

        visWin = win;

        win.document.body.appendChild(win.document.adoptNode(canvas));

        win.addEventListener('resize', () => onResize(win, null));

        // If the popout window closes, put the canvas back
        win.addEventListener('beforeunload', () => {
            //host.replaceChild(canvas, placeholder);
            document.body.insertBefore(canvas, document.body.firstChild);
            canvas.addEventListener('click', togglePop);
            visWin = window;
            win = null;
        });


    };


    // Init vis function
}
