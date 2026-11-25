const W = 960, H = 540;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function ease(start, end, time) {
    const n = clamp((time-start)/(end-start),0,1);
    return n*n*(3-2*n);
}

// All paths are fixed visual choreography in the coordinates of the illustrated street.
function particles() {
    let seed = 9180;
    const random = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
    const fragments = Array.from({length:42}, (_,i) => {
        const x = 140+random()*590;
        return {x, y:380+x*.15+random()*34, drift:(random()-.55)*100,
            fall:85+random()*192, start:4.21+Math.pow(random(),1.65)*4.7,
            span:.42+random()*.62, size:1+random()*3.1, angle:random()*6,
            color:['#9b735e','#b2a08f','#8c7f70','#a4b6b7','#c5c7ba'][i%5]};
    });
    const motes = Array.from({length:57}, () => {
        const x = 122+random()*640;
        return {x, y:363+x*.135+random()*51, drift:8+random()*38,
            start:8+random()*8, span:4+random()*7, size:2+random()*1.4,
            wave:random()*5, height:60+random()*105};
    });
    return {fragments, motes};
}
function drawFragments(ctx, pieces, time) {
    for (const p of pieces) {
        const age = (time-p.start)/p.span;
        if (age < 0) continue;
        const descent = Math.min(1,age);
        const bounce = Math.max(0,age-1);
        const leap = bounce < 1.35 ? Math.abs(Math.sin(bounce*Math.PI*2.4))*Math.exp(-bounce*4.2)*p.fall*.18 : 0;
        const x = p.x - p.drift*(1-descent) + Math.min(bounce,1)*p.drift*.07;
        const y = p.y - p.fall*(1-descent*descent) - leap;
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(p.angle+Math.min(1.7,age)*4.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();ctx.moveTo(-p.size,-p.size*.25);
        ctx.lineTo(p.size*.58,-p.size*.63);ctx.lineTo(p.size*.92,p.size*.18);
        ctx.lineTo(-p.size*.50,p.size*.54);ctx.closePath();ctx.fill();
        ctx.restore();
    }
}
function drawMaterial(ctx, motes, time) {
    if (time < 8) return;
    ctx.lineWidth = 1.5;
    for (const p of motes) {
        if (time < p.start) continue;
        const progress = clamp((time-p.start)/p.span,0,1);
        const y = p.y - (1-progress)*p.height;
        const x = p.x + (1-progress)*(p.drift + Math.sin(progress*5+p.wave)*9);
        ctx.globalAlpha = Math.min(.9, (time-p.start)*1.6);
        ctx.beginPath();
        if (progress < 1) {
            ctx.arc(x,y,p.size,0,Math.PI*2);
            ctx.strokeStyle = '#39214c';ctx.lineWidth = 3.5;ctx.stroke();
            ctx.strokeStyle = '#edd3ff';ctx.lineWidth = 1.4;ctx.stroke();
        } else {
            ctx.moveTo(x,y-2.4);ctx.lineTo(x+4.2,y);ctx.lineTo(x,y+2.1);ctx.lineTo(x-4.2,y);ctx.closePath();
            ctx.fillStyle = '#ddb4f0';ctx.fill();ctx.strokeStyle = '#573d65';ctx.lineWidth = 1;ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
}
function drawDust(ctx,time) {
    const level = ease(4.12,6.2,time)*(1-ease(10.3,19.5,time));
    if (level === 0) return;
    for(let i=0;i<5;i++) {
        const x = 86+i*90+(time-4)*(3+i);
        const y = 325+Math.sin(i*2.3+(time-4)*.15)*20;
        const r = 47+i*11;
        const haze = ctx.createRadialGradient(x,y,0,x,y,r);
        haze.addColorStop(0,`rgba(202,186,161,${.13*level})`);
        haze.addColorStop(1,'rgba(192,176,155,0)');
        ctx.fillStyle = haze;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
}
function drawWalker(ctx, atlas, time) {
    if (!atlas.complete || !atlas.naturalWidth || time > 15.5) return;
    const walk = Math.min(time,4) + Math.max(0,time-5.2);
    const x = 25+walk*57.8;
    const enter = ease(12.6,15.5,time);
    const fade = 1-ease(14.67,15.48,time);
    const step = Math.floor(walk*6.5)%4;
    const y = 388+.115*x-36*enter;
    const height = 125+.072*x-15*enter;
    const width = height*152/208;
    ctx.save();
    ctx.globalAlpha = .18*fade;
    ctx.fillStyle = '#2c2b25';
    ctx.beginPath();ctx.ellipse(x-4,y,width*.28,height*.016,-.10,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha = fade;
    ctx.drawImage(atlas,step*152,0,152,208,x-width/2,y-height*205/208+Math.sin(step*Math.PI/2)*.85,width,height);
    ctx.restore();
}

export function makeStreetFilm(canvas, poster, invalidate) {
    const ctx = canvas.getContext('2d');
    const {fragments, motes} = particles();
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const files = ['calle-antes.webp','calle-refugio.webp','calle-despues.webp','calle-pasos.webp'];
    const images = files.map(src => {
        const image = new Image();
        image.onload = invalidate;
        image.src = src;return image;
    });
    const ready = im => im.complete && im.naturalWidth;
    function paint(time, layer, camera) {
        if (!ctx || !ready(images[0])) return;
        const scale = Math.min(2,window.devicePixelRatio||1,1600/Math.max(1,canvas.clientWidth));
        const w = Math.max(1,Math.round(canvas.clientWidth*scale));
        const h = Math.max(1,Math.round(canvas.clientHeight*scale));
        if (canvas.width!==w || canvas.height!==h) {canvas.width=w;canvas.height=h;}
        const motion = !media.matches;
        const zoom = camera.near ? 1.48 : 1+(motion ? .018*ease(0,17,time) : 0);
        const centreX = camera.near ? clamp(camera.x,.5/zoom,1-.5/zoom) : .5;
        const centreY = camera.near ? clamp(camera.y,.5/zoom,1-.5/zoom) : .5;
        ctx.setTransform(w*zoom/W,0,0,h*zoom/H,w*(.5-centreX*zoom),h*(.5-centreY*zoom));
        ctx.globalAlpha=1;ctx.drawImage(images[0],0,0,W,H);
        const next = ease(4.8,5.55,time), last = ease(15.65,16.65,time);
        if (next>0 && ready(images[1])) {ctx.globalAlpha=next;ctx.drawImage(images[1],0,0,W,H);}
        if (last>0 && ready(images[2])) {ctx.globalAlpha=last;ctx.drawImage(images[2],0,0,W,H);}
        ctx.globalAlpha=1;
        drawWalker(ctx,images[3],time);
        if (motion) drawDust(ctx,time);
        drawFragments(ctx,fragments,time);
        const glow = motion && time >= 4 && time < 4.85 ? .19*(1-ease(4,4.85,time)) : 0;
        if (glow) {ctx.fillStyle=`rgba(255,231,185,${glow})`;ctx.fillRect(0,0,W,H);}
        if (layer) drawMaterial(ctx,motes,time);
        poster.hidden=true;
    }
    return paint;
}
