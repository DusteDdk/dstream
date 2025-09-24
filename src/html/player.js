
let visWrap;
setTimeout(() => {
    visWrap = document.getElementById('visWrap');
}, 1000);

//

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
let keyNum = 0;
let searchStr = '';

let numTracks = 0;

async function setList(random, offset) {

    if (isNaN(offset)) {
        offset = 0;
        random = true;
    }

    keyNum++;
    const myKey = keyNum;

    const canOptimize = (!random && offset === 0);
    if (canOptimize) {
        await new Promise((resolve) => {
            setTimeout(resolve, 250);
        });

        if (keyNum != myKey) {
            return;
        }

        if (isNaN(offset)) {
            random = true;
            offset = 0;
            curPage = 0;
        }

    }

    const mySearchStr = document.getElementById('search').value;

    if (canOptimize && mySearchStr == searchStr) {
        return;
    }

    searchStr = mySearchStr;
    const list = await loadList(mySearchStr, random, offset);

    if (canOptimize && searchStr != mySearchStr) {
        return;
    }

    pl = JSON.parse(list);

    if (offset === 0) {
        numTracks = pl.length;
        document.getElementById('numres').innerHTML = pl.length;
    } else {

    }


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

    let html = '<table border=1 style="border: 1px solid; border-collapse:collapse; width:100%">';
    pl.forEach((track, idx) => {
        if (!track) { return console.error(`Track is null at idx ${idx} curPage ${curPage} in list of ${pl.length}`); }
        const duration = `${('' + Math.floor(track.duration / 60)).padStart(2, '0')}:${('' + Math.round(track.duration % 60)).padStart(2, '0')}`;
        const fn = track.file.replaceAll("'", "\\'").replaceAll('#', '%23');
        const trackNum = (track.id) ? track.id : idx + curPage;
        html += '<tr class="' + getClass(idx) + '" id=' + idx + '><td>' + trackNum + ' ' + track.codec.split(' ')[0] + '</td><td>' + track.albumName + '</td><td onclick="playFrom(\'' + fn + '\',' + idx + ');" class="c">' + track.artistName + '</td><td onclick="add(\'' + fn + '\');" class="c">' + ((track.title !== 'Untitled') ? track.title : track.file) + '</td><td onclick="playNow(\'' + fn + '\');" class="c">' + duration + '</td><td>' + track.year + '</td></tr>';
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

document.addEventListener("fullscreenchange", (event) => {
    if (document.fullscreenElement) {
        canvas.removeEventListener('click', togglePop);

        setTimeout(() => {
            canvas.width = window.screen.width;
            canvas.height = window.screen.height;
            width = canvas.width;
            height = canvas.height;
            step = width / binCount;
        }, 100);
    } else {
        setTimeout(() => {
            //canvas.addEventListener('click', togglePop);
            height = 400;
            canvas.height = 400;
            width = canvas.width;
            step = width / binCount;
            onMainResize();
        }, 100);
    }

});

async function toggleFullscreen() {
    if (win) {
        return;
    }

    if (!document.fullscreenElement) {
        await canvas.requestFullscreen();
    } else {
        document.exitFullscreen();
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

        if (event.code === 'Space') {
            hit = true;
            toggle();
        }

        if (event.code === 'Comma') {
            hit = true;
            if (curPage === 0) {
                curPage = pl[0].id - 1;
            } else {
                curPage -= 28;
            }

            setList(false, curPage);
        }

        if (event.code === 'Period') {
            hit = true;
            if (curPage === 0) {
                curPage = pl[0].id + 1;
            } else {
                curPage += 28;
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

            await toggleFullscreen();


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



let showVisWidth = false;
let visIsInit = false;



const WidthAsLogTen = (width, idx, binCount) => width * (Math.log10(1 + 1 / (idx + 1) / Math.log10(binCount)));
const WidthAsLinear = (width, idx, binCount) => width / binCount;
const WidthAsOne = () => 1;
const WidthAsBestEffort = (width, idx, binCount, lastWidth) => {

    if (idx === 0) {
        if (lastWidth > canvas.width) {
            if (lastdir !== 1) {
                besf -= 0.05;
                lastdir = -1;
            }
        }
        if (lastWidth < canvas.width) {
            if (lastdir !== -1) {
                besf += 0.05;
                lastdir = 1;
            }

        }
    }
    return ((width / binCount) * (1 - Math.log(idx + 1) / Math.log(binCount))) * besf;
};
const WidthFunctions = {
    WidthAsLogTen,
    WidthAsLinear,
    WidthAsOne,
    WidthAsBestEffort,
};
let setFallSpeed;
let setVisMono;
let widthFun = WidthAsLinear;
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
let win = null;
let lastWidth = 1024;
let DrawUnbalance;
let DrawStereoDiff;
let DrawStereoNoDiffColor;
let DrawStereo;
let drawFunction;
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
let onMainResize;
let showVis = false;
let useCurve = false;
let showingCurve = false;
let nrgDist;
let nrgCounts = 0;
let besf = 1;
let lastdir = 0;


let setVisWidth = (key) => {
    widthFun = WidthFunctions[key];
};

function toggleUseCurve() {
    useCurve = document.getElementById("curveEnabled").checked;
}

function toggleIntensity() {
    const c = document.getElementById("curve");
    const bc = document.getElementById("btnShowIntensity");


    if (c.style.display == "block") {
        c.style.display = 'none';
        bc.value = "🗖";
        showingCurve = false;
    } else {
        showingCurve = true;
        c.style.display = 'block';
        bc.value = "🗕";
    }
}

async function toggleVis() {
    if (visIsInit) {
        showVis = !showVis;

        document.getElementById('visWrap').style.display = (showVis) ? 'block' : 'none';
        if (showVis) {
            showVis = false;
            setTimeout(() => {
                document.getElementById('visSettings').style.display = 'block';
                canvas.style.display = 'block';
                showVis = true;
                drawFunction();
            }, 200);
        } else {
            document.getElementById('visSettings').style.display = 'none';

            canvas.style.display = 'none';
        }

        return;
    }

    visIsInit = true;
    showVis = true;

    document.getElementById('visSettings').style.display = 'block';
    document.getElementById('visWrap').style.display = (showVis) ? 'block' : 'none';


    CurveEditorInit();
    useCurve = document.getElementById("curveEnabled").checked = useCurve;

    let externalSource = false;

    toggleCapture = async () => {
        if (ctx) {
            await ctx.close();
        }
        externalSource = !externalSource;

        document.getElementById("toggleCaptureBtn").value = externalSource ? "🔈" : "🎤";

        ctx = new (window.AudioContext || window.webkitAudioContext)();

        if (externalSource) {
            const base = {
                echoCancellation: false,    // disable processing to avoid mono downmix
                noiseSuppression: false,
                autoGainControl: false
            };
            const supports = navigator.mediaDevices.getSupportedConstraints();
            // Request stereo if supported (don’t fail if unavailable).
            const stereo = supports.channelCount ? { channelCount: { ideal: 2 } } : {};

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { ...base, ...stereo }
            });
            const inTrack = stream.getAudioTracks()[0];
            console.log('Actual channels:', inTrack.getSettings().channelCount); // 1, 2, ...
            // Hook into WebAudio
            src = ctx.createMediaStreamSource(stream);

        } else {
            src = ctx.createMediaElementSource(audio);
            src.connect(ctx.destination);
        }

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


        function srcToUrl(src) {
            const srcString = `(${src.toString()})();`
            const blob = new Blob([srcString], { type: 'application/javascript' });
            return URL.createObjectURL(blob);
        }

        // lazy hack because I don't want more files, and I still want syntax highlighting..
        const url = srcToUrl(() => {
            let chan = 0;
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


        monoNode = new AudioWorkletNode(ctx, 'Monoize', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            parameterData: {},
            processorOptions: {}
        });


    }

    // hack, use toggle to init the audio chain..
    // Default is NOT to capture external source, so we start by toggling from true to false, then applying that.
    externalSource = true;

    await toggleCapture();







    canvas = document.createElement('canvas');
    visWrap.style.boxShadow = '0 4px 8px 0px black';
    visWin = window;
    visWrap.insertBefore(canvas, visWrap.firstChild)



    t = canvas.getContext('2d');

    //setTimeout(() => canvas.addEventListener('click', togglePop), 200);

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
            lastWidth = canvas.width;
            lastdir = 0;
            besf = 1;
        }
        t.fillStyle = `rgb(0,0,0)`;
        t.fillRect(0, 0, width, canvas.height);
    }

    onMainResize = () => {
        onResize(window, document);
    };

    window.addEventListener('resize', onMainResize);
    onMainResize();


    setFallSpeed = (speedPct) => {
        fallSpeed = 1 / 25 * speedPct;
        document.getElementById('visFallSpeedDisp').textContent = `${fallSpeed} p/f`;
    }

    toggleMono = function () {
        isMono = !isMono;
        src.disconnect();

        if (isMono) {
            src.connect(monoNode);
            monoNode.connect(ctx.destination);
            monoNode.connect(splitter);

        } else {
            monoNode.disconnect();
            src.connect(ctx.destination);
            src.connect(splitter);
        }
    }

    lastWidth = canvas.width;


    DrawStereoNoDiffColor = function () {
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

            const w = widthFun(canvas.width, i, binCount, lastWidth);

            if (fallStyle == 0) {
                t.fillStyle = `rgb(${l},${r},0)`;
                t.fillRect(lx, wfHeight, w, cHeight);

                t.fillStyle = `rgb(${r},${l},0)`;
                t.fillRect(lx, wfHeight + cHeight, w, cHeight);
            } else {
                t.fillStyle = `rgb(${l},${l - 255},${l - 255})`;
                t.fillRect(lx, wfHeight, w, cHeight);

                t.fillStyle = `rgb(${r},${r - 255},${r - 255})`;
                t.fillRect(lx, wfHeight + cHeight, w, cHeight);
            }
            lx += w;
        }
        lastWidth = lx;
        if (showVisWidth) {
            t.fillStyle = `rgb(0,0,0)`;
            t.fillRect(0, wfHeight + (cHeight / 2), width, cHeight);

            t.fillStyle = `rgba(255,255,255,0.8)`;
            t.fillRect(0, wfHeight + (cHeight / 2), lx, cHeight);
        }

        if (showVis) {
            visWin.requestAnimationFrame(drawFunction);
        }

    };


    DrawStereo = function () {
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

            const w = widthFun(canvas.width, i, binCount, lastWidth);

            if (fallStyle == 0) {
                t.fillStyle = `rgb(${l},${r},${d})`;
                t.fillRect(lx, wfHeight, w, cHeight);

                t.fillStyle = `rgb(${r},${l},${d})`;
                t.fillRect(lx, wfHeight + cHeight, w, cHeight);
            } else {
                t.fillStyle = `rgb(${l},${l - 255},${l - 255})`;
                t.fillRect(lx, wfHeight, w, cHeight);

                t.fillStyle = `rgb(${r},${r - 255},${r - 255})`;
                t.fillRect(lx, wfHeight + cHeight, w, cHeight);
            }
            lx += w;
        }
        lastWidth = lx;
        if (showVisWidth) {
            t.fillStyle = `rgb(0,0,0)`;
            t.fillRect(0, wfHeight + (cHeight / 2), width, cHeight);

            t.fillStyle = `rgba(255,255,255,0.8)`;
            t.fillRect(0, wfHeight + (cHeight / 2), lx, cHeight);
        }

        if (showVis) {
            visWin.requestAnimationFrame(drawFunction);
        }

    };

    let db = [];
    for (let i = 0; i < binCount * 2; i++) { db[i] = 0; }
    DrawUnbalance = function () {
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
            const dd = Math.abs(l - r);

            if (dd < 15) {
                if (db[i] > 128) { db[i] -= 16 }
                if (db[i] > 64) { db[i] -= 8 }
                if (db[i] > 16) { db[i] -= 6 }
                if (db[i] > 0) { db[i] -= 4 }
                //db[i] *= 0.90;
            }
            db[i] += dd / 3;

            if (db[i] < 0) { db[i] = 0; } else if (db[i] > 255) { db[i] = 255; }


            let d = db[i];

            const w = widthFun(canvas.width, i, binCount, lastWidth);

            if (fallStyle == 0) {
                t.fillStyle = `rgb(${l},${r},${d - r})`;
                t.fillRect(lx, wfHeight, w, cHeight);

                t.fillStyle = `rgb(${r},${l},${d - l})`;
                t.fillRect(lx, wfHeight + cHeight, w, cHeight);
            } else {
                t.fillStyle = `rgb(${l},${l - 255},${l - 255})`;
                t.fillRect(lx, wfHeight, w, cHeight);

                t.fillStyle = `rgb(${r},${r - 255},${r - 255})`;
                t.fillRect(lx, wfHeight + cHeight, w, cHeight);
            }
            lx += w;
        }
        lastWidth = lx;
        if (showVisWidth) {
            t.fillStyle = `rgb(0,0,0)`;
            t.fillRect(0, wfHeight + (cHeight / 2), width, cHeight);

            t.fillStyle = `rgba(255,255,255,0.8)`;
            t.fillRect(0, wfHeight + (cHeight / 2), lx, cHeight);
        }

        if (showVis) {
            visWin.requestAnimationFrame(drawFunction);
        }

    };


    let chanImb = [];
    for (let i = 0; i < binCount; i++) { chanImb[i] = { l: 0, r: 0 }; }

    nrgDist = new Array(256);
    for (let i = 0; i < 256; i++) { nrgDist[i] = 0; }

    let nrgDistB = new Array(256);
    for (let i = 0; i < 256; i++) { nrgDistB[i] = 0; }


    DrawStereoDiff = function () {
        leftAnalyser.getByteFrequencyData(freql);
        rightAnalyser.getByteFrequencyData(freqr);

        const halfHeight = height / 2;
        const cHeight = halfHeight * 0.07;
        const wfHeight = halfHeight - cHeight;

        const bwfBegin = wfHeight + cHeight + cHeight;

        if (playing) {
            t.drawImage(canvas, 0, fallSpeed, width, wfHeight, 0, 0, width, wfHeight);
            t.drawImage(canvas, 0, bwfBegin - fallSpeed, width, wfHeight, 0, bwfBegin, width, wfHeight);

            let lx = 0;

            for (let i = 0; i < binCount; i++) {
                let l = freql[i];
                let r = freqr[i];


                const limb = r - l;
                const rimb = l - r;

                if (limb > 32 && chanImb[i].l < 512) {
                    chanImb[i].l = chanImb[i].l * 0.85 + limb * 0.75;
                } else {
                    chanImb[i].l = chanImb[i].l * 0.9;
                }
                if (rimb > 32 && chanImb[i].r < 512) {
                    chanImb[i].r = chanImb[i].r * 0.85 + rimb * 0.75;
                } else {
                    chanImb[i].r = chanImb[i].r * 0.9;
                }


                if (showingCurve) {
                    if (l > 0) {
                        nrgDist[l]++;
                    }
                    if (r > 0) {
                        nrgDist[r]++;
                    }
                }

                let il = chanImb[i].l;
                let ir = chanImb[i].r;
                if (useCurve) {
                    l = window.applyCurve(l);
                    r = window.applyCurve(r);
                    if (l > 0) {
                        nrgDistB[l]++;
                    }
                    if (l > 0) {
                        nrgDistB[r]++;
                    }
                    il = window.applyCurve(il);
                    ir = window.applyCurve(ir);
                }

                const w = widthFun(canvas.width, i, binCount, lastWidth);

                t.fillStyle = `rgb(${l},${r},${il - l})`;
                t.fillRect(lx, wfHeight, w, cHeight);

                t.fillStyle = `rgb(${r},${l},${ir - r})`;
                t.fillRect(lx, wfHeight + cHeight, w, cHeight);

                lx += w;
            }


            lastWidth = lx;

        }


        if (showVisWidth) {
            t.fillStyle = `rgb(0,0,0)`;
            t.fillRect(0, wfHeight + (cHeight / 2), width, cHeight);

            t.fillStyle = `rgba(255,255,255,0.8)`;
            t.fillRect(0, wfHeight + (cHeight / 2), lx, cHeight);
        }

        if (showVis) {
            if (showingCurve) {
                let max = 0;
                for (let i = 1; i < nrgDist.length; i++) {
                    max = Math.max(max, nrgDist[i], nrgDistB[i]);
                }
                window.drawCurve(nrgDist, nrgDistB, max);
            }
            visWin.requestAnimationFrame(drawFunction);
        }

    }

    drawFunction = DrawStereoDiff;
    drawFunction();
    // popout

    //const host   = document.getElementById('canvasHost');

    togglePop = () => {

        if (win) {
            win.close();
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


        //canvas.removeEventListener('click', togglePop);
        window.removeEventListener('resize', onMainResize);


        visWin = win;

        win.document.body.appendChild(win.document.adoptNode(canvas));

        win.addEventListener('resize', () => onResize(win, null));

        // If the popout window closes, put the canvas back
        win.addEventListener('beforeunload', () => {

            visWrap.insertBefore(canvas, visWrap.firstChild);
            window.addEventListener('resize', onMainResize);
            setTimeout(onMainResize, 60);

            visWin = window;
            win = null;
        });


    };


    // Init vis function
}
