const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function makeCanvas() {
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        display: 'block', pointerEvents: 'none', background: 'transparent'
    });
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
}

function readTexture(image) {
    const texture = document.createElement('canvas');
    texture.width = image.naturalWidth;
    texture.height = image.naturalHeight;
    const paint = texture.getContext('2d', {willReadFrequently: true});
    paint.drawImage(image, 0, 0);
    const bitmap = paint.getImageData(0, 0, texture.width, texture.height);
    const rgb = bitmap.data;
    // Gently lift dark-blue water while preserving the texture's land and ice detail.
    for (let i = 0; i < rgb.length; i += 4) {
        const sea = clamp((rgb[i+2] - .8*rgb[i] - 7)/21, 0, 1) * clamp((92-rgb[i])/62, 0, 1);
        rgb[i] = rgb[i]*1.02 + 2*sea;
        rgb[i+1] = rgb[i+1]*1.025 + 9*sea;
        rgb[i+2] = rgb[i+2]*1.02 + 15*sea;
    }
    paint.putImageData(bitmap, 0, 0);
    return {canvas: texture, pixels: rgb, width: texture.width, height: texture.height};
}

const VERTEX = `
attribute vec2 vertex;
void main() {
    gl_Position = vec4(vertex, 0., 1.);
}`;

const FRAGMENT = `
precision highp float;
uniform sampler2D surface;
uniform vec2 center;
uniform vec2 tilt;
uniform float radius;
uniform float meridian;
const float pi = 3.14159265359;
void main() {
    vec2 xy = (gl_FragCoord.xy - center) / radius;
    float d = length(xy);
    float coverage = clamp((1. - d)*radius + .5, 0., 1.);
    if (coverage <= 0.) discard;
    float z = sqrt(max(0., 1. - d*d));
    float latitude = asin(clamp(xy.y*tilt.y + z*tilt.x, -1., 1.));
    float longitude = meridian + atan(xy.x, z*tilt.y - xy.y*tilt.x);
    vec2 uv = vec2(fract(.5 + longitude/(2.*pi)), .5 - latitude/pi);
    vec3 land = texture2D(surface, uv).rgb;
    float sun = max(0., dot(vec3(xy,z), vec3(-.46,.39,.80)));
    float light = .57 + .62*sun;
    float rim = pow(1. - z, 2.6)*(.45 + .55*sun);
    vec3 color = land*light + vec3(.075,.205,.33)*rim;
    gl_FragColor = vec4(color*coverage, coverage);
}`;

function gpuRenderer(canvas, texture) {
    const gl = canvas.getContext('webgl', {
        alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true
    });
    if (!gl) return null;
    function compile(type, code) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, code);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
        return shader;
    }
    const program = gl.createProgram();
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'vertex');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const earth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, earth);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (gl.getError() !== gl.NO_ERROR) return null;
    const center = gl.getUniformLocation(program, 'center');
    const tilt = gl.getUniformLocation(program, 'tilt');
    const radius = gl.getUniformLocation(program, 'radius');
    const meridian = gl.getUniformLocation(program, 'meridian');
    gl.uniform1i(gl.getUniformLocation(program, 'surface'), 0);
    return (view, area) => {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(center, area.cx*area.ratio, canvas.height-area.cy*area.ratio);
        gl.uniform1f(radius, area.radius*area.ratio);
        gl.uniform2f(tilt, Math.sin(view.latitude*RAD), Math.cos(view.latitude*RAD));
        gl.uniform1f(meridian, view.longitude*RAD);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
}

