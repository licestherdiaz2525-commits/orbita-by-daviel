// Original visual reconstruction. Dimensions and the playback clock are illustrative.
export const vertexSource = `
attribute vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }
`;
export const fragmentSource = `
precision highp float;
uniform vec2 resolution;
uniform float seconds;
uniform vec3 camera; // azimuth, elevation and magnification in photographic space
uniform float contour;
uniform sampler2D earth;
uniform sampler2D terrain;
uniform sampler2D volume;
const float PI = 3.14159265;

float rand2(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
mat2 turn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

vec3 fromOrbit(vec2 screen) {
    float approach = smoothstep(1.4,8.8,seconds);
    float radius = (.365 + 3.8*approach*approach*approach)*pow(camera.z,.35);
    vec2 disk = screen/radius;
    float r = length(disk);
    vec2 starGrid = screen*235.0;
    float star = step(.984,rand2(floor(starGrid))) *
                 (1.0-smoothstep(.04,.35,length(fract(starGrid)-.5)));
    vec3 space = vec3(.018,.031,.052) + star*vec3(.62,.7,.8);
    float rim = exp(-max(0.0,r-1.0)*43.0);
    if(r>=1.0) return space+vec3(.10,.29,.49)*rim;
    vec3 local = vec3(disk,sqrt(max(0.0,1.0-dot(disk,disk))));
    float lat = radians(mix(12.0,33.7,approach))+(camera.y-.31)*.65;
    float lon = radians(mix(-65.0,-106.5,approach)) + camera.x*.65;
    float sn = sin(lat), cs = cos(lat);
    float latitude = asin(local.y*cs+local.z*sn);
    float longitude = lon+atan(local.x,local.z*cs-local.y*sn);
    vec2 uv = vec2(fract(longitude/(2.0*PI)+.5),.5-latitude/PI);
    vec3 albedo = texture2D(earth,uv).rgb;
    float incidence = dot(local,normalize(vec3(-.90,.49,.62)));
    float sunlight = .10+.99*smoothstep(-.23,.83,incidence);
    vec3 color = albedo*sunlight+vec3(.015,.036,.063);
    color += vec3(.16,.34,.50)*pow(1.0-local.z,3.1)*(.35+.65*sunlight);
    vec2 offset = vec2((longitude-radians(-106.5))*cos(latitude),latitude-radians(33.7));
    float dotSize=mix(.014,.0016,approach);
    float mark=1.0-smoothstep(dotSize,dotSize*1.8,length(offset));
    color=mix(color,vec3(1.0,.76,.40),mark*.92);
    return mix(space+vec3(.10,.29,.49),color,smoothstep(0.0,.006,1.0-r));
}

vec3 landData(vec2 xz) {
    return texture2D(terrain,clamp(xz/36.0+.5,vec2(.001),vec2(.999))).rgb;
}

vec3 skyColor(vec3 dir) {
    float h = max(.0,dir.y);
    float haze = exp(-h*5.6);
    vec3 horizon = mix(vec3(.68,.66,.68),vec3(.90,.75,.65),pow(max(0.0,dot(dir,normalize(vec3(-.7,.09,-.65)))),3.0));
    vec3 base = mix(vec3(.19,.31,.44),horizon,haze);
    vec2 uv = dir.xz/max(.09,h+.12)*.034 + vec2(.49,.42);
    float wisps = smoothstep(.59,.84,texture2D(terrain,fract(uv)).b);
    return mix(base,vec3(.77,.74,.73),wisps*.13*smoothstep(.01,.26,h));
}

float intersectLand(vec3 origin,vec3 ray) {
    if (ray.y>.37) return 80.0;
    float before=.0;
    float distance=.0;
    for (int i=0;i<100;i++) {
        vec3 pos = origin+ray*distance;
        if(max(abs(pos.x),abs(pos.z))>18.0) return 80.0;
        float gap=pos.y-landData(pos.xz).r*4.0;
        if(gap<.006) {
            float low=before,high=distance;
            for(int k=0;k<5;k++) {
                float mid=(low+high)*.5;
                vec3 q=origin+ray*mid;
                if(q.y>landData(q.xz).r*4.0) low=mid; else high=mid;
            }
            return (low+high)*.5;
        }
        before=distance;
        distance += clamp(gap*.50+.045,.12,.62);
        if(distance>34.0) break;
    }
    return 80.0;
}

vec3 surfaceColor(vec3 pos,float distance,vec3 ray,float heat) {
    vec3 data=landData(pos.xz);
    float sand=clamp((data.b-.20)*1.7,0.0,1.0);
    vec3 c=mix(vec3(.32,.30,.265),vec3(.72,.615,.472),sand);
    float grain=texture2D(terrain,fract(pos.xz*.23+vec2(.3,.5))).b;
    c *= (.59+.54*data.g)*(.91+.18*grain);
    float stripe=abs(fract(pos.y*7.3+.5)-.5);
    vec3 relief=mix(vec3(.13,.22,.23),vec3(.64,.66,.54),.66*data.g+.32*sand);
    relief *= 1.0-.29*smoothstep(.024,.085,data.r)*(1.0-smoothstep(.012,.06,stripe));
    c = mix(c,relief,contour);
    c += vec3(.45,.21,.055)*heat*exp(-.55*length(pos.xz));
    return mix(c,skyColor(ray),1.0-exp(-distance*.060));
}

// Depth slices have a one-texel guard, keeping adjacent slices apart under filtering.
vec2 tileUV(vec2 xy,float slice) {
    vec2 tile=vec2(mod(slice,12.0),floor(slice/12.0));
    return (tile*146.0+1.5+143.0*clamp(xy,0.0,1.0))/vec2(1752.0,1752.0);
}
vec3 sampleCloud(vec3 p) {
    float slice=clamp(p.z,0.0,1.0)*143.0;
    float k=floor(slice);
    return mix(texture2D(volume,tileUV(p.xy,k)).rgb,
               texture2D(volume,tileUV(p.xy,min(143.0,k+1.0))).rgb,fract(slice));
}
vec2 boxRange(vec3 o,vec3 v,vec3 lo,vec3 hi) {
    vec3 inv=1.0/(v+vec3(.000001));
    vec3 a=(lo-o)*inv,b=(hi-o)*inv;
    vec3 nearSide=min(a,b),farSide=max(a,b);
    return vec2(max(max(nearSide.x,nearSide.y),nearSide.z),min(min(farSide.x,farSide.y),farSide.z));
}
vec3 desert(vec2 screen) {
    float event=clamp((seconds-10.0)/34.0,0.0,1.0);
    float arrive=1.0-smoothstep(5.5,10.0,seconds);
    float focus=.24+(.92*smoothstep(.015,.65,event));
    float angle=camera.x+.32-.19*smoothstep(8.0,44.0,seconds);
    float elevation=clamp(camera.y-.12+.79*arrive,.04,1.48);
    vec3 target=vec3(.0,focus,.0);
    float distance=(5.6+8.2*arrive)/camera.z;
    vec3 offset=vec3(cos(elevation)*sin(angle),sin(elevation),cos(elevation)*cos(angle));
    vec3 eye=target+distance*offset;
    vec3 forward=-offset,right=normalize(cross(forward,vec3(0,1,0)));
    vec3 up=cross(right,forward);
    vec3 ray=normalize(forward+right*screen.x*.93+up*screen.y*.93);
    float heat=smoothstep(0.0,.048,event)*(1.0-smoothstep(.085,.39,event));
    float ground=intersectLand(eye,ray);
    vec3 background=skyColor(ray);
    if(ground<79.0) background=surfaceColor(eye+ray*ground,ground,ray,heat);
    background+=heat*vec3(.08,.046,.014)*exp(-2.2*length(screen));
    if(event<=.0001) return background;
    float spread=.075+1.28*pow(event,.67);
    float rise=.065+.99*(1.0-exp(-event*3.3));
    vec3 base=vec3(event*.145,.012,event*-.08);
    vec3 ext=vec3(spread,rise,spread);
    vec3 o=(eye-base)/ext,v=ray/ext;
    vec2 range=boxRange(o,v,vec3(-1.3,0,-1.3),vec3(1.3,2.6,1.3));
    range.x=max(0.0,range.x);
    range.y=min(ground,range.y);
    if(range.y<range.x) return background;
    float stepSize=(range.y-range.x)/64.0;
    float d=range.x+stepSize*.5;
    vec3 color=vec3(0.0);
    float transparent=1.0;
    for(int j=0;j<64;j++){
        vec3 local=o+v*d;
        float height=local.y/2.6;
        local.xz=turn(.14*sin(height*7.0-event*4.0)+event*.28)*local.xz;
        local.x+=.045*sin(6.5*height+event*4.0);
        vec3 uv=vec3(local.x/2.6+.5,height,local.z/2.6+.5);
        vec3 sampleValue=sampleCloud(uv);
        float edge=smoothstep(.0,.055,min(min(uv.x,1.0-uv.x),min(uv.z,1.0-uv.z)));
        float density=sampleValue.r*edge*smoothstep(.005,.074,event)*mix(smoothstep(.04,.27,event),1.0,smoothstep(.38,.66,height));
        float alpha=1.0-exp(-density*stepSize*8.0/max(.25,spread));
        float lighting=clamp(sampleValue.g*(.86+.20*sampleValue.b),0.0,1.0);
        vec3 shadow=mix(vec3(.21,.172,.165),vec3(.24,.223,.24),height);
        vec3 lit=mix(vec3(.76,.60,.47),vec3(1.0,.925,.80),height);
        vec3 pigment=mix(shadow,lit,lighting);
        pigment+=vec3(.72,.32,.058)*heat*(.15+.85*height);
        color+=transparent*alpha*pigment;
        transparent*=1.0-alpha;
        if(transparent<.018) break;
        d+=stepSize;
    }
    vec3 result=background*transparent+color;
    // A single softened glow marks the beginning of the historical sequence.
    vec3 glowCenter=base+vec3(.0,rise*1.91,.0);
    float along=dot(glowCenter-eye,ray);
    float fromCenter=length(eye+ray*along-glowCenter);
    float glowRadius=.045+.50*smoothstep(0.0,.24,event);
    float glow=exp(-fromCenter*fromCenter/(glowRadius*glowRadius))*heat;
    if(along>0.0 && along<ground) result=mix(result,vec3(1.0,.89,.63),glow*.86);
    return result;
}
void main(){
    vec2 screen=(gl_FragCoord.xy-.5*resolution)/resolution.y;
    float flight=smoothstep(6.65,8.85,seconds);
    vec3 col;
    if(flight<=0.0) col=fromOrbit(screen);
    else if(flight>=1.0) col=desert(screen);
    else col=mix(fromOrbit(screen),desert(screen),flight);
    col*=1.0-.11*smoothstep(.29,1.08,length(screen*vec2(.65,1.0)));
    gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}
`;
function compile(gl,type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(error);
    }
    return shader;
}
function loadImage(url){
    return new Promise((resolve,reject)=>{
        const image=new Image();
        image.onload=()=>resolve(image);
        image.onerror=()=>reject(new Error('Image unavailable: '+url));
        image.src=url;
    });
}
export async function buildRenderer(canvas) {
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
    if(!gl) throw new Error('WebGL unavailable');
    const program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragmentSource]]){
        const shader=compile(gl,type,source);
        gl.attachShader(program,shader);
        gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const corner=gl.getAttribLocation(program,'corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner,2,gl.FLOAT,false,0,0);
    const textureFiles=[['earth','tierra.jpg'],['terrain','trinity-relieve.png'],['volume','trinity-volumen.png']];
    const imgs=await Promise.all(textureFiles.map(([,file])=>loadImage(file)));
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    imgs.forEach((image,index)=>{
        const texture=gl.createTexture();
        gl.activeTexture(gl.TEXTURE0+index);
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
        gl.uniform1i(gl.getUniformLocation(program,textureFiles[index][0]),index);
    });
    const uniform=Object.fromEntries(['resolution','camera','seconds','contour'].map(key=>[key,gl.getUniformLocation(program,key)]));
    return ({seconds,yaw,pitch,zoom,relief,quality=1})=>{
        const ratio=Math.min(window.devicePixelRatio||1,1.45,1050/Math.max(1,canvas.clientWidth))*quality;
        const width=Math.max(1,Math.round(canvas.clientWidth*ratio)),height=Math.max(1,Math.round(canvas.clientHeight*ratio));
        if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
        gl.viewport(0,0,width,height);
        gl.uniform2f(uniform.resolution,width,height);
        gl.uniform3f(uniform.camera,yaw,pitch,zoom);
        gl.uniform1f(uniform.seconds,seconds);
        gl.uniform1f(uniform.contour,relief?1:0);
        gl.drawArrays(gl.TRIANGLES,0,3);
    };
}
