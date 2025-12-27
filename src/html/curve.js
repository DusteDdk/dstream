const CurveEditorInit = (cfg = {}) => {

    const maxInValue = 255;
    const maxInValuePlusOne = maxInValue+1;
    const canvas = cfg.canvas;
    if( !canvas) {
        throw new Error("Need a canvas.");
    }

    const api = {
        canvas
    };


    const realMax = cfg.max;
    const realMaxPlusOne = realMax+1;
    const realMin = cfg.min ?? 0;

    const realPointScale = (!!realMax)? (realMax / maxInValue):1;





    const ctx = canvas.getContext('2d');

    // UI state
    const state = {
        points: [{ x: 0, y: 0 }, { x: maxInValue, y: maxInValue }], // control points (sorted by x)
        selected: -1,                            // index of selected control point
        dragging: false,
        showGrid: true,
        monotone: (cfg.monotone==undefined)?true : cfg.monotone,
        lut: new Uint8Array(maxInValuePlusOne),
        ilut: (!!realMax)?new Array(realMax):undefined,
        ilutTotal: 0,
    };

    

    // Public API ------------------------------------------------
    // window.applyCurve(value: number 0..255) -> number 0..255

    api.applyCurve = function (value, relative=0, total=0) {
        if(state.ilut) {
            const v = Math.min(realMax, Math.max(0, value | 0));
            const r = state.ilut[v];

            if(relative) {
                return relative / state.ilutTotal * r;
            }

            return r;
        }
        const v = Math.min(maxInValue, Math.max(0, value | 0));
        return state.lut[v];
    };



    // window.getCurveLUT() -> Uint8Array (copy)
    api.getCurveLUT = () => new Uint8Array(state.lut);
    // window.getCurvePoints() -> deep copy of points
    api.getCurvePoints = () => state.points.map(p => ({ x: p.x, y: p.y }));
    // window.setCurvePoints(points) -> replaces control points (validates, sorts, clamps)
    api.setCurvePoints = (pts) => {
        if (!Array.isArray(pts) || pts.length < 2) throw new Error('Need at least two points');
        state.points = pts.map(p => ({ x: clamp(0, maxInValue, p.x | 0), y: clamp(0, maxInValue, p.y | 0) }));
        sortUniqueByX(state.points);
        buildLUT();
        draw();
    };

    // Helpers ---------------------------------------------------
    function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }
    function sortUniqueByX(arr) {
        arr.sort((a, b) => a.x - b.x);
        // collapse duplicates by x, keep last
        const out = [];
        for (const p of arr) {
            if (out.length && out[out.length - 1].x === p.x) out.pop();
            out.push(p);
        }
        arr.length = 0; arr.push(...out);
    }

    // Coordinate transforms (data<->canvas) --------------------
    // Canvas is 512x512; we draw a square inner box with padding
    const PAD = 24;
    const BOX = { x: PAD, y: PAD, w: canvas.width - PAD * 2, h: canvas.height - PAD * 2 };
    function dataToCanvasX(x) { return BOX.x + (x / maxInValue) * BOX.w; }
    function dataToCanvasY(y) { return BOX.y + BOX.h - (y / maxInValue) * BOX.h; }
    function canvasToDataX(px) { return clamp(0, maxInValue, Math.round((px - BOX.x) / BOX.w * maxInValue)); }
    function canvasToDataY(py) { return clamp(0, maxInValue, Math.round((BOX.y + BOX.h - py) / BOX.h * maxInValue)); }



    // Monotone cubic Hermite spline (Fritsch–Carlson) ----------
    // Returns a function f(x) for x in [x0, xn]
    function buildMonotoneSpline(points) {
        const n = points.length;
        const xs = points.map(p => p.x), ys = points.map(p => p.y);
        const dx = new Array(n - 1), m = new Array(n);
        for (let i = 0; i < n - 1; i++) dx[i] = (ys[i + 1] - ys[i]) / Math.max(1e-6, (xs[i + 1] - xs[i]));
        // initial secant slopes at nodes
        m[0] = dx[0]; m[n - 1] = dx[n - 2];
        for (let i = 1; i < n - 1; i++) m[i] = (dx[i - 1] + dx[i]) * 0.5;
        // Fritsch–Carlson slope limiter
        for (let i = 0; i < n - 1; i++) {
            if (dx[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
            const a = m[i] / dx[i], b = m[i + 1] / dx[i];
            const s = a * a + b * b;
            if (s > 9) {
                const t = 3 / Math.sqrt(s);
                m[i] = t * a * dx[i];
                m[i + 1] = t * b * dx[i];
            }
        }
        return function (x) {
            // clamp outside domain
            if (x <= xs[0]) return ys[0];
            if (x >= xs[n - 1]) return ys[n - 1];
            // find segment i where xs[i] <= x < xs[i+1]
            let i = 0, j = n - 1;
            while (i + 1 < j) { // binary search for speed
                const mid = (i + j) >>> 1;
                if (x < xs[mid]) j = mid; else i = mid;
            }
            const h = xs[i + 1] - xs[i];
            const t = (x - xs[i]) / h;
            const t2 = t * t, t3 = t2 * t;
            const h00 = 2 * t3 - 3 * t2 + 1;
            const h10 = t3 - 2 * t2 + t;
            const h01 = -2 * t3 + 3 * t2;
            const h11 = t3 - t2;
            return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
        };
    }

    // Fallback: linear interpolation between nearest points
    function buildPiecewiseLinear(points) {
        const n = points.length;
        const xs = points.map(p => p.x), ys = points.map(p => p.y);
        return function (x) {
            if (x <= xs[0]) return ys[0];
            if (x >= xs[n - 1]) return ys[n - 1];
            let i = 0, j = n - 1;
            while (i + 1 < j) { const mid = (i + j) >>> 1; if (x < xs[mid]) j = mid; else i = mid; }
            const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
            return ys[i] * (1 - t) + ys[i + 1] * t;
        };
    }

    // Rebuild LUT whenever points change -----------------------
    function buildLUT() {
        sortUniqueByX(state.points);
        //if (state.monotone) enforceMonotone(state.points);
        const f = state.monotone ? buildMonotoneSpline(state.points) : buildPiecewiseLinear(state.points);
        for (let x = 0; x < maxInValuePlusOne; x++) {
            const y = clamp(realMin, maxInValue, Math.round(f(x)));
            state.lut[x] = y;
        }

        if(state.ilut) {
            let points = state.points.map( p=>({x: p.x*realPointScale, y: p.y*realPointScale}))
            const ff = state.monotone ? buildMonotoneSpline(points) : buildPiecewiseLinear(points);

            state.ilutTotal=0;
            for (let x = 0; x < realMaxPlusOne; x++) {
                const y = clamp(realMin, realMax, Math.round(ff(x)));
                if(cfg.asScalar) {
                    state.ilut[x] = y / realMax;
                } else {
                    state.ilut[x] = y;
                }
                state.ilutTotal += state.ilut[x];
            }
        }


        if(cfg.onLutReady) {
            cfg.onLutReady(api);
        }
    }

    // Optional: enforce monotonic increasing y w.r.t x ---------
    function enforceMonotone(points) {
        // Ensure y does not decrease with x (simple non-decreasing projection)
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < points[i - 1].y) points[i].y = points[i - 1].y;
        }
    }
    ctx.globalCompositeOperation = "source-over";
    // Drawing ---------------------------------------------------
    function draw(nrgDist, nrgDistB, maxDist, drawHist) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Frame & grid
        ctx.save();
        ctx.strokeStyle = '#232a37';
        ctx.lineWidth = 1;
        roundRect(ctx, BOX.x, BOX.y, BOX.w, BOX.h, 10); ctx.stroke();



        if (maxDist>0) {
            const ws = BOX.w / (nrgDist.length-1);
            let x=BOX.x;
            const y=BOX.y + BOX.h;
            for (let i = 1; i < nrgDist.length; i++) {
                let e = (1 / maxDist) * nrgDist[i];

                ctx.fillStyle = `rgba(0, 255, 200, 0.7)`;
                ctx.fillRect(x, y, ws, BOX.h * e * -1);

                e = (1 / maxDist) * nrgDistB[i];

                ctx.fillStyle = `rgba(255, 55, 228, 0.7)`;
                ctx.fillRect(x, y, ws, BOX.h * e * -1);

                x += ws;
                nrgDist[i] *= 0.96;
                nrgDistB[i] *= 0.96;

            }
        }


        if (state.showGrid) {
            ctx.strokeStyle = '#1b2230';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const steps = 4;
            for (let i = 1; i < steps; i++) {
                const gx = BOX.x + (i / steps) * BOX.w;
                const gy = BOX.y + (i / steps) * BOX.h;
                ctx.moveTo(gx, BOX.y); ctx.lineTo(gx, BOX.y + BOX.h);
                ctx.moveTo(BOX.x, gy); ctx.lineTo(BOX.x + BOX.w, gy);
            }
            ctx.stroke();
        }

        // Diagonal reference
        ctx.strokeStyle = '#243246';
        ctx.beginPath();
        ctx.moveTo(dataToCanvasX(0), dataToCanvasY(0));
        ctx.lineTo(dataToCanvasX(maxInValue), dataToCanvasY(maxInValue));
        ctx.stroke();

        // Curve from LUT (smooth polyline for visual fidelity)
        ctx.strokeStyle = '#9dd6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < maxInValuePlusOne; x++) {
            const px = dataToCanvasX(x);
            const py = dataToCanvasY(state.lut[x]);
            if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Control points
        for (let i = 0; i < state.points.length; i++) {
            const p = state.points[i];
            const cx = dataToCanvasX(p.x), cy = dataToCanvasY(p.y);
            ctx.fillStyle = (i === state.selected) ? '#40c463' : '#e2e8f0';
            ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    // Hit-testing for points -----------------------------------
    function findPoint(px, py) {
        // Return index of nearest point inside small radius
        const R2 = 9 * 9; // generous picking radius in screen px
        let best = -1, bestD2 = Infinity;
        for (let i = 0; i < state.points.length; i++) {
            const cx = dataToCanvasX(state.points[i].x);
            const cy = dataToCanvasY(state.points[i].y);
            const dx = px - cx, dy = py - cy; const d2 = dx * dx + dy * dy;
            if (d2 < R2 && d2 < bestD2) { best = i; bestD2 = d2; }
        }
        return best;
    }

    function withinBox(px, py) {
        return px >= BOX.x && px <= BOX.x + BOX.w && py >= BOX.y && py <= BOX.y + BOX.h;
    }

    // Mouse / touch handlers -----------------------------------
    let lastMouse = { x: 0, y: 0 };

    canvas.addEventListener('pointerdown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left, py = e.clientY - rect.top;
        lastMouse = { x: px, y: py };
        const hit = findPoint(px, py);
        if (hit !== -1) {
            state.selected = hit; state.dragging = true; canvas.setPointerCapture(e.pointerId);
        } else if (withinBox(px, py)) {
            // Add a new point when Shift is held (prevents accidental clutter)
            if (e.shiftKey) {
                const nx = canvasToDataX(px), ny = canvasToDataY(py);
                state.points.push({ x: nx, y: ny });
                sortUniqueByX(state.points);
                state.selected = state.points.findIndex(p => p.x === nx);
                buildLUT(); draw();
            }
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!state.dragging) return;
        const rect = canvas.getBoundingClientRect();
        let px = e.clientX - rect.left, py = e.clientY - rect.top;
        // Constrain inside box during drag
        px = clamp(BOX.x, BOX.x + BOX.w, px);
        py = clamp(BOX.y, BOX.y + BOX.h, py);
        // Convert to data space
        const nx = canvasToDataX(px);
        const ny = canvasToDataY(py);
        const i = state.selected;
        const pts = state.points;
        // Keep x ordered: clamp against neighbors
        const minX = (i > 0 ? pts[i - 1].x + 1 : 0);
        const maxX = (i < pts.length - 1 ? pts[i + 1].x - 1 : maxInValue);
        pts[i].x = clamp(minX, maxX, nx);
        pts[i].y = clamp(0, maxInValue, ny);
        //if (state.monotone) enforceMonotone(pts);
        buildLUT(); draw();
    });

    canvas.addEventListener('pointerup', (e) => {
        state.dragging = false; state.selected = state.selected; // keep selection
        canvas.releasePointerCapture(e.pointerId);
    });

    canvas.addEventListener('dblclick', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left, py = e.clientY - rect.top;
        if (!withinBox(px, py)) return;
        const hit = findPoint(px, py);
        if (hit !== -1 && state.points.length > 2) {
            state.points.splice(hit, 1);
            state.selected = -1;
        } else {

            const nx = canvasToDataX(px);
            const ny = canvasToDataY(py);
            state.points.push({ x: nx, y: ny });
            sortUniqueByX(state.points);
            state.selected = state.points.findIndex(p => p.x === nx);
        }
        buildLUT(); draw();
    });

    // Keyboard shortcuts ---------------------------------------
    /* window.addEventListener('keydown', (e) => {
       if (e.key === 'Delete' || e.key === 'Backspace'){
         if (state.selected!==-1 && state.points.length>2){
           state.points.splice(state.selected,1);
           state.selected=-1; buildLUT(); draw();
         }
       } else if (e.key==='r' || e.key==='R'){
         reset();
       } else if (e.key==='a' || e.key==='A'){
         autoTone();
       } else if (e.key==='g' || e.key==='G'){
         state.showGrid = !state.showGrid; syncButtons(); draw();
       } else if (e.key==='m' || e.key==='M'){
         state.monotone = !state.monotone; buildLUT(); syncButtons(); draw();
       }
     });

    // Buttons ---------------------------------------------------
    const qs = sel => document.querySelector(sel);
        qs('#resetBtn').onclick = reset;
        qs('#autoBtn').onclick = autoTone;
        qs('#gridBtn').onclick = () => { state.showGrid=!state.showGrid; syncButtons(); draw(); };
        qs('#monotoneBtn').onclick = () => { state.monotone=!state.monotone; buildLUT(); syncButtons(); draw(); };
    
        qs('#applyBtn').onclick = () => {
          const v = +qs('#inVal').value || 0;
          qs('#outVal').textContent = String(window.applyCurve(v));
        };
    
        qs('#exportBtn').onclick = () => {
          const arr = Array.from(state.lut);
          qs('#io').value = JSON.stringify(arr);
          navigator.clipboard && navigator.clipboard.writeText(qs('#io').value).catch(()=>{});
        };
        qs('#exportPtsBtn').onclick = () => {
          qs('#io').value = JSON.stringify(state.points);
          navigator.clipboard && navigator.clipboard.writeText(qs('#io').value).catch(()=>{});
        };
    
        qs('#importPtsBtn').onclick = () => {
          try {
            const pts = JSON.parse(qs('#io').value);
            if (!Array.isArray(pts) || pts.length<2) throw 0;
            window.setCurvePoints(pts);
          } catch { alert('Paste valid control points JSON (e.g., [{"x":0,"y":0},{"x":255,"y":255}])'); }
        };
    
        qs('#importLutBtn').onclick = () => {
          try {
            const arr = JSON.parse(qs('#io').value);
            if (!Array.isArray(arr) || arr.length!==256) throw 0;
            // Build minimal point set from LUT by sampling breakpoints (optional simplification)
            const pts = [{x:0,y:arr[0]}];
            for(let x=1;x<255;x++){
              // Detect slope change to create a control point budget-consciously
              const d0 = arr[x]-arr[x-1];
              const d1 = arr[x+1]-arr[x];
              if (d0!==d1) pts.push({x, y: clamp(0,255, arr[x]|0)});
            }
            pts.push({x:255,y:arr[255]});
            window.setCurvePoints(pts);
          } catch { alert('Paste valid LUT JSON (256 integers).'); }
        };
    
        function syncButtons(){
          qs('#gridBtn').textContent = `Grid: ${state.showGrid? 'on':'off'}`;
          qs('#monotoneBtn').textContent = `Monotone: ${state.monotone? 'on':'off'}`;
        }
    */
    // Presets ---------------------------------------------------
    function reset() {
        state.points = [{ x: 0, y: 0 }, { x: maxInValue, y: maxInValue }];
        state.selected = -1; buildLUT(); draw();
    }


    api.draw = draw;

    // Init ------------------------------------------------------
    reset();
    state.showGrid = true;
    buildLUT();
    draw();
    return api;
};