// Cache the sphere's orthographic projection. Horizontal rotation then only shifts
// the longitude sampled from each row. During a gesture a smaller bitmap keeps it responsive.
function makeBitmap(size, texture, detailed) {
    const ball = document.createElement('canvas');
    ball.width = ball.height = size;
    const paint = ball.getContext('2d');
    const image = paint.createImageData(size, size);
    const out = image.data, count = size*size;
    const rowStart = new Uint16Array(size), rowEnd = new Uint16Array(size);
    const depth = new Float32Array(count), lights = new Float32Array(count), rims = new Float32Array(count);
    const u = new Float32Array(count), textureRow = new Uint32Array(count), blendY = new Float32Array(count);
    const {width, height, pixels} = texture;
    const texStride = width*4, lastRow = (height-1)*texStride;
    const half = size/2;

    for (let y = 0; y < size; y++) {
        const ny = 1-(y+.5)/half;
        const span = Math.sqrt(Math.max(0,1-ny*ny))*half;
        rowStart[y] = Math.max(0,Math.floor(half-span));
        rowEnd[y] = Math.min(size,Math.ceil(half+span));
        for (let x = rowStart[y]; x < rowEnd[y]; x++) {
            const i = y*size+x, nx = (x+.5)/half-1;
            const squared = nx*nx+ny*ny;
            const z = depth[i] = Math.sqrt(Math.max(0,1-squared));
            const sun = Math.max(0,-.46*nx+.39*ny+.80*z);
            lights[i] = .57+.62*sun;
            rims[i] = (1-z)**2.6*(.45+.55*sun);
            out[i*4+3] = 255*clamp((1-Math.sqrt(squared))*half+.5,0,1);
        }
    }

    let lastLatitude = NaN, lastLongitude = NaN;
    function render(latitude, longitude) {
        if (lastLatitude===latitude && lastLongitude===longitude) return ball;
        if (lastLatitude!==latitude) {
            const sl = Math.sin(latitude*RAD), cl = Math.cos(latitude*RAD);
            for (let y=0; y<size; y++) {
                const ny = 1-(y+.5)/half;
                for (let x=rowStart[y]; x<rowEnd[y]; x++) {
                    const i = y*size+x, nx = (x+.5)/half-1, z = depth[i];
                    const lat = Math.asin(clamp(ny*cl+z*sl,-1,1));
                    const lon = Math.atan2(nx,z*cl-ny*sl);
                    u[i] = (.5+lon/TAU)*width-.5;
                    const v = clamp((.5-lat/Math.PI)*height-.5,0,height-1);
                    const row = Math.floor(v);
                    textureRow[i] = row*texStride;
                    blendY[i] = v-row;
                }
            }
            lastLatitude = latitude;
        }
        const shift = ((longitude%360)+360)%360/360*width;
        for (let y=0; y<size; y++) {
            const end = y*size+rowEnd[y];
            for (let i=y*size+rowStart[y]; i<end; i++) {
                let sample = u[i]+shift;
                if (sample >= width) sample -= width;
                if (sample < 0) sample += width;
                const x = Math.floor(sample), row = textureRow[i], left = row+x*4;
                const light = lights[i], rim = rims[i], dst = i*4;
                if (detailed) {
                    const right = x+1 < width ? left+4 : row;
                    const stride = row < lastRow ? texStride : 0;
                    const fx = sample-x, fy = blendY[i];
                    const a = (1-fx)*(1-fy), b = fx*(1-fy), c = (1-fx)*fy, d = fx*fy;
                    for (let k=0; k<3; k++) {
                        const color = pixels[left+k]*a+pixels[right+k]*b+pixels[left+stride+k]*c+pixels[right+stride+k]*d;
                        out[dst+k] = color*light + (k===0 ? 19 : k===1 ? 52 : 84)*rim;
                    }
                } else {
                    out[dst] = pixels[left]*light+19*rim;
                    out[dst+1] = pixels[left+1]*light+52*rim;
                    out[dst+2] = pixels[left+2]*light+84*rim;
                }
            }
        }
        paint.putImageData(image,0,0);
        lastLongitude = longitude;
        return ball;
    }
    return {size,render};
}

