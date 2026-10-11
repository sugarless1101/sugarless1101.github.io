// Browser-free byte estimates. Section proximity and transfer timing need a browser.
import {readFileSync,statSync} from 'node:fs';
const js=readFileSync('main.js','utf8');
const version=js.match(/const IMAGE_VERSION = '([\w.-]+)'/)[1];
const parts=JSON.parse(js.match(/const wirePartDefinitions\s*=\s*(\[.*?\]);/s)[1]);
const poses=['sparrow-perch-left','sparrow-perch-turn','sparrow-perch-tail','sparrow-takeoff','sparrow-flap-up','sparrow-flap-down'];
const item=path=>({url:path.startsWith('images/')?`${path}?v=${version}`:path,bytes:statSync(path).size});
const sum=items=>items.reduce((total,image)=>total+image.bytes,0);
const profiles=[];
for(const [device,width,height,dpr] of [['mobile',390,844,3],['desktop',1920,1080,1]])for(const mode of ['day','night']){
  const tall=device==='mobile',shape=tall?'tall':'wide',density=dpr>1?'-2x':'',night=mode==='night';
  const tile=Math.max(Math.max(150,Math.min(320,height*.26))*4800/900,width/1.92)*dpr;
  const cloudWidth=tile<=2400?2400:3600;
  const top=[
    `images/layers/sky-${night?'night':'summer'}-${shape}.webp`,
    ...['haze','far','mid','near'].map(depth=>`images/layers/clouds-${depth}${night?'-night':''}-${cloudWidth}.webp`),
    `images/layers/lamp-${shape}${night?'-night':''}${density}${night?'':'-dim'}.webp`,
    ...night?[]:[`images/layers/lamp-${shape}${density}-glow.webp`],
    'images/moon-day.webp',`images/layers/lamp-glass-mask-${shape}${density}.webp`,'icon.webp'
  ].map(item);
  const approachingProjects=[
    `images/fixtures/pole${night?'-night':''}.webp`,
    ...parts.map(part=>`images/fixtures/wire-parts/${part.name}${night?'-night':''}.webp`),
    ...poses.map(pose=>`images/fixtures/birds/${pose}${density}.webp`),
    `images/layers/sky-${night?'night':'summer'}-tall-384.webp`,
    ...night?['images/layers/sky-night-grain.webp']:[]
  ].map(item);
  const idleOff=item(`images/layers/lamp-${shape}${night?'-night':''}${density}-off.webp`);
  profiles.push({device,viewport:{width,height,dpr},mode,top,approachingProjects,idleOff,
    topImageBytes:sum(top),withApproachingProjectsImageBytes:sum([...top,...approachingProjects]),
    first15SecondsImageBytes:sum([...top,...approachingProjects,idleOff])});
}
console.log(JSON.stringify({imageVersion:version,scope:'File sizes only; includes projects if within 1.5 viewports. Excludes HTML/CSS/JS/fonts/headers and user interactions.',profiles},null,2));