function softwareRenderer(canvas, texture) {
    const ctx = canvas.getContext('2d');
    const buffers = [];
    return (view,area) => {
        const {cx,cy,radius,ratio} = area;
        const moving = Boolean(view.interacting);
        const cap = moving ? 416 : 1088;
        const diameter = Math.min(cap, Math.max(128,Math.ceil(2*radius*(moving ? .72 : ratio)/64)*64));
        const slot = moving ? 0 : 1;
        if (buffers[slot]?.size!==diameter) buffers[slot] = makeBitmap(diameter,texture,!moving);
        const ball = buffers[slot].render(view.latitude,view.longitude);
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.setTransform(ratio,0,0,ratio,0,0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(ball,cx-radius,cy-radius,2*radius,2*radius);
    };
}

function graticule() {
    function curve(meridian, fixed) {
        const points = [];
        const edge = meridian ? 90 : 180;
        for (let a=-edge; a<=edge; a+=2) {
            const lat=(meridian?a:fixed)*RAD, lon=(meridian?fixed:a)*RAD, c=Math.cos(lat);
            points.push([c*Math.cos(lon),c*Math.sin(lon),Math.sin(lat)]);
        }
        return points;
    }
    const lines = [];
    for (let lon=-180; lon<180; lon+=30) lines.push(curve(true,lon));
    for (const lat of [-60,-30,30,60]) lines.push(curve(false,lat));
    return {lines,equator:curve(false,0)};
}

function drawOverlay(ctx, overlay, guides, view, area) {
    const {cx,cy,radius,ratio} = area;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,overlay.width,overlay.height);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const halo = ctx.createRadialGradient(cx,cy,radius*.955,cx,cy,radius*1.09);
    halo.addColorStop(0,'rgba(70,151,211,0)');
    halo.addColorStop(.29,'rgba(89,179,235,.17)');
    halo.addColorStop(.335,'rgba(107,186,236,.51)');
    halo.addColorStop(.43,'rgba(70,161,224,.17)');
    halo.addColorStop(.68,'rgba(50,125,200,.045)');
    halo.addColorStop(1,'rgba(34,106,182,0)');
    ctx.fillStyle=halo;
    ctx.beginPath();ctx.arc(cx,cy,radius*1.09,0,TAU);ctx.fill();
    if (!view.grid) return;
    const lat=view.latitude*RAD,lon=view.longitude*RAD,sl=Math.sin(lat),cl=Math.cos(lat),so=Math.sin(lon),co=Math.cos(lon);
    function trace(points) {
        let prevDepth=-1, prevX, prevY;
        for(const [gx,gy,gz] of points) {
            const forward=gx*co+gy*so, depth=forward*cl+gz*sl;
            const x=cx+radius*(-gx*so+gy*co),y=cy-radius*(gz*cl-forward*sl);
            if(prevX!==undefined && (prevDepth>=0)!==(depth>=0)) {
                const f=prevDepth/(prevDepth-depth);
                const hx=prevX+(x-prevX)*f,hy=prevY+(y-prevY)*f;
                if(depth>=0) ctx.moveTo(hx,hy); else ctx.lineTo(hx,hy);
            }
            if(depth>=0) {
                if(prevX===undefined) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            }
            prevX=x;prevY=y;prevDepth=depth;
        }
    }
    ctx.beginPath();
    guides.lines.forEach(trace);
    ctx.lineWidth=.85;
    ctx.strokeStyle='rgba(183,225,237,.54)';ctx.stroke();
    ctx.beginPath();trace(guides.equator);
    ctx.lineWidth=1.15;ctx.strokeStyle='rgba(255,181,108,.85)';ctx.stroke();
}

export function createEarthRenderer(host,onReady,onError) {
    let surface=makeCanvas();
    const overlay=makeCanvas(), overlayCtx=overlay.getContext('2d'), guides=graticule();
    host.prepend(surface,overlay);
    let painter, texture, lastView;
    function draw(view) {
        lastView=view;
        if (!painter) return;
        const w=host.clientWidth,h=host.clientHeight;
        if (w<2 || h<2) return;
        const ratio=Math.min(window.devicePixelRatio||1,2,2800/Math.max(w,h));
        const width=Math.round(w*ratio),height=Math.round(h*ratio);
        for(const layer of [surface,overlay]) {
            if (layer.width!==width) layer.width=width;
            if (layer.height!==height) layer.height=height;
        }
        const area={cx:w*.5+view.panX,cy:h*.5+view.panY,radius:.44*Math.min(w,h)*view.zoom,ratio};
        painter(view,area);
        drawOverlay(overlayCtx,overlay,guides,view,area);
    }
    function useSoftware() {
        const replacement=makeCanvas();
        surface.replaceWith(replacement);
        surface=replacement;
        painter=softwareRenderer(surface,texture);
    }
    const image=new Image();
    image.onload=()=>{
        try {
            texture=readTexture(image);
            try {painter=gpuRenderer(surface,texture);} catch {painter=null;}
            if(!painter) useSoftware();
            else surface.addEventListener('webglcontextlost',event=>{
                event.preventDefault();
                useSoftware();
                if(lastView) draw(lastView);
            },{once:true});
            if(lastView) draw(lastView);
            onReady?.();
        } catch(error) {onError?.(error);}
    };
    image.onerror=()=>onError?.(new Error('Earth texture could not be loaded'));
    image.src=new URL('./tierra.jpg',import.meta.url);
    return draw;
}
