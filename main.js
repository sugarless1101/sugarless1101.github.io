(() => {
  'use strict';
  const IMAGE_VERSION = '24'; // node tools/version-images.mjs syncs HTML/CSS.
  const root = document.documentElement;
  // Build content-dependent UI before text splitting and interaction registration.
  function buildWorkNavigation() {
    const works=[...document.querySelectorAll('li.work')];
    const full=document.querySelector('.wire-toc-full');
    const compact=document.querySelector('.wire-toc-compact textPath');
    const ns='http://www.w3.org/2000/svg';
    full.replaceChildren();
    works.forEach((work,i)=>{
      const number=String(i+1).padStart(2,'0');
      if(!work.id){
        const base=`work-${number}`;let id=base,suffix=2;
        while(document.getElementById(id))id=`${base}-${suffix++}`;
        work.id=id;
      }
      let marker=work.querySelector('.work-number');
      if(!marker){marker=document.createElement('span');marker.className='work-number';work.prepend(marker);}
      marker.textContent=number;marker.setAttribute('aria-hidden','true');
      const heading=work.querySelector('h3').cloneNode(true);
      heading.querySelectorAll('svg,.outward,[aria-hidden="true"]').forEach(node=>node.remove());
      const title=heading.textContent.replace(/\s+/g,' ').trim();
      const link=document.createElementNS(ns,'a');
      link.setAttribute('href',`#${work.id}`);link.setAttribute('aria-label',`${title}へ`);link.setAttribute('tabindex','0');
      const text=document.createElementNS(ns,'text'),path=document.createElementNS(ns,'textPath');
      text.setAttribute('dy','-7');path.setAttribute('href','#wire-toc-path');
      const label=document.createElementNS(ns,'tspan');label.textContent=title;path.append(label);
      if(i<works.length-1){const separator=document.createElementNS(ns,'tspan');separator.setAttribute('aria-hidden','true');separator.textContent=' · ';path.append(separator);}
      text.append(path);link.append(text);full.append(link);
    });
    compact.textContent=`制作 · ${works.length} works`;
  }
  buildWorkNavigation();
  document.querySelectorAll('.work .phrase,.appearance .phrase,.event-copy .phrase,.links .phrase').forEach(node=>{
    if(/^[\x20-\x7e]+$/.test(node.textContent))node.classList.add('breakable-token');
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const coarse = matchMedia('(pointer: coarse)');
  const portrait = matchMedia('(max-aspect-ratio: 4/5), (max-width: 720px) and (orientation: portrait)');
  const hero = document.querySelector('#top'), closing = document.querySelector('.closing');
  // The page background and theme-color color Safari's bars and the space past the page (see style.css).
  const chromeTints=[
    {className:'chrome-top',owner:hero,bottom:false,shown:null},
    {className:'chrome-bottom',owner:closing,bottom:true,shown:null}
  ];
  const themeColor=document.querySelector('meta[name="theme-color"]');
  const sectionIds = ['profile', 'projects', 'talks', 'timeline', 'links'];
  const sections = sectionIds.map(id => document.getElementById(id));
  const guide = document.querySelector('.section-guide'), guideLinks = [...guide.querySelectorAll('a')];
  const location = document.querySelector('.location-name');
  const owners = [hero, ...sections, closing], inView = new Set(), animations = new Set();
  const photos = [], lamps = [], liveTrails = [], windowTrails = [];
  // URL assignment and decoding live outside the animation loop. Loaded scenes
  // remain resident for return-to-top and reverse scrolling (v22d).
  const sceneAssets=new Map(),exposureAssets=new WeakMap(),exposureMates=new WeakMap();
  const backgroundDecodes=new Map(),decodedBackgrounds=new Set();
  const nearbyScenes=new Set([hero]),preparedModes=new Set();
  let sceneAssetsStarted=false,assetObserver=null,assetMargin=0,heroCloudPixels=4800;
  function assetOwner(node){return node.closest('.opening,.closing,section')||hero;}
  function selectedAsset(node){
    if(node.dataset.background){
      if(node.closest('.finale-sky')){
        const night=node.classList.contains('mode-night'),width=innerWidth*(devicePixelRatio||1);
        if(portrait.matches)return night?`images/sky-night-1200.webp?v=${IMAGE_VERSION}`:`images/sky-summer-1200.webp?v=${IMAGE_VERSION}`;
        if(night&&width<=2560)return `images/sky-night-2560.webp?v=${IMAGE_VERSION}`;
        if(width>2560)return night?`images/sky-night-5120.webp?v=${IMAGE_VERSION}`:`images/sky-summer-5120.webp?v=${IMAGE_VERSION}`;
      }
      const cloud=node.closest('.hero-clouds,.window-cloud');
      if(cloud){
        const width=Number(cloud.dataset.assetWidth)||heroCloudPixels;
        if(width<=3600)return node.dataset.background.replace('.webp',width<=2400?'-2400.webp':'-3600.webp');
      }
      return node.dataset.background;
    }
    if(node.dataset.mask)return node.dataset.mask;
    if(node.dataset.href)return node.dataset.href;
    if(node.classList.contains('window-sky'))return node.classList.contains('mode-night')?`images/layers/sky-night-tall-384.webp?v=${IMAGE_VERSION}`:`images/layers/sky-summer-tall-384.webp?v=${IMAGE_VERSION}`;
    const picture=node.closest('picture'),source=portrait.matches?picture?.querySelector('source'):null;
    const set=source?.dataset.srcset||node.dataset.srcset;
    if(!set)return node.dataset.src;
    const candidates=set.split(',').map(part=>{const [url,size='1x']=part.trim().split(/\s+/);return {url,size:parseFloat(size),width:size.endsWith('w')};});
    const target=candidates[0].width?Math.min(innerWidth,2000)*(devicePixelRatio||1):Math.min(devicePixelRatio||1,2);
    return (candidates.find(candidate=>candidate.size>=target)||candidates.at(-1)).url;
  }
  function assetAllowed(asset,mode){return (!asset.mode||asset.mode===mode)&&(!asset.off||offLampWanted);}
  function registerAsset(node){
    if(sceneAssets.has(node))return sceneAssets.get(node);
    const exposure=node.closest('.mode-day,.mode-night');
    const asset={node,owner:assetOwner(node),mode:node.dataset.assetMode||(exposure?.classList.contains('mode-night')?'night':exposure?'day':null),off:!!node.closest('.lamp-off'),ready:false,url:'',pending:null};
    sceneAssets.set(node,asset);
    if(exposure){
      const records=exposureAssets.get(exposure)||[];records.push(asset);exposureAssets.set(exposure,records);
      const opposite=exposure.classList.contains('mode-night')?'mode-day':'mode-night';
      const mate=[...exposure.parentElement.children].find(child=>child.tagName===exposure.tagName&&child.classList.contains(opposite)&&child.classList.contains('lamp-off')===exposure.classList.contains('lamp-off'));
      if(mate&&!exposureMates.has(exposure)){exposureMates.set(exposure,mate);exposureMates.set(mate,exposure);}
    }
    return asset;
  }
  function collectSceneAssets(scope){
    scope.querySelectorAll('img[data-src],image[data-href],[data-background],[data-mask]').forEach(registerAsset);
    if(sceneAssetsStarted)loadNearbyAssets();
  }
  function exposureReady(node){
    const records=exposureAssets.get(node);
    return !records||records.every(asset=>asset.ready);
  }
  function assetOpacity(node,value){
    if(!exposureReady(node))return 0;
    const mate=exposureMates.get(node);
    // After the 1.2s deadline, keep the old photograph until its mate decodes.
    return mate&&!exposureReady(mate)&&node.classList.contains(nightMode()?'mode-day':'mode-night')?1:value;
  }
  async function loadAsset(asset){
    const {node}=asset,url=selectedAsset(node);if(!url)return;
    if(asset.url===url&&asset.pending)return asset.pending;
    asset.url=url;
    asset.pending=(async()=>{
      try{
        if(node.matches('img')){
          node.loading='eager';node.src=url;
          await node.decode();
        }else{
          if(!decodedBackgrounds.has(url)){
            if(!backgroundDecodes.has(url)){
              const image=new Image();image.decoding='async';image.src=url;
              const ready=image.decode().then(()=>decodedBackgrounds.add(url)).catch(error=>{backgroundDecodes.delete(url);throw error;});
              backgroundDecodes.set(url,ready);
            }
            await backgroundDecodes.get(url);
          }
          if(asset.url!==url)return;
          if(node.dataset.mask)node.style.maskImage=`url("${url}")`;
          else if(node.dataset.href)node.setAttribute('href',url);
          else if(node.classList.contains('window-grain'))node.style.setProperty('--grain-image',`url("${url}")`);
          else node.style.backgroundImage=`url("${url}")`;
        }
        if(asset.url!==url)return;
        asset.ready=true;lastMix=-1;paintMode();
        if(node.closest('.cloud-top'))queueGeometry();
        if(reduced.matches)scheduleSteadyPaint();
      }catch{
        // Keep the existing exposure on a failed request; allow a later retry.
        if(asset.url===url){asset.url='';asset.pending=null;}
      }
    })();
    return asset.pending;
  }
  function refreshAsset(node){
    const asset=sceneAssets.get(node);if(!asset)return;
    if(nearbyScenes.has(asset.owner)&&assetAllowed(asset,root.dataset.mode))loadAsset(asset);
  }
  function loadSceneAssets(owner,mode,{off=false}={}){
    const jobs=[];
    sceneAssets.forEach(asset=>{
      if(asset.owner===owner&&asset.node.isConnected&&assetAllowed(asset,mode)&&(!asset.off||off))jobs.push(loadAsset(asset));
    });
    return Promise.all(jobs);
  }
  function loadNearbyAssets(){
    sceneAssets.forEach((asset,node)=>{if(!node.isConnected)sceneAssets.delete(node);});
    nearbyScenes.forEach(owner=>{
      loadSceneAssets(owner,root.dataset.mode,{off:offLampWanted});
      preparedModes.forEach(mode=>loadSceneAssets(owner,mode,{off:offLampWanted}));
    });
  }
  function preloadMode(mode=nightMode()?'day':'night',visibleOnly=false){
    preparedModes.add(mode);
    const jobs=[];
    nearbyScenes.forEach(owner=>{
      const box=geometry.get(owner),visible=box&&box.top<scrollY+innerHeight&&box.top+box.height>scrollY;
      const job=loadSceneAssets(owner,mode,{off:offLampWanted});
      if(!visibleOnly||visible)jobs.push(job);
    });
    return Promise.all(jobs);
  }
  function refreshAssetObserver(){
    if(!sceneAssetsStarted)return;
    const margin=Math.ceil(innerHeight*1.5);
    if(margin!==assetMargin){
      assetMargin=margin;assetObserver?.disconnect();
      assetObserver=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{if(entry.isIntersecting)nearbyScenes.add(entry.target);else nearbyScenes.delete(entry.target);});
        loadNearbyAssets();
      },{rootMargin:`${margin}px 0px`});
      [hero,...sections,closing].forEach(owner=>assetObserver.observe(owner));
    }
    // Cached positions cover restored scroll/hash entry before observer delivery.
    [hero,...sections,closing].forEach(owner=>{
      const box=geometry.get(owner);if(!box)return;
      if(box.top<scrollY+innerHeight+margin&&box.top+box.height>scrollY-margin)nearbyScenes.add(owner);
      else nearbyScenes.delete(owner);
    });
    loadNearbyAssets();
  }
  function startSceneAssets(){
    collectSceneAssets(document);sceneAssetsStarted=true;refreshAssetObserver();
    if(!lampControl.on)preloadOffLamp();
  }
  const splitPairs=[];
  const randomBetween = (a,b) => a + Math.random() * (b-a);
  const clamp = v => Math.max(0,Math.min(1,v));
  const smoothStep = v => {const p=clamp(v);return p*p*(3-2*p);};
  // One shared air mass; v22c can apply windStrength() to its final span too.
  const windState={elapsed:0,started:-100,next:randomBetween(20,40),duration:6,strength:0};
  function windStrength(){return reduced.matches?0:windState.strength;}
  function beginWind(duration=randomBetween(5,8)){
    if(reduced.matches||document.hidden)return false;
    windState.started=windState.elapsed;windState.duration=Math.max(5,Math.min(8,duration));
    windState.next=windState.elapsed+randomBetween(20,40);return true;
  }
  function stepWind(delta){
    if(![hero,closing,wireFixture].some(node=>inView.has(node)))return;
    windState.elapsed+=delta;
    if(windState.elapsed>=windState.next)beginWind();
    const age=windState.elapsed-windState.started;
    windState.strength=age>=0&&age<windState.duration?
      smoothStep(age/1.2)*smoothStep((windState.duration-age)/1.6):0;
  }
  let menuOpen=false;
  const movingSurfaces=new Set();
  function composite(node,property,changed){
    if(node.closest('.top-dormant,.finale-dormant')){
      node._movingAt={};node.style.willChange='';movingSurfaces.delete(node);return;
    }
    node._movingAt??={};
    if(node.classList.contains('hero-clouds')&&!reduced.matches)node._movingAt.transform=time;
    if(changed&&!reduced.matches){node._movingAt[property]=time;movingSurfaces.add(node);}
    if(reduced.matches)node._movingAt={};
    const next=Object.keys(node._movingAt).join(', ');
    if(node.style.willChange!==next)node.style.willChange=next;
  }
  function releaseStillSurfaces(){
    movingSurfaces.forEach(node=>{
      for(const property of Object.keys(node._movingAt))if(reduced.matches||time-node._movingAt[property]>.25)delete node._movingAt[property];
      node.style.willChange=Object.keys(node._movingAt).join(', ');
      if(!node.style.willChange)movingSurfaces.delete(node);
    });
  }
  // Never inherit a continuously changing paint value through a scene or root.
  function opacity(node,value,hide=true) {
    const next=String(Math.max(0,Math.min(1,value)));
    composite(node,'opacity',node.style.opacity!==next);
    if(node.style.opacity!==next)node.style.opacity=next;
    if(hide){
      const dormant=Number(next)===0;
      node.style.visibility=dormant?'hidden':'visible';node.classList.toggle('is-dormant',dormant);
      if(dormant){node._movingAt={};node.style.willChange='';movingSurfaces.delete(node);}
    }
  }
  function transform(node,value) {
    composite(node,'transform',node.style.transform!==value&&value!=='none');
    if(node.style.transform!==value)node.style.transform=value;
  }
  function translate(node,x,y) {
    transform(node,`translate(${x.toFixed(3)}px,${y.toFixed(3)}px)`);
  }
  const easeOut = 'cubic-bezier(.16,1,.3,1)';
  const computed = getComputedStyle(root);
  // Computed declarations are live: even a cached declaration can force a
  // style flush when read after the animation frame's writes.
  const ledColor = computed.getPropertyValue('--lamp-white').trim()||'#EAFBFF';
  const durations = Object.fromEntries(Object.entries({focus:640,hunt:900,on:420,off:300}).map(([key,fallback])=>
    [key,parseFloat(computed.getPropertyValue?.(`--motion-${key}`))||fallback]));
  let time=0, lastFrame=null, realFrameDelta=0, frame=null, layoutFrame=null, steadyFrame=null, geometry=new Map(), motionReady=false;
  let activeSection=-1, heroGeometry, finaleGeometry;
  let guideTarget=0,guidePosition=0;
  let pointer={x:0,y:0}, easedPointer={x:0,y:0};
  let nextShade=randomBetween(30,60), shadeStart=-100, nextHunt=6, nextLink=randomBetween(7,12);
  const trailOwners = [{node:hero,elapsed:0,next:randomBetween(14,22),trails:0},{node:closing,elapsed:0,next:randomBetween(18,30),trails:0}];
  const pointerVelocity={x:0,y:0};
  function stepPointer(delta){
    // Exact critically damped response (zeta=1, f=1.2Hz), independent of FPS.
    if(reduced.matches||(!inView.has(hero)&&!inView.has(closing)))return;
    if(nightMode()){
      easedPointer.x+=(pointer.x-easedPointer.x)*.06;easedPointer.y+=(pointer.y-easedPointer.y)*.06;
      pointerVelocity.x=pointerVelocity.y=0;return;
    }
    const omega=2*Math.PI*1.2,decay=Math.exp(-omega*delta);
    for(const axis of ['x','y']){
      const error=easedPointer[axis]-pointer[axis],b=pointerVelocity[axis]+omega*error;
      easedPointer[axis]=pointer[axis]+(error+b*delta)*decay;
      pointerVelocity[axis]=(pointerVelocity[axis]-omega*b*delta)*decay;
    }
  }

  // Rationale §7/§9: damped oscillators, no CSS fixture rotation or scaling.
  class Spring {
    constructor(f, zeta, limit) {
      this.f=f;this.zeta=zeta;this.limit=limit;this.omega=2*Math.PI*f;
      this.x=0;this.v=0;this.remainder=0;
    }
    impulse(v) {
      if(reduced.matches)return;
      const proposed=this.v+v,a=this.zeta*this.omega,b=this.omega*Math.sqrt(1-this.zeta**2);
      const peak=velocity=>{
        const A=this.x,B=(velocity+a*A)/b,phase=Math.atan2(B,A),theta=-Math.atan(a/b);
        const t=(phase+theta+Math.max(0,Math.ceil(-(phase+theta)/Math.PI))*Math.PI)/b;
        return Math.max(Math.abs(A),Math.hypot(A,B)*Math.exp(-a*t)*Math.abs(Math.cos(theta)));
      };
      // Bound the predicted first physical peak, rather than cutting off position.
      if(peak(proposed)<=this.limit*.995){this.v=proposed;return;}
      let lo=0,hi=1;
      for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(peak(proposed*mid)>this.limit*.995)hi=mid;else lo=mid;}
      this.v=proposed*lo;
    }
    step(dt,force=0) {
      if(reduced.matches||document.hidden)return;
      this.remainder+=dt;
      const h=1/120;
      while(this.remainder>=h){
        this.v+=(-(this.omega**2)*this.x-2*this.zeta*this.omega*this.v+force)*h;
        this.x+=this.v*h;this.remainder-=h;
      }
    }
    reset(){this.x=this.v=this.remainder=0;}
  }

  function layerPicture(stem, className, highResolution=false) {
    const node=document.createElement('div'); node.className=`hero-layer photo-life ${className}`;
    const picture=document.createElement('picture');
    const source=document.createElement('source'); source.media=portrait.media;
    source.dataset.srcset=`images/layers/${stem}-tall.webp?v=${IMAGE_VERSION}${highResolution ? ` 1x, images/layers/${stem}-tall-2x.webp?v=${IMAGE_VERSION} 2x` : ''}`;
    const img=document.createElement('img'); img.alt=''; img.width=2400; img.height=1350; img.decoding='async'; img.fetchPriority='high';
    if(highResolution) img.dataset.srcset=`images/layers/${stem}-wide.webp?v=${IMAGE_VERSION} 1x, images/layers/${stem}-wide-2x.webp?v=${IMAGE_VERSION} 2x`;
    img.dataset.src=`images/layers/${stem}-wide.webp?v=${IMAGE_VERSION}`; picture.append(source,img); node.append(picture); return node;
  }
  const sky=layerPicture('sky-summer','hero-sky'), lamp=layerPicture('lamp','hero-lamp',true);
  const cloudLayers=['haze','far','mid','near'].map(depth=>{
    const node=document.createElement('div'); node.className=`hero-clouds hero-clouds-${depth} photo-life`;
    node.dataset.background=`images/layers/clouds-${depth}.webp?v=${IMAGE_VERSION}`; return node;
  });
  const glow=document.createElement('div'); glow.className='lantern-light';
  glow.innerHTML='<span class="lantern-glass"></span><span class="lantern-glow"></span><span class="lantern-halo"></span>';
  const bloom=glow.querySelector('.lantern-glow'),halo=glow.querySelector('.lantern-halo');
  const lampButton=document.createElement('button');lampButton.className='lamp-switch';lampButton.type='button';
  let lampOn=true;try{lampOn=sessionStorage.getItem('portfolio-lamp')!=='off';}catch{/* Storage is optional. */}
  lampButton.setAttribute('aria-label',lampOn?'電灯を消す':'電灯を点ける');
  lampButton.innerHTML='<svg aria-hidden="true"><polygon /></svg>';
  const lampControl={on:lampOn,changedAt:-100,from:lampOn?1:0,gate:lampOn?1:0,afterglow:0,lastIgnition:-100,blink:false};
  const morseCode=['....','.','.-..','.-..','---'];
  const morseSegments=[{start:0,end:.25,level:.5}];let morseDuration=.25;
  morseCode.forEach((letter,i)=>[...letter].forEach((symbol,j)=>{
    const duration=symbol==='.'?.25:.75;
    morseSegments.push({start:morseDuration,end:morseDuration+duration,level:1,symbol,letter:i});morseDuration+=duration;
    if(j<letter.length-1||i<morseCode.length-1){const gap=j<letter.length-1?.25:.75;
      morseSegments.push({start:morseDuration,end:morseDuration+gap,level:.5});morseDuration+=gap;}
  }));
  morseSegments.push({start:morseDuration,end:morseDuration+.25,level:.5});morseDuration+=.25;
  morseSegments.push({start:morseDuration,end:morseDuration+.06,level:1});morseDuration+=.06;
  const morseState={started:-100,active:false,next:randomBetween(60,120),multiplier:1};
  function topGlassVisible(){
    const box=lampControl.geometry,base=geometry.get(hero);if(!box||!base||!inView.has(hero))return false;
    const photo=photos.find(p=>p.node===lamp),left=box.x+(photo?.x||0),top=base.top+box.y+(photo?.y||0)-scrollY;
    return left+box.width>0&&left<innerWidth&&top+box.height>0&&top<Math.min(innerHeight,base.top+base.height-scrollY);
  }
  function startMorse(){
    if(!lampControl.on||reduced.matches||document.hidden||!topGlassVisible()||topLamp.localTime-lampControl.lastIgnition<1.8||topLamp.localTime-topLamp.dayBurstAt<1.2||morseState.active)return false;
    morseState.started=topLamp.localTime;morseState.active=true;
    topLamp.nextDayBurst=Math.max(topLamp.nextDayBurst,topLamp.localTime+morseDuration+1.8);
    morseState.next=topLamp.localTime+randomBetween(60,120);return true;
  }
  function morseLevel(age){
    if(age<0||age>=morseDuration)return 1;
    const index=morseSegments.findIndex(segment=>age<segment.end),segment=morseSegments[index];
    const from=index?morseSegments[index-1].level:1;
    return from+(segment.level-from)*smoothStep((age-segment.start)/.06);
  }
  // Compose I(t), the switch and HELLO before the sole light-layer writer.
  function composeTopLight(s,mix){
    const age=s.localTime-lampControl.changedAt;
    if(reduced.matches){lampControl.gate=lampControl.on?1:0;lampControl.afterglow=0;morseState.active=false;morseState.multiplier=1;}
    else {
      if(lampControl.on){
        const ramp=smoothStep(age/(lampControl.blink?.12:.3));
        // Two failed strikes and the final ignition: at most three flashes.
        const dip=lampControl.blink&&age>=0&&age<.8?
          1-.7*(smoothStep((age-.15)/.05)-smoothStep((age-.31)/.06)+smoothStep((age-.47)/.05)-smoothStep((age-.63)/.07)):1;
        lampControl.gate=(lampControl.from+(1-lampControl.from)*ramp)*dip;lampControl.afterglow=0;
      }else{
        lampControl.gate=lampControl.from*(1-smoothStep(age/.3));
        lampControl.afterglow=age>=.3?.055*lampControl.from*Math.exp(-(age-.3)/.22):0;
        if(age>1.5)lampControl.afterglow=0;
      }
      if(!lampControl.on)morseState.active=false;
      if(lampControl.on&&s.localTime>=morseState.next&&!morseState.active)startMorse();
      const morseAge=s.localTime-morseState.started;
      if(morseAge>=morseDuration)morseState.active=false;
      morseState.multiplier=morseState.active?morseLevel(morseAge):1;
    }
    const factor=lampControl.gate*morseState.multiplier;
    return {day:(1-mix)*s.dayIntensity*factor,night:mix*s.intensity*factor,
      residual:lampControl.afterglow,gate:lampControl.gate};
  }
  let lampGesture=null;
  lampButton.addEventListener('pointerdown',event=>{lampGesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};},{passive:true});
  lampButton.addEventListener('pointermove',event=>{if(lampGesture&&event.pointerId===lampGesture.id&&Math.hypot(event.clientX-lampGesture.x,event.clientY-lampGesture.y)>8)lampGesture.moved=true;},{passive:true});
  lampButton.addEventListener('pointercancel',()=>lampGesture=null,{passive:true});
  let lampSwitchRequest=0,lampSwitchTarget=lampControl.on;
  lampButton.addEventListener('click',async event=>{
    const gesture=lampGesture;lampGesture=null;
    if(event.detail!==0&&(!gesture||gesture.moved||Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8))return;
    const request=++lampSwitchRequest;lampSwitchTarget=!lampSwitchTarget;
    if(!lampSwitchTarget){
      await preloadOffLamp();
      if(request!==lampSwitchRequest||![...sceneAssets.values()].filter(asset=>asset.off&&asset.mode===root.dataset.mode).every(asset=>asset.ready))return;
    }
    lampControl.from=lampControl.gate*morseState.multiplier;lampControl.on=lampSwitchTarget;lampControl.changedAt=topLamp.localTime;
    lampControl.blink=lampControl.on&&topLamp.localTime-lampControl.lastIgnition>=1.8&&!morseState.active;
    if(lampControl.on)lampControl.lastIgnition=topLamp.localTime;
    morseState.active=false;morseState.next=topLamp.localTime+randomBetween(60,120);
    lampButton.setAttribute('aria-label',lampControl.on?'電灯を消す':'電灯を点ける');
    try{sessionStorage.setItem('portfolio-lamp',lampControl.on?'on':'off');}catch{/* Storage is optional. */}
    paintLamp(topLamp,0);if(reduced.matches)scheduleSteadyPaint();else syncMotion();
  });
  const finaleLamp=document.querySelector('.finale-lamp'),finaleHalo=document.createElement('span');
  finaleHalo.className='finale-lamp-halo';finaleLamp.parentElement.append(finaleHalo);
  const moon=document.createElement('button'); moon.className='hero-moon photo-life';
  moon.type='button';moon.setAttribute('aria-label','夜にする');
  moon.innerHTML=`<img data-src="images/moon-day.webp?v=${IMAGE_VERSION}" width="160" height="160" alt="" decoding="async">`;
  const trailLayer=document.createElement('div'); trailLayer.className='hero-contrails';
  hero.querySelector('.hero-scene').append(sky,...cloudLayers,trailLayer,lamp,glow);
  hero.querySelector('.hero-photo').removeAttribute('aria-hidden');
  [sky,...cloudLayers,trailLayer,glow].forEach(node=>node.setAttribute('aria-hidden','true'));
  hero.append(moon);
  const modeButtons=[moon,document.querySelector('.nightmode-toggle')];
  let modeChangedAt=-100,modeFrom=root.dataset.mode==='night'?1:0;
  const nightMode=()=>root.dataset.mode==='night';
  function nightMix(){
    if(reduced.matches)return nightMode()?1:0;
    const p=clamp((performance.now()/1000-modeChangedAt)/2.4);
    return modeFrom+((nightMode()?1:0)-modeFrom)*softProgress(p);
  }
  function softProgress(p){
    // Match --ease-soft: cubic-bezier(.4,0,.2,1), including the canvas.
    let lo=0,hi=1;
    for(let i=0;i<14;i++){
      const t=(lo+hi)/2,x=3*(1-t)**2*t*.4+3*(1-t)*t*t*.2+t**3;
      if(x<p)lo=t;else hi=t;
    }
    const t=(lo+hi)/2,soft=p===0?0:p===1?1:t*t*(3-2*t);
    return soft;
  }
  function applyMode(mode,notify=false){
    preparedModes.clear();
    starScenes.forEach(scene=>scene.fromOpacity=Number(scene.field.style.opacity||0));
    modeFrom=nightMix();modeChangedAt=performance.now()/1000;root.dataset.mode=mode;
    modeButtons.forEach(button=>button.removeAttribute('aria-pressed'));
    modeButtons[1].textContent=mode==='night'?'朝に戻す':'ナイトモード';
    moon.setAttribute('aria-label',mode==='night'?'朝にする':'夜にする');
    syncThemeColor();
    try{sessionStorage.setItem('portfolio-mode',mode);}catch{/* Storage is optional. */}
    if(mode==='night')clearContrails();
    if(mode==='day')trailOwners.forEach(owner=>owner.next=owner.elapsed+(owner.node===hero?randomBetween(14,22):randomBetween(18,30)));
    if(mode==='night')clearFlocks();
    clearFinalEffects();clearPaperPlanes();
    starScenes.forEach(scene=>scene.boostUntil=0);
    paintMode();
    if(reduced.matches)scheduleSteadyPaint();
    if(notify)root.dispatchEvent(new CustomEvent('nightmode:toggle',{bubbles:true,detail:{mode}}));
  }
  let modeRequest=0;
  async function toggleNightMode(){
    const request=++modeRequest,target=nightMode()?'day':'night';
    const ready=preloadMode(target,true);
    await Promise.race([ready,new Promise(resolve=>setTimeout(resolve,1200))]);
    if(request!==modeRequest)return;
    applyMode(target,true);
  }
  modeButtons.forEach(button=>{
    button.addEventListener('click',toggleNightMode);
    ['pointerenter','focus','pointerdown','touchstart'].forEach(type=>button.addEventListener(type,()=>preloadMode(),{passive:true}));
  });
  // Rationale §11: new cloud material grows upwind and dissolves before reset.
  document.querySelectorAll('.cloud-body,.cloud-top,.cloud-wisps').forEach(node=>{
    node.dataset.cloudCopy='0';const copy=node.cloneNode(true);copy.dataset.cloudCopy='1';node.after(copy);
  });
  let finaleCloudTime=0,heroLetterTime=0;
  const finaleTrailLayer=document.querySelector('.finale-contrails');
  ['projects','talks','timeline'].forEach((id,i)=>{
    const window=document.querySelector(`#${id} .sky-window`);
    window.style.setProperty('--crop',["30% 12%","65% 34%","45% 60%","75% 80%"][i]);
    window.querySelectorAll('.window-cloud').forEach((cloud,j)=>{
      cloud.dataset.background=`images/layers/clouds-${j?'near':'far'}.webp?v=${IMAGE_VERSION}`;
      cloud.style.setProperty('--window-period',`${(j?24:43)+i*7}s`);
      cloud.style.setProperty('--window-phase',`${-i*8-j*5}s`);
      cloud.style.bottom=`${j?[-5,3,-1,7][i]:[16,24,12,20][i]}%`;
    });
    windowTrails.push({node:window,section:document.getElementById(id),active:false,pending:false,elapsed:0,trail:null});
  });

  function pairPhoto(node,nightSrc,nightSrcset='') {
    const day=node.querySelector(':scope > picture,:scope > img');
    if(!day)return;
    day.classList.add('mode-day');
    const night=day.cloneNode(true);night.classList.remove('mode-day');night.classList.add('mode-night');
    const image=night.matches('img')?night:night.querySelector('img');
    image.dataset.src=nightSrc;image.removeAttribute('data-srcset');image.loading='eager';
    if(nightSrcset)image.dataset.srcset=nightSrcset;
    night.querySelectorAll('source').forEach(source=>{
      const lamp=nightSrc.includes('lamp-');
      source.dataset.srcset=lamp?`images/layers/lamp-tall-night.webp?v=${IMAGE_VERSION} 1x, images/layers/lamp-tall-night-2x.webp?v=${IMAGE_VERSION} 2x`:`images/layers/sky-night-tall.webp?v=${IMAGE_VERSION}`;
    });
    day.after(night);
    exposureMates.set(day,night);exposureMates.set(night,day);
  }
  pairPhoto(sky,`images/layers/sky-night-wide.webp?v=${IMAGE_VERSION}`);
  pairPhoto(lamp,`images/layers/lamp-wide-night.webp?v=${IMAGE_VERSION}`,`images/layers/lamp-wide-night.webp?v=${IMAGE_VERSION} 1x, images/layers/lamp-wide-night-2x.webp?v=${IMAGE_VERSION} 2x`);
  pairPhoto(moon,`images/moon-day.webp?v=${IMAGE_VERSION}`);
  document.querySelectorAll('.cloud-layer').forEach(node=>{
    const name=['base','body','top','wisps'].find(name=>node.classList.contains(`cloud-${name}`));
    pairPhoto(node,`images/cumulonimbus/${name}-night-2000.webp?v=${IMAGE_VERSION}`,`images/cumulonimbus/${name}-night-2000.webp?v=${IMAGE_VERSION} 2000w, images/cumulonimbus/${name}-night.webp?v=${IMAGE_VERSION} 4000w`);
  });
  ['.pole-photo','.signal-pole','.signal-head','.finale-lamp'].forEach(selector=>{
    const node=document.querySelector(selector),source=node.querySelector(':scope > img').getAttribute('data-src');
    pairPhoto(node,source.replace('.webp','-night.webp'));
  });
  function splitDayLamp(node,variant){
    const day=node.querySelector(':scope > .mode-day');
    const replace=src=>src.replace(/lamp-(wide|tall|finale)(-2x)?\.webp/g,'lamp-$1$2-dim.webp');
    day.querySelectorAll('source,img').forEach(image=>{
      for(const attr of ['data-src','data-srcset'])if(image.hasAttribute(attr))image.setAttribute(attr,replace(image.getAttribute(attr)));
    });
    if(day.matches('img'))day.dataset.src=replace(day.getAttribute('data-src'));
    const light=document.createElement('span');light.className='day-lamp-glow';light.setAttribute('aria-hidden','true');
    const image=document.createElement('img');image.alt='';image.decoding='async';light.classList.add('mode-day');
    image.dataset.src=`images/layers/lamp-${variant}-glow.webp?v=${IMAGE_VERSION}`;if(node===lamp)image.fetchPriority='high';light.append(image);node.append(light);
    return light;
  }
  const dayGlow=splitDayLamp(lamp,'wide'),finaleDayGlow=splitDayLamp(finaleLamp,'finale');
  const litLampPictures=[...lamp.querySelectorAll(':scope > picture')];
  litLampPictures.forEach(node=>node.classList.add('lamp-lit'));
  let offLampPrepared=false,offLampWanted=false;
  function preloadOffLamp(){
    offLampWanted=true;
    if(!offLampPrepared){
      offLampPrepared=true;
      const surface=photos.find(p=>p.node===lamp).surface;
      for(const lit of litLampPictures){
        const off=lit.cloneNode(true);off.classList.remove('lamp-lit');off.classList.add('lamp-off','top-decoration');
        off.setAttribute('aria-hidden','true');
        off.querySelectorAll('source,img').forEach(image=>{
          image.removeAttribute('src');image.removeAttribute('srcset');
          for(const attr of ['data-src','data-srcset'])if(image.hasAttribute(attr)){
            image.setAttribute(attr,image.getAttribute(attr).replace(/lamp-(wide|tall)(-night)?(-2x)?(-dim)?\.webp/g,'lamp-$1$2$3-off.webp'));
          }
          if(image.matches('img')){image.fetchPriority='auto';image.loading='eager';}
        });
        surface.prepend(off);modeLayers.add(off);
      }
      collectSceneAssets(lamp);lastMix=-1;queueGeometry();
    }
    return loadSceneAssets(hero,root.dataset.mode,{off:true});
  }
  ['pointerenter','focus','pointerdown','touchstart'].forEach(type=>lampButton.addEventListener(type,preloadOffLamp,{passive:true}));
  const queueOffLamp=()=>setTimeout(preloadOffLamp,8000);
  if(document.readyState==='complete')queueOffLamp();
  else addEventListener('load',queueOffLamp,{once:true});
  const finaleDaySurface=document.createElement('span');finaleDaySurface.className='finale-day-surface';
  finaleDaySurface.append(finaleLamp.querySelector(':scope > .mode-day'),finaleDayGlow);finaleLamp.prepend(finaleDaySurface);
  const dayHalo=document.createElement('span'),finaleDayHalo=document.createElement('span');
  dayHalo.className='day-lamp-halo';finaleDayHalo.className='day-lamp-halo finale-day-halo';
  dayHalo.setAttribute('aria-hidden','true');finaleDayHalo.setAttribute('aria-hidden','true');
  glow.append(dayHalo);finaleLamp.parentElement.append(finaleDayHalo);
  function pairBackground(node,source){
    const day=document.createElement('span');day.className='background-exposure mode-day';
    day.dataset.background=node.dataset.background;
    const night=day.cloneNode();night.className='background-exposure mode-night';night.dataset.background=source;
    delete node.dataset.background;node.style.backgroundImage='none';node.prepend(day,night);
  }
  cloudLayers.forEach((node,i)=>pairBackground(node,`images/layers/clouds-${['haze','far','mid','near'][i]}-night.webp?v=${IMAGE_VERSION}`));
  const finaleSky=document.querySelector('.finale-sky');
  finaleSky.dataset.background=`images/sky-summer.webp?v=${IMAGE_VERSION}`;
  pairBackground(finaleSky,`images/sky-night.webp?v=${IMAGE_VERSION}`);
  const lowClouds=document.querySelector('.finale-low-clouds');
  lowClouds.dataset.background=`images/layers/clouds-far-summer.webp?v=${IMAGE_VERSION}`;
  pairBackground(lowClouds,`images/layers/clouds-far-night.webp?v=${IMAGE_VERSION}`);
  document.querySelectorAll('.sky-window').forEach(node=>{
    const image=node.querySelector('.window-sky');image.classList.add('mode-day');
    const night=image.cloneNode();night.className='window-sky mode-night';night.dataset.src=`images/layers/sky-night-tall.webp?v=${IMAGE_VERSION}`;night.loading='eager';image.after(night);
    const grain=document.createElement('span');grain.className='window-grain mode-night';grain.dataset.background=`images/layers/sky-night-grain.webp?v=${IMAGE_VERSION}`;night.after(grain);
    node.querySelectorAll('.window-cloud').forEach((cloud,i)=>pairBackground(cloud,`images/layers/clouds-${i?'near':'far'}-night.webp?v=${IMAGE_VERSION}`));
    const stars=document.createElement('span');stars.className='window-stars mode-night';
    for(let i=0;i<4;i++){const star=document.createElement('i');star.style.cssText=`left:${18+i*19}%;top:${12+(i*13)%33}%;`;stars.append(star);}
    node.querySelector('.window-depth').append(stars);
  });

  const modeLayers=new Set(document.querySelectorAll('.mode-day,.mode-night'));
  let lastMix=-1;
  function paintMode() {
    const mix=nightMix();
    if(mix===lastMix)return;
    lastMix=mix;
    modeLayers.forEach(node=>{
      if(node.classList.contains('lamp-lit'))return;
      const value=assetOpacity(node,node.classList.contains('mode-night')?mix:1-mix);
      // Reveal before the next composite; release the unused exposure at zero.
      opacity(node,value);
      node.style.willChange=value>0&&value<1&&!node.closest('.top-dormant,.finale-dormant')?'opacity':'';
    });
    starScenes.forEach(scene=>paintStarExposure(scene));
    lamps.forEach(state=>paintLampElements(state));
    paintYellow(reduced.matches?1:yellowOpacity);
  }

  function smoothNoise(t) {
    const hash=n=>{let v=Math.imul(n^1101,1597334677);v=Math.imul(v^(v>>>16),2246822519);return(v>>>0)/4294967295*2-1;};
    const left=Math.floor(t), f=t-left, blend=f*f*(3-2*f);
    return hash(left)*(1-blend)+hash(left+1)*blend;
  }
  // All photographs share this sun; the 4s shade and 6s recovery are synchronized.
  function sunlight(now) {
    if(now>=nextShade){shadeStart=now;nextShade=now+(inView.has(closing)?randomBetween(25,40):randomBetween(30,60));}
    const age=now-shadeStart, base=.99+.04*smoothNoise(now/65);
    if(age>=0&&age<10){const t=age<4?age/4:(10-age)/6,s=t*t*(3-2*t);return base*(1-s)+.93*s;}
    return base;
  }
  function lampIntensity(now,state) {
    if(now>=state.nextBurst){state.burstAt=now;state.nextBurst=now+randomBetween(4,9);}
    const age=now-state.burstAt, stumble=age>=0&&age<.42?.16*Math.sin(age*46)**2*(1-age/.42):0;
    return Math.max(.65,.88+.075*Math.sin(now*Math.PI*2/5.2)+.035*smoothNoise(now*10)-stumble);
  }
  function dayLampIntensity(now,state){
    if(now>=state.nextDayBurst){
      // The common flash limit also bounds existing daylight lamp bursts.
      state.dayBurstAt=now;state.dayBurstDuration=randomBetween(1,1.2);
      state.dayBurstCount=3;state.dayBurstLow=randomBetween(.35,.55);
      if(state.el===glow){state.dayBurstDuration=.9;state.dayBurstCount=2;state.dayBurstLow=.55;}
      state.nextDayBurst=now+randomBetween(6,12);
    }
    const base=1+.1*Math.sin(now*2*Math.PI/state.dayPeriod)+.03*smoothNoise(now*12);
    const age=now-state.dayBurstAt;
    if(age>=0&&age<state.dayBurstDuration){
      const cycle=age/state.dayBurstDuration*state.dayBurstCount;
      return base-(base-state.dayBurstLow)*Math.sin(cycle*Math.PI)**2;
    }
    return base;
  }
  function createLamp(el,opts={}) {
    const state={el,strength:opts.strength??1,nextBurst:randomBetween(4,9),burstAt:-10,localTime:0,
      hovered:false,focused:false,touchUntil:0,idleUntil:0,feedback:0,wanted:false,changedAt:0,visible:false,intensity:1,paint:opts.paint,
      dayIntensity:1,dayPeriod:randomBetween(4,6),nextDayBurst:randomBetween(6,12),dayBurstAt:-10};
    state.intensity=state.strength;
    state.feedbackNode=null;
    if(el.matches('.work,.appearance,.events > li,.links a')){
      state.feedbackNode=document.createElement('span');state.feedbackNode.className='lamp-feedback';
      state.feedbackNode.setAttribute('aria-hidden','true');el.append(state.feedbackNode);
    }
    if(el.matches('.events,.events > li')){
      state.marker=document.createElement('span');state.marker.className=el.matches('.events')?'event-line':'event-lamp';
      state.marker.setAttribute('aria-hidden','true');el.prepend(state.marker);
    }else state.marker=el.querySelector('.icon-lamp,.guide-lamp,.location-lamp');
    lamps.push(state);
    if(opts.interactive){
      el.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')state.hovered=true;});
      el.addEventListener('pointerleave',()=>state.hovered=false);
      el.addEventListener('focusin',()=>state.focused=true);
      el.addEventListener('focusout',e=>{if(!el.contains(e.relatedTarget))state.focused=false;});
      el.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')state.touchUntil=time+.75;});
      el.addEventListener('pointercancel',()=>state.touchUntil=0);
    }
    return state;
  }
  function paintLamp(s,delta) {
    if(reduced.matches){
      s.intensity=s.strength;s.dayIntensity=1;s.feedback=0;
      paintLampElements(s);
      if(s.paint)s.paint(s.intensity);
      return;
    }
    s.localTime+=delta;
    const wanted=s.hovered||s.focused||s.touchUntil>time||s.idleUntil>time;
    if(wanted!==s.wanted){s.wanted=wanted;s.changedAt=s.localTime;s.from=s.feedback;}
    const p=clamp((s.localTime-s.changedAt)/((wanted?durations.on:durations.off)/1000)),target=wanted?1:0;
    s.feedback=(s.from||0)+(target-(s.from||0))*(1-(1-p)**3);
    const flicker=wanted&&p<1?.78+.22*Math.sin(p*18)**2:1;
    s.intensity=lampIntensity(s.localTime,s)*s.strength;
    if(s.el===glow)s.dayIntensity=lampControl.on&&s.localTime-lampControl.lastIgnition>=1.8&&!morseState.active?dayLampIntensity(s.localTime,s):1;
    else if(!nightMode()&&s.el===finaleLamp)s.dayIntensity=dayLampIntensity(s.localTime,s);
    s.flicker=flicker;paintLampElements(s);
    if(s.paint)s.paint(s.intensity);
  }
  const glass=glow.querySelector('.lantern-glass');
  const finaleGlass=finaleLamp.querySelector('.finale-lamp-glass'),finaleBloom=finaleLamp.querySelector('.finale-lamp-bloom');
  finaleGlass.dataset.mask=`images/layers/lamp-glass-mask-finale.webp?v=${IMAGE_VERSION}`;
  finaleGlass.dataset.assetMode='night';
  function paintLampElements(s) {
    const mix=nightMix(),i=s.intensity*(1+s.feedback*.12),feedback=s.feedback*(s.flicker??1)*s.intensity;
    if(s.marker){
      const value=s.marker.matches('.icon-lamp')?i*.2:s.marker.matches('.event-line')?.72+i*.2:
        s.marker.matches('.event-lamp')?(nightMode()?.95:.55+i*.2):s.marker.matches('.guide-lamp')?
        (s.el.hasAttribute('aria-current')?i*.9:s.el.parentElement.classList.contains('passed')?.28:1):i;
      opacity(s.marker,value);
    }
    if(s.feedbackNode)opacity(s.feedbackNode,feedback*(.38*(1-mix)+.06*mix));
    if(s.el.matches('.wire-toc a'))opacity(s.el,.88+feedback*.12,false);
    if(!coarse.matches&&s.el.matches('.links a'))s.el.querySelectorAll('.focus-character').forEach(char=>opacity(char,.92+feedback*.08,false));
    if(s.el===glow){
      const light=composeTopLight(s,mix);s.composed=light;
      litLampPictures.forEach(node=>opacity(node,assetOpacity(node,node.classList.contains('mode-night')?mix:1-mix)*light.gate));
      opacity(dayGlow,light.day+(1-mix)*light.residual);opacity(dayHalo,.32*light.day);
      opacity(glass,.75*light.night+mix*light.residual);
      opacity(bloom,.42*mix*(s.intensity*light.gate*morseState.multiplier)**1.4);
      opacity(halo,light.night);
      transform(bloom,`scale(${1+.6*mix})`);
    }
    if(s.el===finaleLamp){
      opacity(finaleDayGlow,(1-mix)*s.dayIntensity);opacity(finaleDayHalo,(1-mix)*.32*s.dayIntensity);
      opacity(finaleGlass,i*.75*mix);opacity(finaleBloom,i*.42*mix);
      opacity(finaleHalo,mix*s.intensity/.62);transform(finaleBloom,`scale(${1+.6*mix})`);
    }
  }
  const topLamp=createLamp(glow);
  createLamp(document.querySelector('.identity-icon'),{strength:.7,interactive:true});
  document.querySelectorAll('.work,.appearance,.events > li,.links a').forEach(el=>createLamp(el,{strength:.65,interactive:true}));
  document.querySelectorAll('.events').forEach(el=>createLamp(el,{strength:.45}));
  guideLinks.forEach(el=>createLamp(el,{strength:.7}));
  createLamp(document.querySelector('.mobile-location'),{strength:.6});
  const signal=document.querySelector('.fixture-signal');
  const signalHead=signal.querySelector('.signal-head'),signalOn=signal.querySelector('.signal-on');
  const greenExposure=document.createElement('div');greenExposure.className='signal-day-exposure mode-day';
  greenExposure.append(signalOn,signalHead.querySelector('.signal-bloom'),signalHead.querySelector('.signal-led'));signalHead.append(greenExposure);
  modeLayers.add(greenExposure);
  const signalSpring=new Spring(1.6,.12,.6);
  const signalState={elapsed:0,nextWind:3,nextBurst:2,burstAt:-10,burstDuration:.45,dips:4,blinkAt:-10,quietUntil:0,opacity:.78};
  const signalBloom=signal.querySelector('.signal-bloom');
  const setSignalOpacity=value=>opacity(signalOn,value),setSignalBloom=value=>opacity(signalBloom,value);
  const led=signal.querySelector('.signal-led'),ledContext=led.getContext('2d');
  const ledDots=Array.from({length:60},()=>{
    const angle=randomBetween(0,Math.PI*2),radius=Math.sqrt(Math.random())*57;
    return{x:64+Math.cos(angle)*radius,y:64+Math.sin(angle)*radius,phase:Math.random()*100};
  });
  const yellow=document.createElement('div');yellow.className='signal-yellow';
  yellow.innerHTML=`<img data-asset-mode="night" data-src="images/fixtures/signal-head-yellow-night.webp?v=${IMAGE_VERSION}" width="2000" height="1400" alt="" decoding="async"><span class="signal-yellow-bloom"></span>`;
  signalHead.append(yellow);
  // Lens geometry: 2000×1400, centre (720.86,607), major 130.29,
  // minor 105.86, clockwise 113.40°. The bloom uses the same ellipse.
  const yellowBloom=yellow.querySelector('.signal-yellow-bloom');
  let yellowOpacity=1;
  function paintYellow(value){
    yellowOpacity=value;opacity(yellow,value*nightMix());
    opacity(yellowBloom,.35*value);
  }
  let ledFrame=-1;
  // The photograph's smaller daylight strength does not attenuate the night halo.
  createLamp(finaleLamp,{strength:.62});

  function paintSignal(delta) {
    const s=signalState;s.elapsed+=delta;
    if(s.elapsed>=s.nextWind){if(s.elapsed>=s.quietUntil)signalSpring.impulse(randomBetween(.1,.15)*signalSpring.omega*(Math.random()<.5?-1:1));s.nextWind=s.elapsed+randomBetween(3,6);}
    signalSpring.step(delta);transform(signalHead,`rotate(${signalSpring.x.toFixed(5)}deg)`);
    if(s.elapsed>=s.nextBurst){s.burstAt=s.elapsed;s.burstDuration=randomBetween(.5,.6);s.dips=Math.floor(randomBetween(3,7));s.nextBurst=s.elapsed+randomBetween(5,5.8);}
    // Bursts recur inside every six-second viewing window; individual timings vary.
    const noise=.06*smoothNoise(s.elapsed*15),breath=.05*Math.sin(s.elapsed*Math.PI*2/4.3);
    let opacity=.78+.14*(noise+breath);
    const age=s.elapsed-s.burstAt;
    if(age>=0&&age<s.burstDuration)opacity=.55+.07*(1-Math.sin(Math.PI*s.dips*age/s.burstDuration)**2);
    const blink=s.elapsed-s.blinkAt;
    if(blink>=0&&blink<1.6&&Math.floor(blink/.2)%2===0)opacity=.08;
    s.opacity=opacity;
    // Local opacity targets retain their own paint surfaces.
    setSignalOpacity(opacity);
    // 500ms on / 500ms off; linear LED rise 60ms and fall 80ms.
    const phase=time%1,amber=reduced.matches?1:phase<.06?phase/.06:phase<.5?1:phase<.58?1-(phase-.5)/.08:0;
    paintYellow(amber);
    setSignalBloom(.22+.18*clamp((opacity-.55)/.25));
    const ledTick=Math.floor(s.elapsed*12);
    if(ledTick!==ledFrame&&ledContext){
      ledFrame=ledTick;ledContext.clearRect(0,0,128,128);
      ledContext.fillStyle=ledColor;
      ledDots.forEach(dot=>{
        ledContext.globalAlpha=(.25+.75*clamp((smoothNoise(ledTick*.8+dot.phase)+1)/2))*clamp(opacity/.78);
        ledContext.beginPath();ledContext.arc(dot.x,dot.y,.8,0,2*Math.PI);ledContext.fill();
      });
      ledContext.globalAlpha=1;
    }
  }

  function trackAnimation(node,frames,options,owner=node) {
    if(reduced.matches)return null;
    const animation=node.animate(frames,options),state={animation,node,owner}; animations.add(state);
    animation.finished.then(()=>animations.delete(state),()=>animations.delete(state)); return animation;
  }
  function reactSignal(){
    if(reduced.matches)return;
    signalSpring.impulse(.66*signalSpring.omega-signalSpring.v);signalState.blinkAt=signalState.elapsed;
    signalState.quietUntil=signalState.elapsed+4;
  }
  signal.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')reactSignal();});
  signal.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')reactSignal();});
  signal.addEventListener('focus',reactSignal);
  const huntTargets=[document.querySelector('.hero-name'),document.querySelector('#owner-name'),...document.querySelectorAll('.sec-head .jp,.year-group h3,.copyright-mark')];
  huntTargets.forEach(el=>{
    splitDecorativeText(el,el.classList.contains('hero-name')?'hero-letter':'focus-character');
    let hovered=null;
    const pointerHunt=e=>{
      if(!fine.matches)return;
      const char=e.target.closest('.split-source')?[...el.querySelectorAll('.hero-letter,.focus-character')].find(node=>{
        const box=node.getBoundingClientRect();return e.clientX>=box.left&&e.clientX<=box.right&&e.clientY>=box.top&&e.clientY<=box.bottom;
      }):e.target.closest('.hero-letter,.focus-character');
      if(char&&char!==hovered)hunt(char);hovered=char;
    };
    el.addEventListener('pointerover',pointerHunt);el.addEventListener('pointermove',pointerHunt);el.addEventListener('pointerleave',()=>hovered=null);
  });
  function hunt(char) {
    if(!char||reduced.matches||hasRunningAnimation(char))return;
    const samples=focusSamples(char),owner=char.closest('section,footer');
    if(hasRunningAnimation(samples.hunt))return;
    samples.hunt.classList.remove('is-dormant');samples.hunt.style.visibility='visible';
    trackAnimation(samples.sharp,[{opacity:1},{opacity:0},{opacity:1}],{duration:durations.hunt,easing:'ease-in-out'},owner);
    trackAnimation(samples.hunt,[{opacity:0},{opacity:1},{opacity:0}],{duration:durations.hunt,easing:'ease-in-out'},owner);
  }
  const subtitle=document.querySelector('.hero-sub');
  splitDecorativeText(subtitle,'hero-sub-letter');
  const nameLetters=[...document.querySelectorAll('.hero-letter')],subLetters=[...subtitle.querySelectorAll('.hero-sub-letter')];
  let heroLettersResting=false;
  function restHeroLetters(){
    if(heroLettersResting)return;heroLettersResting=true;
    [...nameLetters,...subLetters].forEach(letter=>{
      // .84 is the resting value of the shimmer below, so the still letters keep the same tone.
      letter.style.translate='none';letter.style.transform='';letter.style.opacity='.84';
      const samples=letter._focusSamples;
      if(samples){samples.sharp.style.opacity='';samples.soft.style.opacity='0';samples.hunt.style.opacity='0';}
    });
  }
  function paintHeroLetters(delta){
    // Phones keep the letters still: each moving letter is its own layer, and iOS Safari
    // showed magenta strips at those layers' edges when they repainted together (night switch).
    if(coarse.matches){restHeroLetters();return;}
    heroLettersResting=false;
    heroLetterTime+=delta;
    [nameLetters,subLetters].forEach((letters,group)=>letters.forEach((letter,i)=>{
      const t=heroLetterTime,phase=i*.61,amplitude=group?.6:1.6;
      const drift=amplitude*(.7*Math.sin(t*2*Math.PI/(5.8+i%4*.8)+phase)+.3*Math.sin(t*2*Math.PI/8.6+phase*1.7));
      const depth=group||nightMode()?0:1.5;
      translate(letter,easedPointer.x*depth,drift+easedPointer.y*depth);
      const samples=focusSamples(letter),soft=(1+Math.sin(t*2*Math.PI/7.1+phase))/2;
      if(!hasRunningAnimation(samples.sharp)){
        opacity(samples.sharp,1-soft,false);opacity(samples.soft,soft);
      }
      const wave=(t-i/Math.max(1,letters.length-1)*1.8-group*.3+7.5)%7.5;
      letter.style.opacity=(.84+(wave<1.3?.16*Math.sin(wave/1.3*Math.PI):0)).toFixed(4);
    }));
  }
  // Bounds are the union of the original day/night alpha, padded by 2 source px.
  // The original full photograph coordinates and bottom-centred growth remain intact.
  const cloudBounds={base:[32,980,1983,1293],body:[39,269,1889,1133],top:[338,28,1659,517],wisps:[209,224,1963,797]};
  document.querySelectorAll('.photo-life').forEach(node=>{
    const cloudDepth={haze:0,far:2,mid:4,near:6};
    const cloudName=['haze','far','mid','near'].find(name=>node.classList.contains(`hero-clouds-${name}`));
    const finalName=['base','body','top','wisps'].find(name=>node.classList.contains(`cloud-${name}`));
    const depth=node===sky?0:node===lamp?3:cloudName?cloudDepth[cloudName]:finalName?{base:2,body:4,top:6,wisps:9}[finalName]:node.closest('.fixture')?0:2;
    node.classList.add('motion-owner');
    let surface=node;
    if(finalName||node===lamp){
      surface=document.createElement('span');surface.className=finalName?'cloud-surface':'lamp-surface';
      surface.append(...node.childNodes);node.append(surface);
      if(node===lamp){surface.append(lampButton);surface.querySelectorAll('picture,.day-lamp-glow').forEach(child=>child.setAttribute('aria-hidden','true'));}
      if(finalName)opacity(surface,finalName==='base'||Number(node.dataset.cloudCopy||0)===1?1:0);
    }
    const nightDepth=node===lamp?8:cloudName?{haze:0,far:2,mid:3,near:5}[cloudName]:depth;
    photos.push({node,surface,depth,nightDepth,top:0,height:0,visible:false,x:0,y:0,elapsed:0,cloudName,finalName});
  });
  // One viewport-sized sunlight overlay for each visible scene, rather than three
  // masked overlays and a 3000px atmospheric pseudo-element on every photograph.
  const sunScenes=[{owner:hero,holder:hero.querySelector('.hero-scene')},
    {owner:closing,holder:document.querySelector('.closing-scene')},
    ...['projects','talks','timeline'].map(id=>({owner:document.getElementById(id),holder:document.querySelector(`#${id} .window-exposure`)}))]
    .map(scene=>{
      const overlay=document.createElement('span');overlay.className='scene-sun';
      const dark=document.createElement('span'),bright=document.createElement('span'),air=document.createElement('span');
      dark.className='scene-sun-dark';bright.className='scene-sun-bright';air.className='scene-air';
      air.style.animationDuration=`${randomBetween(60,120).toFixed(1)}s`;
      overlay.append(dark,bright,air);scene.holder.append(overlay);
      return{...scene,overlay,dark,bright,elapsed:0};
    });
  function paintSun(light=1,steady=false){
    sunScenes.forEach(scene=>{
      if(!steady&&!inView.has(scene.owner))return;
      const skyLight=scene.owner===closing&&!steady?.04*Math.sin(scene.elapsed*Math.PI*2/9):0;
      opacity(scene.dark,steady?.015:Math.max(0,1-light)*.55+.008+Math.max(0,-skyLight));
      opacity(scene.bright,steady?.012:Math.max(0,light-.95)*.24+Math.max(0,skyLight));
    });
  }
  function fitPhotoSurfaces(){
    const plans=photos.filter(p=>p.finalName).map(p=>{
      const w=p.node.clientWidth,h=p.node.clientHeight,[x0,y0,x1,y1]=cloudBounds[p.finalName];
      const leftMargin=p.finalName==='wisps'?Math.min(96,innerWidth*.3):innerWidth*.15;
      const rightMargin=innerWidth*.3-leftMargin;
      const x=Math.max(x0/2000*w,w/2-innerWidth/2-leftMargin),right=Math.min(x1/2000*w,w/2+innerWidth/2+rightMargin);
      const y=y0/1334*h,width=right-x,height=(y1-y0)/1334*h;
      return {p,w,h,x,y,width,height};
    });
    plans.forEach(({p,w,h,x,y,width,height})=>{
      p.surface.style.cssText=`left:${x}px;top:${y}px;width:${width}px;height:${height}px;transform-origin:${w/2-x}px ${h-y}px`;
      p.surface.querySelectorAll('img').forEach(img=>img.style.cssText=`left:${-x}px;top:${-y}px;width:${w}px;height:${h}px`);
      const crown=p.surface.querySelector('.cloud-crown');
      if(crown){
        const material=p.surface.querySelector('img');
        if(material.currentSrc||material.getAttribute('src'))crown.style.maskImage=`url("${material.currentSrc||material.src}")`;
        crown.style.maskSize=`${w}px ${h}px`;crown.style.maskPosition=`${-x}px ${-y}px`;
      }
    });
  }

  const flows=[...document.querySelectorAll('.hero-clouds,.finale-low-clouds,.window-cloud')].map(node=>({node,elapsed:0,tiles:[],key:''}));
  const cloudDescent={distance:1,progress:0,heroHeight:0,headingTop:0,textBottom:0,stripHeight:0,layers:[]};
  function paintCloudDescent(){
    cloudDescent.progress=reduced.matches?0:clamp(scrollY/cloudDescent.distance);
    // Keep the entire cloud strip below both text boxes until they reach 15% H.
    const released=smoothStep((scrollY-(cloudDescent.textBottom-innerHeight*.15))/(cloudDescent.heroHeight*.1));
    cloudDescent.layers=cloudLayers.map((node,i)=>{
      const risePerProgress=cloudDescent.heroHeight*[.03,.07,.14,.26][i],scalePerProgress=[.01,.02,.04,.08][i];
      const clearance=Math.max(0,cloudDescent.heroHeight-cloudDescent.textBottom-12-cloudDescent.stripHeight);
      const safeProgress=Math.min(cloudDescent.progress,clamp(clearance/Math.max(1,risePerProgress+cloudDescent.stripHeight*scalePerProgress)));
      const progress=safeProgress+(cloudDescent.progress-safeProgress)*released;
      const rise=risePerProgress*progress,scale=1+scalePerProgress*progress;
      return {name:['haze','far','mid','near'][i],rise,scale};
    });
  }
  function fitFlows(){
    const plans=flows.map(flow=>{
      const node=flow.node,css=getComputedStyle(node),width=node.clientWidth,height=node.clientHeight;
      const isHero=node.classList.contains('hero-clouds'),isWindow=node.classList.contains('window-cloud');
      const isLow=node.classList.contains('finale-low-clouds'),dpr=devicePixelRatio||1;
      // The low-cloud photo occupies rows 341..590 before its lower alpha fade.
      // Keep its upper contour in place, but extend that material to the overdraw
      // edge; enlarging only the box leaves the photo's transparent tail visible.
      const stripHeight=isHero?parseFloat(css.getPropertyValue('--strip-height')):isLow?height*(900-341)/(590-341):height;
      const backgroundY=isLow?341/900*(height-stripHeight):'bottom';
      const tilePixels=Math.round((isHero?parseFloat(css.getPropertyValue('--tile-width')):isWindow?parseFloat(css.getPropertyValue('--window-tile')):height*4800/900)*dpr);
      const tile=tilePixels/dpr;
      const heroSpeed=node.classList.contains('hero-clouds-haze')?.6:node.classList.contains('hero-clouds-near')?4:node.classList.contains('hero-clouds-mid')?2.5:1.2;
      const period=isHero?tile/(heroSpeed*innerWidth/1920):isWindow?parseFloat(css.getPropertyValue('--window-period')):300;
      const nightPeriod=node.classList.contains('hero-clouds-haze')?2400:node.classList.contains('hero-clouds-near')?900:node.classList.contains('hero-clouds-mid')?1100:1400;
      const phase=isWindow?Math.abs(parseFloat(css.getPropertyValue('--window-phase'))||0):0;
      const key=[width,height,tile,period,dpr].join(':');if(flow.key===key)return null;
      const origin=node.getBoundingClientRect().left-(photos.find(p=>p.node===node)?.x||0);
      return {flow,node,width,height,isHero,isWindow,isLow,dpr,stripHeight,backgroundY,tilePixels,tile,heroSpeed,period,nightPeriod,phase,key,origin};
    }).filter(Boolean);
    plans.forEach(({flow,node,width,height,isHero,isWindow,isLow,dpr,stripHeight,backgroundY,tilePixels,tile,heroSpeed,period,nightPeriod,phase,key,origin})=>{
      flow.key=key;flow.tile=tile;flow.period=period;flow.phase=phase;flow.width=width;flow.dpr=dpr;flow.isWindow=isWindow;
      flow.stripHeight=stripHeight;
      flow.isHero=isHero;flow.daySpeed=heroSpeed*innerWidth/1920;flow.nightSpeed=tile/nightPeriod;flow.distance??=0;
      flow.origin=origin;
      if(!flow.sources){
        flow.sources=[...node.querySelectorAll(':scope > .background-exposure')];
        flow.sources.forEach(source=>{modeLayers.delete(source);source.remove();});
      }
      flow.tiles.forEach(part=>{part.node.querySelectorAll('.mode-day,.mode-night').forEach(layer=>modeLayers.delete(layer));part.node.remove();});
      flow.tiles=[];
      // Short strips retain the v20f resident-area budget. Rasterize an extra
      // pixel on either side, then clip it at fixed device-pixel boundaries:
      // overlapping translucent photo pixels must never be composited twice.
      // A sky window is small enough for one uninterrupted moving photograph.
      const count=isHero||isWindow?1:Math.ceil(tile/256),cycles=isHero||isWindow?1:Math.ceil(width/tile)+2;
      const bleed=Math.ceil(dpr)/dpr;
      for(let cycle=0;cycle<cycles;cycle++)for(let index=0;index<count;index++){
        const start=Math.round(index*tilePixels/count)/dpr;
        const end=isHero||isWindow?Math.ceil(width*dpr)/dpr+tile:Math.round((index+1)*tilePixels/count)/dpr;
        const partWidth=end-start;
        const part=document.createElement('span');part.className='flow-tile';
        part.style.cssText=`width:${partWidth+2*bleed}px;height:${height}px;${isHero?'':`clip-path:inset(0 ${bleed}px);`}`;
        flow.sources.forEach(source=>{
          const exposure=source.cloneNode();exposure.style.backgroundImage='none';
          exposure.style.backgroundSize=`${tile}px ${stripHeight}px`;
          exposure.style.backgroundPosition=`${bleed-start}px ${isLow?`${backgroundY}px`:backgroundY}`;
          exposure.style.backgroundRepeat='repeat-x';exposure.style.willChange='';
          modeLayers.add(exposure);part.append(exposure);
        });
        node.append(part);flow.tiles.push({node:part,offset:cycle*tile+start,width:partWidth,bleed});
      }
      flow.length=cycles*tile;
      if(sceneAssetsStarted)collectSceneAssets(node);
    });
    lastMix=-1;paintMode();paintFlows(0);
  }
  function paintFlows(delta){
    flows.forEach(flow=>{
      const owner=flow.isHero?hero:flow.node.closest('.sky-window')||flow.node;
      if(!inView.has(owner)&&delta)return;
      flow.elapsed+=delta;
      if(flow.isHero){flow.speed=(flow.daySpeed*(1-nightMix())+flow.nightSpeed*nightMix())*(1+.6*windStrength());flow.distance+=delta*flow.speed;}
      const shift=reduced.matches?0:flow.isHero?flow.distance:(flow.elapsed+flow.phase)/flow.period*flow.tile;
      const snappedShift=flow.isWindow?shift:Math.round((shift+flow.origin)*flow.dpr)/flow.dpr-flow.origin;
      flow.tiles.forEach(part=>{
        const x=flow.isHero?((snappedShift%flow.tile)+flow.tile)%flow.tile-flow.tile:((part.offset+snappedShift)%flow.length+flow.length)%flow.length-flow.tile;
        const visible=x<flow.width&&x+part.width>0;
        part.node.style.visibility=visible?'visible':'hidden';part.node.hidden=!visible;
        if(visible)transform(part.node,`translate(${x-part.bleed}px,0)`);
      });
    });
  }

  function focusSamples(char){
    if(char._focusSamples)return char._focusSamples;
    const sharp=document.createElement('span');sharp.className='focus-sharp';sharp.append(...char.childNodes);
    const soft=document.createElement('span'),hunt=document.createElement('span');
    soft.className='focus-soft';hunt.className='focus-hunt';
    soft.dataset.glyph=hunt.dataset.glyph=sharp.textContent;
    soft.setAttribute('aria-hidden','true');hunt.setAttribute('aria-hidden','true');
    char.append(sharp,soft,hunt);return char._focusSamples={sharp,soft,hunt};
  }

  // Preserve links, phrases, time elements and spaces while revealing their text.
  function textNodes(el) {
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())if(walker.currentNode.textContent&&!walker.currentNode.parentElement.closest('.outward,.visually-hidden,.split-source,.focus-ghost'))nodes.push(walker.currentNode);
    return nodes;
  }
  function splitSource(text,visual) {
    const source=document.createElement('span');source.className='split-source';source.textContent=text;
    splitPairs.push({source,visual});return source;
  }
  function coalesceSplitSources() {
    const groups=new Map();
    for(const pair of splitPairs){
      const target=pair.source.closest('.work h3,.appearance h3,.links a,.desc p,.granular-medium')||pair.source.parentElement;
      if(!groups.has(target))groups.set(target,[]);groups.get(target).push(pair);
    }
    for(const [target,pairs] of groups){
      if(pairs.length===1&&pairs[0].visual===target)continue;
      if(pairs.length===1&&pairs[0].source.parentElement===target&&pairs[0].source._originalText!==undefined)continue;
      const original=sourceText(target);
      pairs.forEach(pair=>{pair.source.remove();splitPairs.splice(splitPairs.indexOf(pair),1);});
      const source=document.createElement('span');source.className='split-source';source.textContent=original;source._originalText=original;
      target.classList.add('split-text');target.prepend(source);splitPairs.push({source,visual:target});
    }
  }
  function sourceText(el) {
    if(el.nodeType===Node.TEXT_NODE)return el.textContent;
    if(el.nodeType!==Node.ELEMENT_NODE)return '';
    if(el.matches('[aria-hidden="true"],.outward,.focus-ghost'))return '';
    // Grid/flex items already have a spoken boundary in the unsplit source.
    const separated=/^(grid|flex)$/.test(getComputedStyle(el).display);
    return [...el.childNodes].map(sourceText).filter(Boolean).join(separated?' ':'');
  }
  function preserveSplitNames(el) {
    const named=new Set();
    for(const node of [el,...el.querySelectorAll('a,h1,h2,h3,time')]){
      for(let parent=node;parent;parent=parent.parentElement){
        if(parent.matches('a,h1,h2,h3,time')&&!parent.closest('[aria-hidden="true"]'))named.add(parent);
      }
    }
    named.forEach(node=>{
      if(!node.hasAttribute('aria-label')&&!node.hasAttribute('aria-labelledby'))node.setAttribute('aria-label',sourceText(node).replace(/\s+/g,' ').trim());
    });
  }
  function replaceSplitText(node,fragment) {
    // Resize can split a visual line again; never duplicate its source text.
    if(node.parentElement.closest('[aria-hidden="true"]')){node.replaceWith(fragment);return;}
    if(/^\s+$/.test(node.textContent))return;
    const visual=document.createElement('span');visual.className='split-visual';visual.setAttribute('aria-hidden','true');visual.append(fragment);
    const pair=document.createElement('span');pair.className='split-text';
    pair.append(splitSource(node.textContent,visual),visual);node.replaceWith(pair);
  }
  function splitDecorativeText(el,className) {
    const yearHeading=el.matches('.year-group h3');
    if(!yearHeading)preserveSplitNames(el);
    const label=el.textContent,content=document.createElement('span');content.className='split-visual split-decorative';content.setAttribute('aria-hidden','true');
    // Keep the date in the visual runs so fitting creates a sibling source time.
    if(yearHeading)content.append(...el.childNodes);else content.textContent=label;
    splitCharacters(content,className);
    const hidden=el.closest('[aria-hidden="true"]');
    if(hidden)el.replaceChildren(content);
    else {el.classList.add('split-text');el.replaceChildren(splitSource(label,content),content);}
  }
  const pendingSplitSourceFits=new Set();
  function deferSplitSourceFit(anchor){
    // Retry once after paint; persistent hidden text waits for a reveal/resize.
    if(pendingSplitSourceFits.has(anchor))return;
    pendingSplitSourceFits.add(anchor);queueSplitSourceFit();
  }
  function textTranslation(node,anchor,cssFor,cache){
    if(node===anchor||!node)return {x:0,y:0};
    if(cache.has(node))return cache.get(node);
    const css=cssFor(node),matrix=(css.transform||'').match(/^matrix(3d)?\((.+)\)$/);
    const values=matrix?matrix[2].split(',').map(Number):[],index=matrix?.[1]?12:4;
    const inherited=textTranslation(node.parentElement,anchor,cssFor,cache),translate=(css.translate||'none').split(/\s+/).map(parseFloat);
    const shift={x:inherited.x+(values[index]||0)+(translate[0]||0),y:inherited.y+(values[index+1]||0)+(translate[1]||0)};
    cache.set(node,shift);return shift;
  }
  function restingTextRect(range){
    const node=range.startContainer.nodeType===Node.TEXT_NODE?range.startContainer.parentElement:range.startContainer;
    const rect=range.getBoundingClientRect();
    const pair=!node.closest('.split-source')&&splitPairs.find(({visual})=>visual.contains(node));
    const shift=pair?textTranslation(node,pair.source.parentElement,getComputedStyle,new Map()):{x:0,y:0};
    return {left:rect.left-shift.x,top:rect.top-shift.y,right:rect.right-shift.x,bottom:rect.bottom-shift.y,width:rect.width,height:rect.height};
  }
  function fitSplitSources() {
    // Keep the visual DOM in charge of layout. Source runs are ordinary inline
    // text, so selection/find never serialize the animated letter boxes.
    coalesceSplitSources();
    const styleCache=new Map(),shiftCache=new Map(),plans=[];
    const cssFor=node=>{if(!styleCache.has(node))styleCache.set(node,getComputedStyle(node));return styleCache.get(node);};
    const shiftFor=(node,anchor)=>textTranslation(node,anchor,cssFor,shiftCache);
    {
      const properties=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontVariantNumeric','fontFeatureSettings','fontKerning','fontVariationSettings','lineHeight','letterSpacing','textTransform'];
      for(const {source,visual} of splitPairs){
        if(!visual.isConnected||visual.closest('.focus-ghost'))continue;
        // Use one owner origin per read phase; source rebuilding may move the
        // viewport's scroll anchor between phases.
        const anchor=source.parentElement;
        let block=visual;
        while(block.parentElement&&cssFor(block).display==='inline')block=block.parentElement;
        const box=anchor.getBoundingClientRect(),origin={left:box.left,top:box.top,width:box.width,height:box.height};
        const localRect=range=>{
          const rect=range.getBoundingClientRect();
          if(rect.width<=0||rect.height<=0)return null;
          const shift=range.startContainer.parentElement?.closest('.split-source')?{x:0,y:0}:shiftFor(range.startContainer.parentElement,anchor);
          return {left:rect.left-origin.left-shift.x,top:rect.top-origin.top-shift.y,right:rect.right-origin.left-shift.x,bottom:rect.bottom-origin.top-shift.y,width:rect.width,height:rect.height};
        };
        const vertical=cssFor(visual).writingMode.startsWith('vertical');
        const rows=[],walker=document.createTreeWalker(visual,NodeFilter.SHOW_TEXT);
        const phraseWrapping=visual.matches('.work h3,.appearance h3,.links a');
        let previousItem=null,unmeasured=false,leadingSpace='';
        while(walker.nextNode()){
          const node=walker.currentNode;
          if(node.parentElement.closest('.split-source,.outward,.focus-ghost'))continue;
          const css=cssFor(node.parentElement),type=Object.fromEntries(properties.map(property=>[property,css[property]])),font=JSON.stringify(type);
          const time=node.parentElement.closest('time');
          // An explicit nowrap phrase owns its inner animated reading units.
          let unit=null;
          if(phraseWrapping)for(let parent=node.parentElement;parent&&parent!==visual;parent=parent.parentElement){
            if(parent.matches('.phrase,.identifier,.text-phrase,.url-part,.link-name'))unit=parent;
          }
          const item=visual.matches('.links a')?node.parentElement.closest('.link-name,.link-url'):null;
          if(previousItem&&item&&item!==previousItem&&rows.length)rows.at(-1).text+=' ';
          if(item)previousItem=item;
          for(let offset=0;offset<node.length;){
            const char=String.fromCodePoint(node.textContent.codePointAt(offset)),range=document.createRange();
            range.setStart(node,offset);range.setEnd(node,offset+char.length);offset+=char.length;
            const rect=localRect(range);
            if(!rect){
              // Collapsed spaces keep their copy text, but never supply geometry.
              if(/^\s$/.test(char)){
                if(rows.length)rows.at(-1).text+=char;else leadingSpace+=char;
              }else unmeasured=true;
              continue;
            }
            const position=vertical?rect.left:rect.top;
            let row=rows.at(-1);
            if(!row||row.font!==font||row.time!==time||(!/^\s$/.test(char)&&(Math.abs(row.position-position)>1||row.unit!==unit))){
              row={position,text:leadingSpace,font,type,unit,time,item,ranges:[],left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom};rows.push(row);leadingSpace='';
            }
            row.text+=char;row.ranges.push(range);
            row.left=Math.min(row.left,rect.left);row.top=Math.min(row.top,rect.top);
            row.right=Math.max(row.right,rect.right);row.bottom=Math.max(row.bottom,rect.bottom);
          }
        }
        if(unmeasured||!rows.length){deferSplitSourceFit(anchor);continue;}
        plans.push({source,anchor,rows,vertical,localRect,origin,inlineSize:vertical?block.clientHeight:block.clientWidth});
      }
      // Measure every visual first, then construct all native source runs.
      for(const plan of plans){
        const {source,rows,inlineSize}=plan;
        source.replaceChildren();
        source._originalText??=rows.map(row=>row.text).join('');
        source.style.inlineSize=`${inlineSize}px`;
        const runs=[];
        for(const [index,row] of rows.entries()){
          const previous=rows[index-1];
          // Separate the name and URL into native line boxes when stacked,
          // so the URL's selection background does not cover the name.
          // Within either string, wbr keeps copy and page find continuous.
          if(previous&&previous.item&&row.item&&previous.item!==row.item&&row.top>=previous.bottom-1)source.append(document.createElement('br'));
          // wbr preserves the copied string; inline-block would add spaces.
          else if(previous&&(previous.unit!==row.unit||Math.abs(previous.position-row.position)>1))source.append(document.createElement('wbr'));
          const run=document.createElement(row.time?'time':'span');run.className='split-source-run';run.textContent=row.text;source.append(run);
          if(row.time){
            run.setAttribute('datetime',row.time.getAttribute('datetime'));
            row.time.setAttribute('aria-hidden','true');
          }
          for(const property of properties)run.style[property]=row.type[property];run._visualRanges=row.ranges;
          runs.push({row,run});
        }
        plan.runs=runs;
      }
      const readOrigins=()=>plans.forEach(plan=>{
        const box=plan.anchor.getBoundingClientRect();plan.origin.left=box.left;plan.origin.top=box.top;
      });
      readOrigins();
      const widths=plans.flatMap(plan=>plan.runs.map(({row,run})=>{
        const range=document.createRange();range.selectNodeContents(run);
        const rect=plan.localRect(range),extent=plan.vertical?row.bottom-row.top:row.right-row.left;
        return {run,spacing:(parseFloat(row.type.letterSpacing)||0)+(extent-(plan.vertical?rect?.height:rect?.width))/[...row.text].length};
      }));
      widths.forEach(({run,spacing})=>{if(Number.isFinite(spacing))run.style.letterSpacing=`${spacing}px`;});
      readOrigins();
      const offsets=plans.map(plan=>({plan,runs:plan.runs.map(({row,run})=>{
        const range=document.createRange();range.selectNodeContents(run);
        const rect=plan.localRect(range);
        return {run,left:rect?row.left-rect.left:NaN,top:rect?row.top-rect.top:NaN};
      })}));
      offsets.forEach(({plan,runs})=>{
        if(runs.some(({left,top})=>!Number.isFinite(left)||!Number.isFinite(top)||Math.abs(left)>plan.origin.width||Math.abs(top)>plan.origin.height)){
          deferSplitSourceFit(plan.anchor);return;
        }
        runs.forEach(({run,left,top})=>{run.style.left=`${left}px`;run.style.top=`${top}px`;});
        pendingSplitSourceFits.delete(plan.anchor);
      });
    }
  }
  let splitSourceTimer=null;
  function queueSplitSourceFit(){
    clearTimeout(splitSourceTimer);
    splitSourceTimer=setTimeout(()=>{splitSourceTimer=null;fitSplitSources();},150);
  }
  // Observe only viewport width, never fitted text or section heights.
  // Font/content changes have explicit invalidation paths below.
  let fittedViewportWidth=root.clientWidth;
  const splitSourceObserver='ResizeObserver'in window?new ResizeObserver(entries=>{
    const width=entries[0].contentRect.width;
    if(Math.abs(width-fittedViewportWidth)<.5)return;
    queueGeometry();
  }):null;
  splitSourceObserver?.observe(root);
  // Rationale §5: keep reading units intact while individual letters find focus.
  function readingPhrases(text) {
    const phrases=[];
    for(const {segment} of new Intl.Segmenter('ja',{granularity:'word'}).segment(text)){
      const previous=phrases.at(-1);
      const shortKana=/^[\u3041-\u3096ー]{1,3}$/.test(segment);
      const latinJoin=previous&&/[A-Za-z0-9_-]$/.test(previous)&&/^[A-Za-z0-9_-]+$/.test(segment);
      const closing=/^[、。，．・：:;!?！？）\]」』]+$/.test(segment);
      if(previous&&!/^\s+$/.test(previous)&&(shortKana||latinJoin||closing))phrases[phrases.length-1]+=segment;
      else phrases.push(segment);
    }
    // A final short noun (e.g. 話) belongs with the preceding verb phrase.
    if(phrases.length>1&&/^[\p{Script=Han}]{1,2}$/u.test(phrases.at(-1))&&/[\u3041-\u3096]$/.test(phrases.at(-2)))phrases[phrases.length-2]+=phrases.pop();
    return phrases;
  }
  function splitCharacters(el,className) {
    preserveSplitNames(el);
    if(typeof Intl.Segmenter!=='function'){
      textNodes(el).forEach(node=>{const fragment=document.createDocumentFragment();fragment.append(document.createTextNode(node.textContent));replaceSplitText(node,fragment);});return;
    }
    let index=0;
    textNodes(el).forEach(node=>{
      const fragment=document.createDocumentFragment();
      readingPhrases(node.textContent).forEach(text=>{
        // A normal space can collapse at a line break; it must never be an animated box.
        if(/^\s+$/.test(text)){fragment.append(document.createTextNode(' '));return;}
        const phrase=document.createElement('span');phrase.className='text-phrase';
        [...text].forEach(char=>{
          const span=document.createElement('span');span.className=className;span.textContent=char;
          span.style.setProperty('--unit-delay',`${Math.min(index++*20,560)}ms`);phrase.append(span);
        });fragment.append(phrase);
      });replaceSplitText(node,fragment);
    });
  }
  document.querySelectorAll('.work h3,.appearance h3').forEach(el=>{el.classList.add('granular-title');splitCharacters(el,'reveal-character');});
  document.querySelectorAll('.work .medium').forEach(el=>{
    preserveSplitNames(el);
    el.classList.add('granular-medium');let index=0;
    textNodes(el).forEach(node=>{
      const fragment=document.createDocumentFragment();
      node.textContent.split(/(\s+)/).filter(Boolean).forEach(word=>{
        if(/^\s+$/.test(word)){fragment.append(document.createTextNode(' '));return;}
        const span=document.createElement('span');span.className='reveal-word';span.textContent=word;
        span.style.setProperty('--unit-delay',`${Math.min(index++*120,720)}ms`);fragment.append(span);
      });replaceSplitText(node,fragment);
    });
  });
  document.querySelectorAll('.link-name').forEach(el=>splitCharacters(el,'focus-character'));
  const urls=[...document.querySelectorAll('.link-url')];
  urls.forEach(el=>{
    preserveSplitNames(el);
    const parts=el.textContent.match(/[^/]+\/?/g)||[];
    const fragment=document.createDocumentFragment();parts.forEach((part,i)=>{
      const span=document.createElement('span');span.className='url-part';span.textContent=part;fragment.append(span);
      if(i<parts.length-1)fragment.append(document.createElement('wbr'));
    });
    replaceSplitText(el.firstChild,fragment);
  });
  const paragraphs=[...document.querySelectorAll('.desc p')];
  paragraphs.forEach(el=>el.classList.add('granular-paragraph'));
  let paragraphWidth=-1;
  function splitLines() {
    const width=paragraphs[0]?.clientWidth||innerWidth;
    if(width===paragraphWidth)return;paragraphWidth=width;
    paragraphs.forEach(el=>{
      preserveSplitNames(el);
      el.querySelectorAll('.reveal-line').forEach(span=>span.replaceWith(...span.childNodes));el.normalize();
      const nodes=textNodes(el),tops=[];
      nodes.forEach(node=>{
        const content=node.textContent,range=document.createRange(),runs=[];
        for(let i=0;i<content.length;i++){
          range.setStart(node,i);range.setEnd(node,i+1);
          const rect=range.getBoundingClientRect?.(),top=Math.round(rect?.top||0);
          let line=tops.findIndex(y=>Math.abs(y-top)<3);if(line<0){line=tops.length;tops.push(top);}
          const last=runs.at(-1);if(last&&last.line===line)last.text+=content[i];else runs.push({line,text:content[i]});
        }
        const fragment=document.createDocumentFragment();runs.forEach(run=>{
          const span=document.createElement('span');span.className='reveal-line';span.textContent=run.text;
          span.style.setProperty('--unit-delay',`${Math.min(run.line*60,540)}ms`);fragment.append(span);
        });replaceSplitText(node,fragment);
      });
    });
  }

  const wireFixture=document.querySelector('.fixture-wires'),wireScene=wireFixture.querySelector('.wire-scene');
  wireFixture.classList.add('motion-owner');
  const wireSvg=wireFixture.querySelector('svg'),wirePath=wireSvg.querySelector('#wire-toc-path'),wireCurrent=wireSvg.querySelector('.wire-current');
  const tocLinks=[...wireSvg.querySelectorAll('a')];
  let wireTextOffsets=[];
  const wireHitAreas=tocLinks.map(link=>{
    // Keep the HTML target inside its SVG link so native hover and accessibility
    // retain the original link; an unrelated overlay would intercept it again.
    const area=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
    area.classList.add('wire-hit-area');area.setAttribute('aria-hidden','true');
    const target=document.createElement('div');target.className='wire-hit-target';
    target.setAttribute('aria-hidden','true');target.setAttribute('tabindex','-1');
    target.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')e.preventDefault();});
    target.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,
        ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey}));
    });
    // Pointer entry/exit already reaches the ancestor SVG link's lamp handlers.
    area.append(target);link.append(area);return{link,area};
  });
  function updateWireHitAreas(measure=false){
    wireHitAreas.forEach(({link,area})=>{
      if(!measure){
        const cached=area._wireBounds;if(cached)area.setAttribute('y',String(cached.y+(wireDisplacement(0,cached.u)-cached.displacement)/cached.scaleY));
        return;
      }
      const label=link.querySelector('tspan'),matrix=label.getScreenCTM?.();
      if(!matrix||!label.getBBox)return;
      const bounds=label.getBBox(),scaleX=Math.hypot(matrix.a,matrix.b),scaleY=Math.hypot(matrix.c,matrix.d);
      if(!scaleX||!scaleY||!bounds.width||!bounds.height){area.setAttribute('width','0');return;}
      const padX=6/scaleX,height=Math.max(28/scaleY,bounds.height+12/scaleY);
      area.setAttribute('x',String(bounds.x-padX));
      area.setAttribute('y',String(bounds.y-(height-bounds.height)/2));
      area.setAttribute('width',String(bounds.width+2*padX));
      area.setAttribute('height',String(height));
      const u=(bounds.x+bounds.width/2-wireFit.left)/(wireFit.anchorX-wireFit.left);
      area._wireBounds={y:bounds.y-(height-bounds.height)/2,scaleY,u,displacement:wireDisplacement(0,u)};
    });
  }
  // Photographic catenary fits and original clamp coordinates are reproduced
  // by .claude/tools/vector-wire-assets.py, from wires-geometry.json.
  const wireDefinitions = [{"id":"wire-1","a":11979.84277526631,"vertexX":1984.3729707574253,"c":12286.426127282313,"leftY":141.85882826561283,"rightY":302.2333161828592,"deltaY":160.37448791724637,"sagRatio":0.023388049332509677,"rightSlope":-0.020838762129542738,"rmse":0.912773661336016},{"id":"wire-2","a":13403.616823752876,"vertexX":2020.2703352125334,"c":13869.46312739849,"leftY":313.30444995536527,"rightY":463.88741449728184,"deltaY":150.58296454191657,"sagRatio":0.020893342152405545,"rightSlope":-0.015946346797398876,"rmse":0.6034053110717341},{"id":"wire-3","a":12570.766991530898,"vertexX":1954.7267014568442,"c":13198.366693614236,"leftY":475.31536741384116,"rightY":622.9477000240817,"deltaY":147.6323326102405,"sagRatio":0.022278234708563598,"rightSlope":-0.022217918132780314,"rmse":0.6249219241900195},{"id":"wire-4","a":5406.784769707116,"vertexX":1553.4249373397795,"c":6212.262979120535,"leftY":580.7814036973396,"rightY":748.8046782493819,"deltaY":168.02327455204238,"sagRatio":0.052000973274694696,"rightSlope":-0.12620692804346434,"rmse":3.4944932294913165}];
  const wirePartDefinitions = [{"name":"clamp-1-325","strand":0,"fraction":0.14547896150402864,"width":45,"height":45,"anchorX":22,"anchorY":8.19569256461412},{"name":"clamp-2-364","strand":1,"fraction":0.1629364368845121,"width":45,"height":46,"anchorX":22,"anchorY":8.865054820753357},{"name":"clamp-3-387","strand":2,"fraction":0.17323187108325871,"width":45,"height":46,"anchorX":22,"anchorY":9.496689987599552},{"name":"clamp-3-1848","strand":2,"fraction":0.8272157564905999,"width":45,"height":44,"anchorX":22,"anchorY":9.148020999630376},{"name":"clamp-4-945","strand":3,"fraction":0.42300805729632945,"width":45,"height":48,"anchorX":22,"anchorY":10.361627547696571}];
  const svgNS='http://www.w3.org/2000/svg';
  const wirePaths=[...wireSvg.querySelectorAll('.wire-strand')];
  const wireParts=wirePartDefinitions.map(def=>{
    const node=document.createElementNS(svgNS,'g');node.classList.add('wire-part');
    for(const mode of ['day','night']){
      const image=document.createElementNS(svgNS,'image');
      image.classList.add(`mode-${mode}`);
      modeLayers.add(image);
      image.setAttribute('data-href',`images/fixtures/wire-parts/${def.name}${mode==='night'?'-night':''}.webp?v=${IMAGE_VERSION}`);
      image.setAttribute('x',String(-def.anchorX));image.setAttribute('y',String(-def.anchorY));
      image.setAttribute('width',String(def.width));image.setAttribute('height',String(def.height));
      node.append(image);
    }
    wireSvg.querySelector('.wire-parts').append(node);return{...def,node};
  });
  const wireSprings=wireDefinitions.map((_,i)=>new Spring(.42+i*.026,.05,8));
  const wireWind=wireSprings.map((spring,i)=>({elapsed:0,next:1+i*.7,quietUntil:0}));
  let wireScale=1,wireWidth=0,wireHeight=0;
  let wireFit={visibleCount:2,anchorX:0,anchorY:0,left:-16,bandTop:0,bandBottom:0,curves:[],tocStart:32};
  // Predecoded poses: flap changes touch only opacity, never src or filters.
  const birdLayer=document.createElement('div');birdLayer.className='wire-birds';birdLayer.setAttribute('aria-hidden','true');wireFixture.append(birdLayer);
  const perchBirds=[];
  // Both spans use the same material curves, string modes and perch rules.
  const projectSpan={id:'projects',owner:wireFixture,svg:wireSvg,paths:wirePaths,birds:perchBirds,birdLayer,
    springs:wireSprings,wind:wireWind,clock:0,lastReturn:-10,get fit(){return wireFit;},get scale(){return wireScale;}};
  const finalBand=document.createElement('div');finalBand.className='final-wire-band';finalBand.setAttribute('aria-hidden','true');
  const finalSvg=document.createElementNS(svgNS,'svg');finalSvg.classList.add('wire-toc','final-wire-svg');finalBand.append(finalSvg);
  const finalPaths=wireDefinitions.slice(0,3).map((_,i)=>{const path=document.createElementNS(svgNS,'path');path.id=`final-wire-${i+1}`;path.classList.add('wire-strand');finalSvg.append(path);return path;});
  const finalMoonlightPaths=finalPaths.map(()=>{const path=document.createElementNS(svgNS,'path');path.classList.add('final-wire-moonlight');finalSvg.append(path);return path;});
  const finalBirdLayer=document.createElement('div');finalBirdLayer.className='wire-birds';finalBand.append(finalBirdLayer);
  const closingScene=document.querySelector('.closing-scene');closingScene.append(finalBand);
  const finalPole=document.createElement('div');finalPole.className='finale-pole';finalPole.setAttribute('aria-hidden','true');closingScene.append(finalPole);
  const finalPolePhotos=['day','night'].map(mode=>{
    const image=document.createElement('img');image.alt='';image.decoding='async';image.className=`mode-${mode}`;
    image.dataset.src=`images/fixtures/pole${mode==='night'?'-finale-night':''}.webp?v=${IMAGE_VERSION}`;image.width=3000;image.height=1500;finalPole.append(image);return image;
  });
  const finalSpan={id:'finale',owner:finalBand,svg:finalSvg,paths:finalPaths,birds:[],birdLayer:finalBirdLayer,
    springs:wireDefinitions.slice(0,3).map((_,i)=>new Spring(.42+i*.026,.05,3)),
    wind:wireDefinitions.slice(0,3).map((_,i)=>({elapsed:0,next:1+i*.7,quietUntil:0})),
    scale:1,fit:{visibleCount:3,anchorX:0,anchorY:0,left:-16,curves:[]},painted:[],clock:0,lastReturn:-10};
  const spans=[projectSpan,finalSpan];
  function spanVisible(span){
    const box=geometry.get(span.owner);return !!box&&box.top<scrollY+innerHeight&&box.top+box.height>scrollY;
  }
  function spritePoses(holder,folder,names){
    return names.map(name=>{
      const image=document.createElement('img');image.className='bird-pose';image.alt='';image.decoding='async';
      image.dataset.src=`images/fixtures/${folder}/${name}.webp?v=${IMAGE_VERSION}`;image.dataset.srcset=`images/fixtures/${folder}/${name}.webp?v=${IMAGE_VERSION} 1x, images/fixtures/${folder}/${name}-2x.webp?v=${IMAGE_VERSION} 2x`;
      holder.append(image);if(sceneAssetsStarted){registerAsset(image);refreshAsset(image);}return image;
    });
  }
  function showPose(bird,index){
    if(bird.pose===index)return;
    bird.pose=index;bird.poses.forEach((node,i)=>opacity(node,i===index?1:0));
  }
  function fitBirds(span=projectSpan){
    const count=innerWidth>=961?3:2;
    while(span.birds.length>count)span.birds.pop().node.remove();
    while(span.birds.length<count){
      const node=document.createElement('span');node.className='wire-bird';span.birdLayer.append(node);
      const poses=spritePoses(node,'birds',['sparrow-perch-left','sparrow-perch-turn','sparrow-perch-tail','sparrow-takeoff','sparrow-flap-up','sparrow-flap-down']);
      span.birds.push({span,node,poses,pose:-1,state:'perched',nextPose:span.clock+randomBetween(3,8),hopAt:-10});
    }
    const base=span.owner.getBoundingClientRect();
    const labels=[...span.svg.querySelectorAll('.wire-toc-full text,.wire-toc-compact')].filter(n=>n.getClientRects().length&&getComputedStyle(n).display!=='none').map(n=>n.getBoundingClientRect());
    if(span===finalSpan){const scene=layoutBox(closing);labels.push(...finaleTextBoxes.map(b=>({left:b.left+scene.left,right:b.right+scene.left,top:b.top+scene.top-scrollY,bottom:b.bottom+scene.top-scrollY})));}
    const pole=(span===projectSpan?span.owner.querySelector('.pole-photo'):finalPole).getBoundingClientRect();
    // At 960px and below the final wires run just under the links; a 60px radius from the feet left
    // only the spot behind the lamp. There the sprite (35x25 above its feet) keeps 10px from text and the lamp.
    const blockers=span===finalSpan&&innerWidth<=960?[...labels,finaleLamp.getBoundingClientRect()]:null;
    const candidates=[];
    for(let wire=0;wire<span.fit.visibleCount;wire++)for(let j=5;j<90;j++){
      const u=j/100,p=projectedWirePoint(wire,u,0,span),x=p.x+base.left,y=p.y+base.top;
      const distance=b=>Math.hypot(Math.max(b.left-x,0,x-b.right),Math.max(b.top-y,0,y-b.bottom));
      const blocked=blockers?blockers.some(b=>x+27.5>=b.left&&x-27.5<=b.right&&y+10>=b.top&&y-35<=b.bottom):labels.some(b=>distance(b)<60);
      if(x<20||x>innerWidth-20||x>(span===projectSpan?pole.left+pole.width*.745:pole.left)-70||blocked)continue;
      candidates.push({wire,u,x:p.x,y:p.y});
    }
    // Farthest separated safe sites, with preference for the upper wire.
    const chosen=[];
    span.birds.forEach((bird,index)=>{
      const target=innerWidth*(index+1)/(count+1)-base.left;
      const options=candidates.filter(p=>chosen.every(c=>Math.hypot(p.x-c.x,p.y-c.y)>=40));
      options.sort((a,b)=>(Math.abs(a.x-target)+a.wire*8)-(Math.abs(b.x-target)+b.wire*8));
      const site=options[0];bird.placed=!!site;
      if(site){Object.assign(bird,site);chosen.push(site);showPose(bird,bird.state==='perched'?0:4);}
      else opacity(bird.node,0);
    });
    paintBirds(0,span);
  }
  function pluckBirdWire(bird){
    const span=bird.span;
    const spring=span.springs[bird.wire],weight=randomBetween(.6,1.2);
    // The fundamental mode at the actual perch gets the requested displacement.
    spring.impulse(weight*spring.omega/(Math.sin(Math.PI*bird.u)*.926));
    span.wind[bird.wire].quietUntil=span.wind[bird.wire].elapsed+3;
  }
  function launchBird(bird){
    const span=bird.span;
    if(reduced.matches||nightMode()||bird.state!=='perched'||!bird.placed)return;
    const p=projectedWirePoint(bird.wire,bird.u,null,span),cached=geometry.get(span.owner),box={left:cached.left,top:cached.top-scrollY};
    bird.x=p.x;bird.y=p.y;bird.flightAt=span.clock;bird.duration=randomBetween(1.5,2.5);bird.speed=randomBetween(220,320);
    // Choose the nearer edge, rising on the way out.
    bird.direction=p.x+box.left<innerWidth/2?-1:1;
    const sideDistance=bird.direction<0?p.x+box.left:innerWidth-p.x-box.left;
    const topDistance=Math.max(0,p.y+box.top);
    bird.upward=topDistance<sideDistance;
    const distance=bird.upward?topDistance:sideDistance;
    bird.speed=Math.max(bird.speed,Math.min(320,(distance+50)/2.1));
    bird.duration=Math.max(1.5,Math.min(2.5,(distance+50)/bird.speed+.2));
    bird.returnAt=span.clock+bird.duration+randomBetween(20,45);bird.state='leaving';pluckBirdWire(bird);
  }
  function nearBirds(event,radius,span=projectSpan){
    if(reduced.matches||nightMode()||!spanVisible(span))return;
    const box=span.owner.getBoundingClientRect();
    span.birds.forEach(bird=>{
      if(!bird.placed||bird.state!=='perched')return;
      const p=projectedWirePoint(bird.wire,bird.u,null,span);
      if(Math.hypot(event.clientX-box.left-p.x,event.clientY-box.top-p.y)<radius)launchBird(bird);
    });
  }
  // Blank band space receives events too; decorative birds never receive them.
  document.querySelector('#projects .wire-band').addEventListener('pointermove',event=>{if(innerWidth>=961&&event.pointerType!=='touch')nearBirds(event,70);},{passive:true});
  document.querySelector('#projects .wire-band').addEventListener('pointerup',event=>{if(innerWidth<=960&&event.pointerType==='touch')nearBirds(event,50);},{passive:true});
  function paintBirds(delta,span=projectSpan){
    if(!reduced.matches&&!spanVisible(span))return;
    span.clock+=delta;
    const exposure=reduced.matches?(nightMode()?0:1):1-nightMix();
    span.birds.forEach(bird=>{
      if(!bird.placed)return;
      if(reduced.matches){bird.state='perched';bird.hopAt=-10;showPose(bird,0);}
      if(exposure===0){opacity(bird.node,0);bird.state='perched';return;}
      const p=projectedWirePoint(bird.wire,bird.u,null,span);let x=p.x,y=p.y;
      if(!nightMode()&&bird.state==='away'&&span.clock>=bird.returnAt&&span.clock-span.lastReturn>=3){bird.state='returning';bird.flightAt=span.clock;bird.duration=2;span.lastReturn=span.clock;}
      if(bird.state==='perched'){
        if(!reduced.matches&&!nightMode()&&span.clock>=bird.nextPose){
          showPose(bird,(bird.pose+1+Math.floor(randomBetween(0,2)))%3);bird.nextPose=span.clock+randomBetween(3,8);
          if(Math.random()<.35)bird.hopAt=span.clock;
        }
        const hop=(span.clock-bird.hopAt)/.12;if(hop>=0&&hop<1)y-=2*Math.sin(hop*Math.PI);
      }else if(bird.state==='leaving'){
        const age=span.clock-bird.flightAt;
        x=bird.x+bird.direction*bird.speed*Math.max(0,age-.12)*(bird.upward?.24:.96);
        y=bird.y-22*Math.min(1,age/.12)-bird.speed*((bird.upward?.96:.16)*age+.025*age*age);
        showPose(bird,age<.12?3:4+Math.floor(age*20)%2);
        if(age>=bird.duration){bird.state='away';opacity(bird.node,0);return;}
      }else if(bird.state==='returning'){
        const age=span.clock-bird.flightAt,q=clamp(age/bird.duration),remaining=(1-q)**3;
        x-=bird.direction*180*remaining;y-=100*remaining;
        showPose(bird,q<.7?5:4+Math.floor(age*20)%2);
        if(q===1){bird.state='perched';showPose(bird,0);bird.nextPose=span.clock+randomBetween(3,8);pluckBirdWire(bird);}
      }else{opacity(bird.node,0);return;}
      bird.lean=bird.state==='perched'?-windStrength()*(3+bird.u*3):0;
      opacity(bird.node,exposure);transform(bird.node,`translate(${(x-17.5).toFixed(3)}px,${(y-25).toFixed(3)}px) rotate(${bird.lean.toFixed(3)}deg)`);
    });
  }
  function catenary(span,delta,sagRatio){
    // Solve actual sag below the chord, including unequal support heights.
    // Changing tension moves the vertex without squashing any coordinates.
    let lo=.00001,hi=1;
    for(let j=0;j<36;j++){
      const z=(lo+hi)/2;
      const a=span/(2*z),q=Math.asinh(-delta/(2*a*Math.sinh(z)));
      const u=(Math.asinh(-delta/span)-q+z)/(2*z);
      const sag=a*(Math.cosh(q-z)-Math.cosh(q-z+2*z*u))-delta*u;
      if(sag/span<sagRatio)lo=z;else hi=z;
    }
    const z=(lo+hi)/2,a=span/(2*z),q=Math.asinh(-delta/(2*a*Math.sinh(z)));
    return{a,z,q,delta,sagRatio};
  }
  function wireRestY(i,u,span=projectSpan){
    const curve=span.fit.curves[i],rightY=span.fit.anchorY+(wireDefinitions[i].rightY-wireDefinitions[0].rightY)*span.scale;
    if(u===1)return rightY;
    return rightY-curve.delta+curve.a*(Math.cosh(curve.q-curve.z)-Math.cosh(curve.q-curve.z+2*curve.z*u));
  }
  function wireDisplacement(i,u,span=projectSpan){
    return u===0||u===1?0:span.springs[i].x*Math.sin(Math.PI*u);
  }
  function projectedWirePoint(i,u,displacement=null,span=projectSpan){
    return{x:span.fit.left+(span.fit.anchorX-span.fit.left)*u,y:wireRestY(i,u,span)+(displacement??wireDisplacement(i,u,span))};
  }
  function wireTangent(i,u,scene=projectSpan){
    const curve=scene.fit.curves[i],span=scene.fit.anchorX-scene.fit.left;
    return -Math.sinh(curve.q-curve.z+2*curve.z*u)+scene.springs[i].x*Math.PI/span*Math.cos(Math.PI*u);
  }
  function wirePathData(i,rest=false,scene=projectSpan){
    // 32 intervals / 33 material points. Cubic Hermite segments keep the
    // catenary and the fundamental string mode smooth, including at the ends.
    const points=Array.from({length:33},(_,j)=>projectedWirePoint(i,j/32,rest?0:null,scene));
    let d=`M ${points[0].x.toFixed(4)} ${points[0].y.toFixed(4)}`;
    const step=(scene.fit.anchorX-scene.fit.left)/32;
    const slope=u=>{
      return rest?-Math.sinh(scene.fit.curves[i].q-scene.fit.curves[i].z+2*scene.fit.curves[i].z*u):wireTangent(i,u,scene);
    };
    for(let j=1;j<points.length;j++){
      const a=points[j-1],b=points[j];
      d+=` C ${(a.x+step/3).toFixed(4)} ${(a.y+slope((j-1)/32)*step/3).toFixed(4)} ${(b.x-step/3).toFixed(4)} ${(b.y-slope(j/32)*step/3).toFixed(4)} ${b.x.toFixed(4)} ${b.y.toFixed(4)}`;
    }
    return d;
  }
  let wirePainted=[];
  function drawWires(force=false){
    if(!wireWidth||!wireFit.curves.length)return;
    if(!force&&wireSprings.slice(0,wireFit.visibleCount).every((spring,i)=>Math.abs(spring.x-(wirePainted[i]??Infinity))<.05))return;
    wirePainted=wireSprings.map(spring=>spring.x);
    wirePaths.forEach((path,i)=>{
      path.style.display=i<wireFit.visibleCount?'':'none';
      if(i>=wireFit.visibleCount)return;
      path.setAttribute('d',wirePathData(i));
    });
    wireParts.forEach(part=>{
      part.node.style.display=part.strand<wireFit.visibleCount?'':'none';
      if(part.strand>=wireFit.visibleCount)return;
      const point=projectedWirePoint(part.strand,part.fraction);
      const angle=Math.atan(wireTangent(part.strand,part.fraction))*180/Math.PI;
      // The cutout already contains the source wire's tangent orientation.
      const def=wireDefinitions[part.strand],nativeX=part.fraction*2234;
      const sourceAngle=Math.atan(-Math.sinh((nativeX-def.vertexX)/def.a))*180/Math.PI;
      part.node.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(${angle-sourceAngle}) scale(${wireScale})`);
    });
    if(wireTextOffsets.length)tocLinks.forEach((link,i)=>{
      const path=link.querySelector('textPath'),offset=String(wireFit.tocStart+wireTextOffsets[i]);
      if(path.getAttribute('startOffset')!==offset)path.setAttribute('startOffset',offset);
    });
    updateWireHitAreas();
  }
  function stepWires(delta,span=projectSpan){
    span.wind.forEach((wind,i)=>{
      wind.elapsed+=delta;
      if(wind.elapsed>=wind.next){
        if(wind.elapsed>=wind.quietUntil)span.springs[i].impulse(randomBetween(1.8,3)*span.springs[i].omega*(Math.random()<.5?-1:1));
        wind.next=wind.elapsed+randomBetween(4,8);
      }
      // A transverse aerodynamic force drives the existing string oscillator.
      // Higher drag while loaded keeps its fitted clearance envelope bounded.
      const spring=span.springs[i],gust=windStrength(),target=gust*Math.min(3.9,spring.limit*.65)*(1+.12*Math.sin(windState.elapsed*1.8+i));
      const drag=gust*2*spring.omega*.8;
      spring.step(delta,spring.omega**2*target-drag*spring.v);
    });
    if(span===projectSpan)drawWires();else drawFinalWires();
  }
  function reactWires(){
    if(reduced.matches)return;
    wireSprings.forEach((spring,i)=>{spring.impulse((8-i*.2)*spring.omega);wireWind[i].quietUntil=wireWind[i].elapsed+4;});
  }
  wireFixture.addEventListener('pointerenter',e=>{
    const hit=document.elementFromPoint(e.clientX,e.clientY);
    if(e.pointerType!=='touch'&&hit?.closest('.wire-strand,.pole-photo')&&!hit.closest('.wire-toc a'))reactWires();
  });
  wireFixture.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.target.closest('.wire-strand,.pole-photo')&&!e.target.closest('.wire-toc a'))reactWires();});
  tocLinks.forEach(a=>a.addEventListener('focus',reactWires));
  tocLinks.forEach((a,i)=>{
    const target=document.getElementById(a.getAttribute('href').slice(1)),targetLamp=lamps.find(l=>l.el===target);
    createLamp(a,{strength:.65,interactive:true,paint:()=>{
      const state=lamps.find(l=>l.el===a),active=state.feedback>.05;
      a.classList.toggle('is-lit',active);
      if(targetLamp&&active)targetLamp.idleUntil=time+.12;
    }});
  });
  const dust=document.querySelector('.sun-dust'),shadow=document.querySelector('.passing-shadow');
  const dustParticles=Array.from({length:15},()=>{
    const el=document.createElement('i'),size=randomBetween(1,2);
    el.style.cssText=`left:${randomBetween(3,97)}%;top:${randomBetween(5,95)}%;width:${size}px;height:${size}px;`;
    dust.append(el);return{el,elapsed:0,duration:randomBetween(40,80),phase:randomBetween(0,Math.PI*2),opacity:randomBetween(.25,.5)};
  });

  const revealTargets=[...document.querySelectorAll('.identity-name,.profile,.sec-head h2,.sky-window,.work h3,.work .medium,.work .lead,.desc p,.appearance h3,.appearance p,.year-group h3,.events > li,.links li,.footer-row,.hero-photo,.hero-caption,.cue-entrance')];
  revealTargets.forEach(node=>{node.dataset.reveal='';const order=Math.max(0,[...node.parentElement.children].indexOf(node));node.style.setProperty('--reveal-delay',`${Math.min(order,3)*50}ms`);});
  function reveal(node,immediately=false){
    const entered=!node.classList.contains('is-visible'),steady=immediately||reduced.matches;
    node.classList.toggle('is-immediate',steady);node.classList.add('is-visible');
    if(!entered||steady)return;
    const owner=node.closest('section,footer')||hero;
    if(node.classList.contains('granular-title'))node.querySelectorAll('.reveal-character').forEach(char=>focusPull(char,owner,420,parseFloat(char.style.getPropertyValue('--unit-delay'))||0));
    else if(node.classList.contains('granular-paragraph'))node.querySelectorAll('.reveal-line').forEach(line=>focusPull(line,owner,420,parseFloat(line.style.getPropertyValue('--unit-delay'))||0,0));
    else if(node.matches('.events > li'))[...node.children].filter(child=>child.matches('time,.event-copy')).forEach(child=>focusPull(child,owner,640,80));
    else if(!node.classList.contains('granular-medium'))focusPull(node,owner,durations.focus,parseFloat(node.style.getPropertyValue('--reveal-delay'))||0);
  }
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const node=entry.target;
      if(entry.isIntersecting){inView.add(node);node.classList.add('in-view');}else{inView.delete(node);node.classList.remove('in-view');}
      photos.filter(p=>p.node===node).forEach(p=>p.visible=entry.isIntersecting);
      lamps.filter(l=>l.el===node).forEach(l=>l.visible=entry.isIntersecting);
      if(node.hasAttribute('data-reveal')){
        if(entry.intersectionRect.height>=Math.min(entry.boundingClientRect.height*.08,innerHeight*.08))reveal(node);
        else if(!entry.isIntersecting&&entry.boundingClientRect.top>=innerHeight){
          node.classList.remove('is-visible','is-immediate');
        }
      }
    });syncMotion();
  },{threshold:[0,.08]}):null;
  owners.forEach(node=>node.classList.add('motion-owner'));
  const observed=new Set([signal,wireFixture,document.querySelector('.cloud-parallax'),...owners,...photos.map(p=>p.node),...lamps.map(l=>l.el),...revealTargets]);
  observed.forEach(node=>observer?.observe(node));
  // A scene's photographs remain drawable even after their compositor hints
  // are released. Only transient effects may be hidden while it sleeps.
  hero.querySelectorAll('.hero-sky,.hero-clouds,.hero-lamp,.hero-moon').forEach(node=>node.classList.add('scene-base'));
  closing.querySelectorAll('.finale-sky,.cloud-parallax,.finale-low-clouds,.finale-lamp').forEach(node=>node.classList.add('scene-base'));
  hero.querySelectorAll('.lantern-light,.hero-mist,.scene-sun,.night-stars,.hero-contrails,.day-lamp-glow,.scene-air,.day-lamp-halo')
    .forEach(node=>node.classList.add('top-decoration'));
  const renderObserver='IntersectionObserver'in window?new IntersectionObserver(entries=>{
    entries.forEach(entry=>entry.target.classList.toggle('render-dormant',!entry.isIntersecting));
  },{rootMargin:'256px 0px'}):null;
  photos.filter(({node})=>!hero.contains(node)&&!closing.contains(node)).forEach(({node})=>{
    if(node.matches('a,button'))return;
    node.setAttribute('aria-hidden','true');renderObserver?.observe(node);
  });

  function fitHeroTitle() {
    hero.style.removeProperty('--hero-name-size');
    const name=document.querySelector('.hero-name'),title=hero.querySelector('h1'),probe=document.createElement('span');
    probe.textContent=sourceText(name);probe.style.cssText=`position:absolute;visibility:hidden;writing-mode:horizontal-tb;letter-spacing:${portrait.matches?'.12em':'.06em'};white-space:nowrap;font:inherit`;title.append(probe);
    const size=parseFloat(getComputedStyle(title).fontSize),width=probe.getBoundingClientRect().width;
    const available=portrait.matches?hero.clientHeight*.60:title.clientWidth-2;probe.remove();
    if(available>0&&width>0&&(portrait.matches||width>available))hero.style.setProperty('--hero-name-size',`${size*available/width}px`);
  }
  function fitSkyWindows() {
    const windows=[...document.querySelectorAll('.sky-window')];
    if(innerWidth<=1100){
      windows.forEach(node=>['--window-left','--window-width','--window-height'].forEach(key=>node.style.removeProperty(key)));
      return;
    }
    // All labels share one column; use the greatest right edge in that column.
    const labelRight=Math.max(...[...document.querySelectorAll('.sec-head :is(.jp,.en)')].map(node=>{
      const head=node.closest('.sec-head').getBoundingClientRect();
      return node.getBoundingClientRect().right-head.left;
    }));
    const left=labelRight+24;
    const available=Math.min(...windows.map(node=>{
      const head=node.closest('.sec-head'),section=node.closest('section');
      const body=section.querySelector('.sec-body').getBoundingClientRect(),heading=head.getBoundingClientRect();
      return body.left<=heading.left+1?96:body.left-heading.left-left-24;
    }));
    const width=Math.max(96,Math.min(128,available)),height=width*184/128;
    windows.forEach(node=>{
      node.style.setProperty('--window-left',`${left}px`);
      node.style.setProperty('--window-width',`${width}px`);
      node.style.setProperty('--window-height',`${height}px`);
    });
  }
  function fitWires() {
    const projects=document.querySelector('#projects'),pole=wireFixture.querySelector('.pole-photo');
    const band=projects.querySelector('.wire-band'),height=innerWidth>=961?150:96;
    const gap=parseFloat(getComputedStyle(projects).getPropertyValue('--gap-section'))|| (innerWidth>=961?128:72);
    const targetTop=layoutBox(document.querySelector('#profile .profile')).bottom+gap;
    const projectRect=projects.getBoundingClientRect(),mobile=innerWidth<=1100;
    let right=mobile?parseFloat(getComputedStyle(projects).paddingRight):24;
    // Pole dimensions depend on the device, independently of the span length.
    // Only catenary tension and the number of strands are fitted to this gap.
    let poleWidth=mobile?Math.min(innerWidth*.95,innerWidth<=720?270:innerWidth<=960?240:480):440;
    wireScale=poleWidth/3000;
    wireFixture.style.cssText=`left:${-band.getBoundingClientRect().left-16}px;right:auto;top:0;width:${innerWidth+32}px;height:${height}px;aspect-ratio:auto`;
    wireWidth=innerWidth+32;wireHeight=height;
    wireSvg.setAttribute('viewBox',`0 0 ${wireWidth} ${wireHeight}`);
    wireSvg.style.setProperty('--wire-font-size','14px');
    wireSvg.querySelectorAll('text').forEach(el=>el.setAttribute('dy','-7'));
    wireCurrent.setAttribute('r','4');
    // Hidden full/compact labels cannot be measured reliably. Plain SVG probes
    // inherit the same typography and never change the displayed mode to measure.
    const probes=document.createElementNS(svgNS,'g');probes.style.visibility='hidden';
    const measureLabel=(label,full=false)=>{
      const text=document.createElementNS(svgNS,'text');text.textContent=label;
      if(full)text.style.whiteSpace='pre';probes.append(text);return text;
    };
    const fullProbes=tocLinks.map(link=>measureLabel(link.querySelector('textPath').textContent,true));
    const compactLabel=wireSvg.querySelector('.wire-toc-compact');
    const compactProbe=measureLabel(compactLabel.textContent),fontProbe=measureLabel('国Mgy');
    wireSvg.append(probes);
    let length=0;
    wireTextOffsets=fullProbes.map(text=>{const offset=length;length+=text.getComputedTextLength();return offset;});
    const compactLength=compactProbe.getComputedTextLength(),labelHeight=Math.max(14,fontProbe.getBBox().height);
    probes.remove();
    const left=-16;
    let anchorX=innerWidth+16-right-poleWidth*(1-2234/3000),span=anchorX-left;
    const fullTocX=Math.max(32,projectRect.left+32,left+span*.18);
    const compact=mobile||!tocLinks.length||length>anchorX-fullTocX-24;
    wireFixture.classList.toggle('toc-compact',compact);
    const labelLength=compact?compactLength:length;
    const tocX=compact?Math.max(32,projectRect.left+32,left+span*.4):fullTocX;
    const candidate=(tension,count)=>{
      const curves=wireDefinitions.map(def=>catenary(span,def.deltaY*wireScale,Math.max(.015,Math.min(.04,def.sagRatio*tension))));
      let min=Infinity,max=-Infinity,minGap=Infinity;
      for(let j=0;j<=256;j++){
        const u=j/256,x=left+span*u,ys=[];
        for(let i=0;i<count;i++){
          const curve=curves[i],delta=(wireDefinitions[i].rightY-wireDefinitions[0].rightY)*wireScale;
          const y=delta-curve.delta+curve.a*(Math.cosh(curve.q-curve.z)-Math.cosh(curve.q-curve.z+2*curve.z*u));
          ys.push(y);
          const wave=8*Math.sin(Math.PI*u),radius=i===3?.75:mobile?.55:.65;
          min=Math.min(min,y-wave-radius);max=Math.max(max,y+wave+radius);
          if(i===0&&x>=tocX-8&&x<=tocX+labelLength+24)min=Math.min(min,y-wave-labelHeight-9);
        }
        ys.slice(1).forEach((y,i)=>minGap=Math.min(minGap,y-ys[i]));
      }
      wirePartDefinitions.filter(part=>part.strand<count).forEach(part=>{
        const curve=curves[part.strand],u=part.fraction;
        const y=(wireDefinitions[part.strand].rightY-wireDefinitions[0].rightY)*wireScale-curve.delta+curve.a*(Math.cosh(curve.q-curve.z)-Math.cosh(curve.q-curve.z+2*curve.z*u));
        max=Math.max(max,y+8*Math.sin(Math.PI*u)+(part.height-part.anchorY+8)*wireScale);
      });
      return{visibleCount:count,anchorX,anchorY:1-min,left,bandTop:0,bandBottom:height,curves,tocStart:tocX-left,
        extent:max-min+2,minGap,tension};
    };
    const fitCount=count=>{
      let lo=0,hi=1;
      if(candidate(lo,count).extent>height)return null;
      for(let j=0;j<32;j++){
        const mid=(lo+hi)/2;
        if(candidate(mid,count).extent<=height)lo=mid;else hi=mid;
      }
      return candidate(lo,count);
    };
    const baseCount=innerWidth<=960?2:3;
    wireFit=fitCount(baseCount);
    // Keep the minimum strands and the height cap even beyond ordinary ratios.
    // Shorten the physical span and move its upright support; never squash y.
    for(let attempt=0;!wireFit&&attempt<32;attempt++){
      poleWidth*=.9;wireScale=poleWidth/3000;span*=.9;anchorX=left+span;
      right=innerWidth+16-anchorX-poleWidth*(1-2234/3000);
      wireFit=fitCount(baseCount);
    }
    wireFit??=candidate(0,baseCount);
    const extra=fitCount(baseCount+1);
    if(extra&&extra.minGap>3.1)wireFit=extra;
    // Independent modes cannot merge adjacent wires even under simultaneous wind.
    const limit=Math.max(0,Math.min(8,(wireFit.minGap-3.1)/2));
    wireSprings.forEach(spring=>{
      const gain=spring.limit>0?Math.min(1,limit/spring.limit):0;
      spring.x*=gain;spring.v*=gain;spring.limit=limit;
    });
    wirePaths.slice(0,wireFit.visibleCount).forEach((path,i)=>path.dataset.restD=wirePathData(i,true));
    pole.style.cssText=`left:auto;right:${right+16}px;top:${wireFit.anchorY-wireDefinitions[0].rightY*wireScale}px;width:${poleWidth}px;height:${poleWidth*.5}px`;
    drawWires(true);
    // Arc length, rather than x, positions textPath offsets along the same path.
    const arcAtX=x=>{
      let lo=0,hi=wirePath.getTotalLength();
      for(let j=0;j<24;j++){const mid=(lo+hi)/2;if(wirePath.getPointAtLength(mid).x<x)lo=mid;else hi=mid;}
      return(lo+hi)/2;
    };
    wireFit.tocStart=arcAtX(tocX);
    compactLabel.querySelector('textPath').setAttribute('startOffset',String(wireFit.tocStart));
    drawWires(true);
    // Measure resting glyphs, so resize never accumulates animation displacement.
    const xs=wireSprings.map(spring=>spring.x);
    wireSprings.forEach(spring=>spring.x=0);drawWires(true);
    const labels=compact?[compactLabel]:tocLinks.map(link=>link.querySelector('text'));
    const tocTop=Math.min(...labels.map(label=>label.getBoundingClientRect().top));
    const bandRect=band.getBoundingClientRect();
    const shift=targetTop-(tocTop+scrollY);
    band.style.marginTop=`${(parseFloat(band.style.marginTop)||0)+shift}px`;
    const bandHeight=Math.ceil(wireFit.extent);
    band.style.height=`${bandHeight}px`;wireFixture.style.height=`${bandHeight}px`;
    wireHeight=bandHeight;wireSvg.setAttribute('viewBox',`0 0 ${wireWidth} ${wireHeight}`);
    wireFit.bandTop=bandRect.top+scrollY+shift;wireFit.bandBottom=wireFit.bandTop+bandHeight;
    // Hide the unused lower support area when the service strand is absent.
    pole.dataset.wireCount=String(wireFit.visibleCount);
    pole.style.clipPath=`polygon(74.5% 0,100% 0,100% 100%,86% 100%,86% ${wireFit.visibleCount===2?38:wireFit.visibleCount===3?48:100}%,74.5% ${wireFit.visibleCount===2?38:wireFit.visibleCount===3?48:100}%)`;
    wireSprings.forEach((spring,i)=>spring.x=xs[i]);drawWires(true);
    tocLinks.forEach((a,i)=>a.dataset.wirePosition=String((i+.5)/tocLinks.length));
    fitBirds();updateWireHitAreas(true);
  }
  function layoutBox(node){
    if(!('offsetTop'in node)){
      const box=node.getBoundingClientRect();return {left:box.left,top:box.top+scrollY,width:box.width,height:box.height,right:box.right,bottom:box.bottom+scrollY};
    }
    let left=0,top=0;
    for(let part=node;part;part=part.offsetParent){
      left+=part.offsetLeft;top+=part.offsetTop;
      if(part!==node){left+=part.clientLeft;top+=part.clientTop;}
    }
    const sticky=node.closest('.sec-head,.year-group h3');
    if(sticky&&getComputedStyle(sticky).position==='sticky'){
      const parent=sticky.parentElement,base=layoutBox(parent),css=getComputedStyle(parent);
      let naturalTop=base.top+(parseFloat(css.paddingTop)||0);
      if(sticky.matches('#projects .sec-head')){
        const band=parent.querySelector('.wire-band'),bandCss=getComputedStyle(band);
        naturalTop+=band.offsetHeight+(parseFloat(bandCss.marginTop)||0)+(parseFloat(bandCss.marginBottom)||0);
      }
      let currentTop=0;for(let part=sticky;part;part=part.offsetParent)currentTop+=part.offsetTop+(part===sticky?0:part.clientTop);
      top+=naturalTop-currentTop;
    }
    const width=node.offsetWidth,height=node.offsetHeight;
    return {left,top,width,height,right:left+width,bottom:top+height};
  }
  const backToTop=document.querySelector('.footer-row a');
  const pedestrian=document.createElement('div');pedestrian.className='ped-signal';pedestrian.setAttribute('aria-hidden','true');closingScene.append(pedestrian);
  const pedPhotos=['day','night'].map(mode=>['off','go-a','go-b'].map(state=>{
    const image=document.createElement('img');image.alt='';image.width=106;image.height=160;image.decoding='async';
    const name=`ped-signal-${state}${mode==='night'?'-night':''}`;
    image.className=`mode-${mode}`;
    image.dataset.src=`images/fixtures/ped-signal/${name}.webp?v=${IMAGE_VERSION}`;
    image.dataset.srcset=`images/fixtures/ped-signal/${name}.webp?v=${IMAGE_VERSION} 1x, images/fixtures/ped-signal/${name}-2x.webp?v=${IMAGE_VERSION} 2x`;
    pedestrian.append(image);return image;
  }));
  pedPhotos[0].forEach((image,i)=>{exposureMates.set(image,pedPhotos[1][i]);exposureMates.set(pedPhotos[1][i],image);});
  const pedState={elapsed:0,hover:false,focused:false,returning:false,go:1,pose:0};
  backToTop.addEventListener('pointerenter',()=>{pedState.hover=true;paintPedestrian(0);});
  backToTop.addEventListener('pointerleave',()=>{pedState.hover=false;paintPedestrian(0);});
  backToTop.addEventListener('focus',()=>{pedState.focused=true;paintPedestrian(0);});
  backToTop.addEventListener('blur',()=>{pedState.focused=false;paintPedestrian(0);});
  backToTop.addEventListener('click',()=>{pedState.returning=!reduced.matches;paintPedestrian(0);});
  function paintPedestrian(delta){
    if(!spanVisible(finalSpan))return;
    pedState.elapsed+=delta;
    const walking=pedState.hover||pedState.focused||pedState.returning;
    // One slow cycle in 2.4s; pose crossfades never extinguish the lit lens.
    pedState.go=reduced.matches||walking?1:smoothStep((Math.cos(pedState.elapsed*Math.PI*2/2.4)+.15)*2);
    const cycle=pedState.elapsed/.6,p=cycle%1;
    pedState.pose=walking&&!reduced.matches?Math.floor(cycle)%2:0;
    const blend=walking&&!reduced.matches?smoothStep(p/.12):0;
    const a=pedState.pose===0?blend:1-blend,b=1-a,mix=nightMix();
    pedPhotos.forEach((images,i)=>{
      const exposure=i?mix:1-mix;
      opacity(images[0],assetOpacity(images[0],exposure));opacity(images[1],assetOpacity(images[1],exposure)*pedState.go*a);opacity(images[2],assetOpacity(images[2],exposure)*pedState.go*b);
    });
  }
  function drawFinalWires(force=false){
    if(!finalSpan.fit.curves.length)return;
    if(!force&&finalSpan.springs.slice(0,finalSpan.fit.visibleCount).every((spring,i)=>Math.abs(spring.x-(finalSpan.painted[i]??Infinity))<.05))return;
    finalSpan.painted=finalSpan.springs.map(s=>s.x);
    finalPaths.forEach((path,i)=>{
      path.style.display=i<finalSpan.fit.visibleCount?'':'none';
      finalMoonlightPaths[i].style.display=path.style.display;
      if(i<finalSpan.fit.visibleCount){
        const curve=wirePathData(i,false,finalSpan);path.setAttribute('d',curve);finalMoonlightPaths[i].setAttribute('d',curve);
      }
    });
  }
  let finaleTextBoxes=[],finaleMount=null;
  function fitFinalSpan(){
    const base=layoutBox(closing),mobile=innerWidth<768;
    const rows=[...document.querySelectorAll('.links a')].map(layoutBox),footer=layoutBox(document.querySelector('.footer-row'));
    const back=layoutBox(backToTop),height=mobile?64:84;
    const signalTop=(mobile?footer.top-12-height:back.top+back.height/2-height/2)-base.top;
    const top=rows.at(-1).bottom+12-base.top;
    const bottom=(mobile?signalTop-12:footer.top-base.top-12);
    const available=Math.max(1,bottom-top),count=mobile?2:3;
    const scale=Math.min(.18,Math.max(.035,(available-10)/(wireDefinitions[count-1].rightY-wireDefinitions[0].rightY+20)));
    // The photograph is cropped to its alpha bounds, at the same uniform scale
    // as production. Its shaft continues beyond the bottom of the viewport.
    const shaft=mobile?innerWidth+2:Math.max(rows.at(-1).right+20,innerWidth-90);
    const poleLeft=shaft-(2660-2235)*scale,anchorX=poleLeft-1*scale;
    const length=anchorX+16,deltaRange=(wireDefinitions[count-1].rightY-wireDefinitions[0].rightY)*scale;
    const sag=Math.max(1,Math.min(18,(available-deltaRange-14)/2));
    // The unseen left support can sit level with this pole; only the right
    // photographic attachment is fixed. Fit tension without distorting it.
    const curves=wireDefinitions.slice(0,3).map(def=>catenary(length,Math.min(4,def.deltaY*scale),sag/length));
    const samples=curves.slice(0,count).flatMap((curve,i)=>Array.from({length:65},(_,j)=>{
      const u=j/64;return (wireDefinitions[i].rightY-wireDefinitions[0].rightY)*scale-curve.delta+curve.a*(Math.cosh(curve.q-curve.z)-Math.cosh(curve.q-curve.z+2*curve.z*u));
    }));
    const min=Math.min(...samples),max=Math.max(...samples),limit=Math.max(0,Math.min(3,(available-max+min-2)/2));
    const anchorY=(available-max-min)/2;
    finalSpan.scale=scale;finalSpan.fit={left:-16,anchorX,anchorY,curves,visibleCount:count,bandTop:base.top+top,bandBottom:base.top+bottom};
    finalSpan.springs.forEach(s=>{s.limit=limit;if(Math.abs(s.x)>limit)s.reset();});
    finalPaths.forEach((path,i)=>path.dataset.restD=wirePathData(i,true,finalSpan));
    finalBand.style.cssText=`left:0;top:${top}px;width:${innerWidth}px;height:${available}px;`;
    finalSvg.setAttribute('viewBox',`0 0 ${innerWidth} ${available}`);
    const poleTop=top+anchorY-wireDefinitions[0].rightY*scale;
    finalPole.style.cssText=`left:${poleLeft}px;top:${poleTop}px;width:${755*scale}px;height:${1500*scale}px;`;
    finalPolePhotos.forEach(image=>image.style.cssText=`left:${-2235*scale}px;width:${3000*scale}px;height:${1500*scale}px;`);
    // v22a's bracket centre is (199.118,190.912) on the 212x320 master.
    const mountY=signalTop+190.912*height/320,mountX=shaft;
    const signalLeft=mountX-199.118*height/320;
    pedestrian.style.cssText=`left:${signalLeft}px;top:${signalTop}px;width:${106*height/160}px;height:${height}px;`;
    finaleMount={x:mountX,y:mountY,poleLeft,poleTop,shaftX:shaft,scale,signalLeft,signalTop,height,
      sourceBracket:[199.118,190.912],sourceLens:[88.752,227.429],extraGap:mobile?80:0};
    finaleTextBoxes=[...rows,back,layoutBox(document.querySelector('.footer-row p')),layoutBox(document.querySelector('#links-title'))]
      .map(b=>({left:b.left-base.left,right:b.right-base.left,top:b.top-base.top,bottom:b.bottom-base.top}));
    drawFinalWires(true);fitBirds(finalSpan);
    spans.forEach(cacheWireArc);
  }
  const wirePackets=[],packetEvents=[];
  let packetSequence=0;
  spans.forEach(span=>{
    span.packetClock=0;span.nextPacket=randomBetween(8,15);span.glows=span.paths.map(()=>{
      const node=document.createElement('span');node.className='wire-insulator-light';span.owner.append(node);opacity(node,0);return node;
    });
  });
  function cacheWireArc(span){
    let length=0;
    span.arc=Array.from({length:257},(_,j)=>{
      const u=j/256,p=projectedWirePoint(0,u,0,span),prior=j?projectedWirePoint(0,(j-1)/256,0,span):p;
      length+=Math.hypot(p.x-prior.x,p.y-prior.y);return {u,length};
    });
    wirePackets.filter(packet=>packet.span===span).forEach(packet=>{
      packet.start=packet.start/packet.length*length;packet.distance=packet.distance/packet.length*length;packet.length=length;
    });
    span.glows.forEach((node,i)=>{
      const p=projectedWirePoint(i,1,0,span);
      node.style.left=`${p.x+200*span.scale}px`;node.style.top=`${p.y-40*span.scale}px`;
    });
    if(span===projectSpan)span.requestU=tocLinks.map(link=>{
      const b=link.getBoundingClientRect(),base=wireSvg.getBoundingClientRect();
      return clamp((b.left+b.width/2-base.left-span.fit.left)/(span.fit.anchorX-span.fit.left));
    });
  }
  function packetEvent(packet,phase){
    packetEvents.push({id:packet.id,span:packet.span.id,phase,clock:packet.span.packetClock,link:packet.link});
    if(packetEvents.length>80)packetEvents.shift();
  }
  function sendWirePacket(span=projectSpan,u=0,request=false,link=null){
    if(reduced.matches||document.hidden||!spanVisible(span)||!span.arc||wirePackets.filter(p=>p.span===span).length>=3)return false;
    const node=document.createElement('span');node.className='wire-packet';span.owner.append(node);
    const length=span.arc.at(-1).length,start=span.arc[Math.round(clamp(u)*256)].length;
    const packet={id:++packetSequence,span,node,distance:start,start,length,speed:400,phase:request?'request':'outbound',request,link,wait:0};
    const tail=document.createElementNS(svgNS,'svg');tail.classList.add('wire-packet-tail');tail.setAttribute('aria-hidden','true');
    const defs=document.createElementNS(svgNS,'defs'),gradient=document.createElementNS(svgNS,'linearGradient');
    gradient.id=`wire-packet-tail-${packet.id}`;gradient.setAttribute('gradientUnits','userSpaceOnUse');
    for(const [offset,alpha] of [[0,0],[1,.8]]){
      const stop=document.createElementNS(svgNS,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color','currentColor');stop.setAttribute('stop-opacity',alpha);gradient.append(stop);
    }
    const path=document.createElementNS(svgNS,'path');path.setAttribute('fill','none');path.setAttribute('stroke',`url(#${gradient.id})`);path.setAttribute('stroke-width','1.4');path.setAttribute('stroke-linecap','round');
    defs.append(gradient);tail.append(defs,path);node.append(tail);packet.tail=path;packet.gradient=gradient;
    wirePackets.push(packet);packetEvent(packet,packet.phase);return true;
  }
  function wirePacketPoint(span,distance){
    const j=Math.max(1,span.arc.findIndex(point=>point.length>=Math.max(0,Math.min(span.arc.at(-1).length,distance)))),a=span.arc[j-1],b=span.arc[j];
    const u=a.u+(b.u-a.u)*(Math.max(a.length,Math.min(b.length,distance))-a.length)/(b.length-a.length);
    return {...projectedWirePoint(0,u,null,span),u};
  }
  function paintPacketTail(packet,head){
    const direction=packet.phase==='response'?-1:1;
    // Sample the same moving wire behind the core, including on the return trip.
    const points=Array.from({length:7},(_,i)=>wirePacketPoint(packet.span,packet.distance-direction*28*(1-i/6)));
    packet.tail.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${(p.x-head.x).toFixed(2)},${(p.y-head.y).toFixed(2)}`).join(' '));
    packet.gradient.setAttribute('x1',points[0].x-head.x);packet.gradient.setAttribute('y1',points[0].y-head.y);
    packet.gradient.setAttribute('x2',0);packet.gradient.setAttribute('y2',0);
  }
  tocLinks.forEach((link,i)=>{
    const send=()=>sendWirePacket(projectSpan,projectSpan.requestU?.[i]??(i+.5)/tocLinks.length,true,link.getAttribute('href'));
    link.addEventListener('pointerenter',send);link.addEventListener('focus',send);
  });
  function paintPackets(delta){
    spans.forEach(span=>{
      if(!spanVisible(span))return;
      span.packetClock+=delta;
      if(span.packetClock>=span.nextPacket){sendWirePacket(span);span.nextPacket=span.packetClock+randomBetween(8,15);}
      span.glows.forEach(node=>opacity(node,.85*smoothStep(((node._litUntil??-100)-span.packetClock)/.8)));
    });
    for(let i=wirePackets.length-1;i>=0;i--){
      const packet=wirePackets[i],span=packet.span;
      if(!spanVisible(span)){opacity(packet.node,0);continue;}
      if(packet.phase==='wait'){
        packet.wait-=delta;opacity(packet.node,0);
        if(packet.wait<=0){packet.phase='response';packetEvent(packet,'response');}else continue;
      }
      packet.distance+=(packet.phase==='response'?-1:1)*packet.speed*delta;
      if(packet.phase!=='response'&&packet.distance>=packet.length){
        const glow=span.glows[0];
        if(span.packetClock-(glow._lastLit??-100)>=.36){glow._lastLit=span.packetClock;glow._litUntil=span.packetClock+.8;}
        packetEvent(packet,'arrival');
        if(packet.request){packet.distance=packet.length;packet.phase='wait';packet.wait=.3;opacity(packet.node,0);continue;}
        packet.node.remove();wirePackets.splice(i,1);continue;
      }
      if(packet.phase==='response'&&packet.distance<=packet.start){packetEvent(packet,'returned');packet.node.remove();wirePackets.splice(i,1);continue;}
      const p=wirePacketPoint(span,packet.distance);paintPacketTail(packet,p);
      translate(packet.node,p.x,p.y);opacity(packet.node,.9);packet.u=p.u;
    }
  }
  // Conservative upper boundary from the shipped cloud alpha (>8/255),
  // pooled across day/night and base/body/top/wisps. Never decode pixels per frame.
  const cloudAlphaTop={"base":[1.0,1.0,0.84177,0.83465,0.8279,0.8219,0.80727,0.80502,0.80652,0.80352,0.79378,0.7919,0.79085,0.79003,0.78815,0.78628,0.7844,0.78215,0.78028,0.77803,0.77578,0.7739,0.7724,0.7709,0.76978,0.76903,0.76865,0.76865,0.76903,0.76903,0.76903,0.76912,0.76978,0.76987,0.77053,0.77061,0.77128,0.77136,0.77203,0.77211,0.77211,0.7724,0.77128,0.76912,0.7664,0.76303,0.75966,0.75591,0.75253,0.74953,0.74691,0.74466,0.74353,0.74278,0.74213,0.74278,0.74288,0.74363,0.74466,0.74588,0.74738,0.74888,0.75066,0.75253,0.75412,0.75591,0.75741,0.75862,0.76003,0.76078,0.76115,0.7604,0.75928,0.75741,0.75553,0.75328,0.75037,0.74813,0.74616,0.74428,0.74213,0.74063,0.73978,0.73903,0.73838,0.73838,0.73913,0.73988,0.74166,0.74363,0.74588,0.74878,0.75178,0.75478,0.75778,0.7604,0.76312,0.76537,0.76753,0.76837,0.76903,0.7694,0.76978,0.76987,0.77053,0.77053,0.77061,0.7709,0.77128,0.77128,0.77165,0.77211,0.77278,0.77353,0.77361,0.77503,0.77586,0.77736,0.78178,0.82759,0.82909,0.83508,0.87031,0.87102,0.87931,0.88489,0.88981,1.0],"body":[1.0,1.0,1.0,0.83577,0.8279,0.75066,0.73866,0.73763,0.73191,0.71466,0.70679,0.70465,0.70465,0.70915,0.70529,0.68816,0.66479,0.65742,0.65429,0.65067,0.65067,0.53281,0.52343,0.51874,0.51874,0.3892,0.36295,0.32396,0.30446,0.29959,0.2976,0.29659,0.29509,0.29359,0.2916,0.28936,0.28636,0.28336,0.28009,0.27559,0.25909,0.23885,0.22122,0.2096,0.20615,0.20615,0.20915,0.2099,0.21139,0.2141,0.21785,0.22264,0.22864,0.23435,0.23913,0.24259,0.24663,0.25037,0.25412,0.25759,0.26059,0.26237,0.26387,0.26537,0.26659,0.26762,0.26884,0.26959,0.26987,0.26959,0.26837,0.26734,0.26584,0.26462,0.26359,0.26284,0.26237,0.26237,0.26312,0.26509,0.26809,0.27136,0.27586,0.28084,0.28609,0.28984,0.29385,0.29835,0.30409,0.30934,0.31571,0.33808,0.34858,0.36057,0.37631,0.48631,0.49081,0.49475,0.4985,0.50225,0.50656,0.51049,0.51424,0.51799,0.52099,0.52399,0.52643,0.52906,0.53131,0.53356,0.70015,0.76078,0.76312,0.74503,0.74466,0.74588,0.75262,0.76753,0.77503,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0],"top":[1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,0.1721,0.17166,0.17466,0.17466,0.17166,0.1706,0.17166,0.1751,0.1796,0.21335,0.21289,0.20315,0.19715,0.19715,0.19865,0.1616,0.15442,0.13723,0.11549,0.11061,0.10945,0.11019,0.08361,0.07762,0.05737,0.04837,0.04462,0.04423,0.04198,0.03973,0.03823,0.03823,0.03748,0.03298,0.02849,0.02624,0.02624,0.02924,0.03748,0.03448,0.03523,0.03898,0.04798,0.05772,0.07946,0.07649,0.07537,0.07796,0.08471,0.09411,0.1072,0.12369,0.18891,0.18891,0.19415,0.20165,0.20135,0.18935,0.18441,0.18366,0.18635,0.1934,0.1994,0.20735,0.21364,0.24963,0.24859,0.25037,0.25759,0.24559,0.24034,0.24063,0.24588,0.25197,0.25037,0.25037,0.25159,0.25309,0.25422,0.25759,0.26237,1.0,0.26397,0.26284,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0],"wisps":[1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,0.31534,0.3036,0.30135,0.30409,0.30859,0.29621,0.29284,0.29385,0.2351,0.1721,0.17166,0.17466,0.1751,0.1721,0.17166,0.17241,0.17735,0.18216,0.21335,0.21335,0.20435,0.2039,0.2069,0.21589,0.2291,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,0.31721,0.29809,0.28561,0.27511,0.26659,0.25984,0.26012,0.25272,0.24634,0.24663,0.24663,0.25262,0.25037,0.25037,0.25159,0.25309,0.25347,0.25684,0.26087,0.27061,0.26097,0.25862,0.37383,0.37008,0.37008,0.37158,0.37481,0.37706,0.3742,0.34333,0.33933,0.33883,0.35382,0.37631,0.37181,0.37106,0.40682,0.40705,0.40855,0.41829,0.42429,0.43253,1.0,1.0]};
  let finaleSkyMap=null,finaleMeteorRouteCache=null;
  function fitVisibleFinaleSky(){
    const base=layoutBox(closingScene),cloud=layoutBox(closing.querySelector('.cumulonimbus'));
    finaleSkyMap={left:cloud.left-cloud.width/2-base.left,top:cloud.top-base.top,width:cloud.width,height:cloud.height,
      motionX:96+cloud.width*.035+4,motionY:32+cloud.height*.07+innerHeight*.075+4};
    finaleMeteorRouteCache=null;
  }
  function visibleFinaleSky(box){
    const m=finaleSkyMap;if(!m||box.left<4||box.right>innerWidth-4||box.top<0)return false;
    let ceiling=Infinity;
    for(const [part,columns] of Object.entries(cloudAlphaTop)){
      const scale=part==='top'?1.07:part==='body'?1.035:1,shift=part==='wisps'?96:0;
      const center=m.left+m.width/2;
      const left=Math.min(box.left,center+(box.left-center)/scale)-shift-4;
      const right=Math.max(box.right,center+(box.right-center)/scale)+4;
      const lo=Math.max(0,Math.floor((left-m.left)/m.width*columns.length));
      const hi=Math.min(columns.length-1,Math.floor((right-m.left)/m.width*columns.length));
      const rise=part==='top'?32:part==='body'?m.height*.008:0;
      for(let i=lo;i<=hi;i++){
        if(columns[i]===1)continue;
        const sourceY=columns[i]*m.height;
        ceiling=Math.min(ceiling,m.top+m.height-(m.height-sourceY)*scale-rise-innerHeight*.075-4);
      }
    }
    return box.bottom+4<ceiling;
  }
  function finaleEffectClear(box){
    if(!visibleFinaleSky(box)||finaleTextBoxes.some(text=>boxesIntersect(box,text,12)))return false;
    const base=geometry.get(closing);
    return [finaleLamp,finalPole,pedestrian].every(node=>{
      const b=geometry.get(node);return !b||!boxesIntersect(box,{left:b.left,right:b.left+b.width,top:b.top-base.top,bottom:b.top+b.height-base.top},12);
    });
  }
  function chooseFinaleMeteorRoute(scene){
    const top=Math.max(0,scrollY-geometry.get(closing).top),key=`${scene.width}/${scene.height}/${innerHeight}/${top}`;
    if(finaleMeteorRouteCache?.key!==key){
      const routes=[],bottom=Math.min(scene.height-12,top+innerHeight*.45);
      for(let x=12;x<scene.width-12;x+=32)for(let y=top+12;y<bottom;y+=24){
        for(const direction of [-1,1])for(const length of [Math.min(80,scene.width*.2),Math.min(140,scene.width*.3)]){
          const angle=Math.PI/6,dx=Math.cos(angle)*length*1.5*direction,dy=Math.sin(angle)*length*1.5;
          const box={left:Math.min(x,x+dx)-4,right:Math.max(x,x+dx)+4,top:y-4,bottom:y+dy+4};
          if(box.bottom<bottom&&finaleEffectClear(box))routes.push({x,y,dx,dy,length});
        }
      }
      finaleMeteorRouteCache={key,routes};
    }
    const routes=finaleMeteorRouteCache.routes;
    return routes.length?routes[Math.floor(Math.random()*routes.length)]:null;
  }
  const fireworks={elapsed:0,next:randomBetween(25,50),active:[],events:[],count:0};
  function boxesIntersect(a,b,padding=0){return a.left<b.right+padding&&a.right>b.left-padding&&a.top<b.bottom+padding&&a.bottom>b.top-padding;}
  function spawnFirework(){
    if(reduced.matches||document.hidden||menuOpen||!nightMode()||!inView.has(closing)||fireworks.active.length)return false;
    const base=geometry.get(closing),visibleTop=Math.max(0,scrollY-base.top),visibleBottom=Math.min(base.height,scrollY+innerHeight-base.top);
    const diameter=Math.max(64,Math.min(170,innerWidth*.08)),width=diameter*2,height=diameter*2.5;
    let box;
    route:for(let x=12-diameter/2;x+width-diameter/2<innerWidth-12;x+=16)for(let y=visibleTop+12;y+height<visibleBottom-12;y+=12){
      const candidate={left:x,right:x+width,top:y,bottom:y+height};
      const burstBox={left:x+diameter/2,right:x+diameter*1.5,top:y+diameter/2,bottom:y+diameter*1.68};
      if(visibleFinaleSky(burstBox)&&finaleTextBoxes.every(text=>!boxesIntersect(candidate,text,12))&&finaleEffectClear(burstBox)){box=candidate;break route;}
    }
    if(!box)return false;
    const node=document.createElement('canvas');node.className='distant-firework';node.setAttribute('aria-hidden','true');
    const dpr=Math.min(devicePixelRatio||1,2);node.width=Math.ceil(width*dpr);node.height=Math.ceil(height*dpr);
    node.style.cssText=`left:${box.left}px;top:${box.top}px;width:${width}px;height:${height}px;`;closingScene.append(node);
    const ctx=node.getContext('2d');if(!ctx){node.remove();return false;}ctx.scale(dpr,dpr);
    const count=60,grains=Array.from({length:count},(_,i)=>({angle:i*Math.PI*2/count+randomBetween(-.025,.025),
      radius:diameter*.5*(i%4===0?.48:i%4===1?.72:randomBetween(.92,1)),twinkle:i%11===0,phase:randomBetween(0,Math.PI*2)}));
    const event={box,started:fireworks.elapsed,duration:3.2,openDuration:.3,diameter,count,peak:0,peakAt:0,maxRenderedDiameter:0,samples:[]};
    const firework={node,ctx,grains,box,diameter,width,height,age:0,duration:3.2,event};fireworks.active.push(firework);
    fireworks.count++;fireworks.events.push(event);if(fireworks.events.length>20)fireworks.events.shift();return true;
  }
  function drawFirework(f){
    const {ctx,diameter:d,width,height,age}=f,cx=width/2,cy=d;
    ctx.clearRect(0,0,width,height);
    const burst=age-.8;
    let brightness=0,renderedDiameter=0;
    if(burst<0){
      const p=clamp(age/.8),travel=(1-(1-p)**2),y=height-6-(height-6-cy)*travel;
      const alpha=.95*smoothStep(age/.15)*(1-smoothStep((age-.72)/.08));
      const tail=50,gradient=ctx.createLinearGradient(cx,y,cx,y+tail);
      gradient.addColorStop(0,`rgba(235,247,255,${alpha})`);gradient.addColorStop(1,'rgba(215,238,250,0)');
      ctx.strokeStyle=gradient;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(cx,Math.min(height,y+tail));ctx.stroke();
      ctx.fillStyle=`rgba(255,255,255,${alpha})`;ctx.beginPath();ctx.arc(cx,y,1.3,0,Math.PI*2);ctx.fill();
    }else{
      brightness=.95*smoothStep(burst/.3)*(1-smoothStep((burst-.45)/1.95));
      const flash=.055*smoothStep(burst/.3)*(1-smoothStep((burst-.3)/.55));
      const reflected=ctx.createRadialGradient(cx,cy,0,cx,cy,d);
      reflected.addColorStop(0,`rgba(210,235,255,${flash})`);reflected.addColorStop(1,'rgba(210,235,255,0)');
      ctx.fillStyle=reflected;ctx.fillRect(0,0,width,height);
      f.grains.forEach(g=>{
        const drag=9,travel=g.radius*-Math.expm1(-burst*drag),velocity=g.radius*drag*Math.exp(-burst*drag);
        const gravity=d*.022*burst*burst,vy=Math.sin(g.angle)*velocity+d*.044*burst,vx=Math.cos(g.angle)*velocity;
        const x=cx+Math.cos(g.angle)*travel,y=cy+Math.sin(g.angle)*travel+gravity;
        const speed=Math.hypot(vx,vy),tail=Math.max(8,Math.min(20,speed*.035)),norm=Math.max(1,speed);
        const twinkle=g.twinkle&&burst>2? .72+.28*Math.sin((burst-2)*Math.PI*4+g.phase)**2:1;
        const alpha=brightness*twinkle,color=g.radius<d*.4?'255,255,255':'217,239,250';
        const tx=x-vx/norm*tail,ty=y-vy/norm*tail,gradient=ctx.createLinearGradient(tx,ty,x,y);
        gradient.addColorStop(0,`rgba(${color},0)`);gradient.addColorStop(1,`rgba(${color},${alpha*.7})`);
        ctx.strokeStyle=gradient;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.stroke();
        ctx.fillStyle=`rgba(${color},${alpha})`;ctx.beginPath();ctx.arc(x,y,g.radius<d*.4?1.15:.9,0,Math.PI*2);ctx.fill();
        renderedDiameter=Math.max(renderedDiameter,travel*2);
      });
    }
    f.brightness=brightness;f.renderedDiameter=renderedDiameter;
    const e=f.event;if(brightness>e.peak){e.peak=brightness;e.peakAt=age;}
    e.maxRenderedDiameter=Math.max(e.maxRenderedDiameter,renderedDiameter);
    if(!e.samples.length||age-e.samples.at(-1).age>=.05)e.samples.push({age,brightness,diameter:renderedDiameter});
  }
  function paintFireworks(delta){
    if(!inView.has(closing)||!nightMode())return;
    fireworks.elapsed+=delta;
    if(fireworks.elapsed>=fireworks.next){spawnFirework();fireworks.next=fireworks.elapsed+randomBetween(25,50);}
    fireworks.active=fireworks.active.filter(f=>{
      f.age+=realFrameDelta||delta;if(f.age>=f.duration){f.node.remove();return false;}drawFirework(f);return true;
    });
  }
  function clearFinalEffects(){
    wirePackets.forEach(p=>p.node.remove());wirePackets.length=0;spans.forEach(span=>span.glows.forEach(n=>opacity(n,0)));
    fireworks.active.forEach(f=>f.node.remove());fireworks.active=[];
  }
  function paintFinalPole(){
    if(!spanVisible(finalSpan))return;
    const mix=nightMix();finalPolePhotos.forEach((node,i)=>opacity(node,assetOpacity(node,i?mix:1-mix)));
  }
  function syncFinalVisibility(){
    for(const node of [finalBand,finalPole,pedestrian,...fireworks.active.map(f=>f.node)]){
      const box=geometry.get(node)||{top:geometry.get(closing).top+parseFloat(node.style.top),height:parseFloat(node.style.height)};
      const dormant=document.hidden||box.top>=scrollY+innerHeight||box.top+box.height<=scrollY;
      node.classList.toggle('final-effect-dormant',dormant);
      if(dormant)[node,...node.querySelectorAll('*')].forEach(child=>{child._movingAt={};child.style.willChange='';movingSurfaces.delete(child);});
    }
    if(!spanVisible(projectSpan)){
      projectSpan.glows.forEach(node=>opacity(node,0));
      wirePackets.filter(p=>p.span===projectSpan).forEach(p=>opacity(p.node,0));
    }
  }
  closing.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')nearBirds(event,70,finalSpan);},{passive:true});
  closing.addEventListener('pointerup',event=>{if(event.pointerType==='touch'&&planeGesture&&Math.hypot(event.clientX-planeGesture.x,event.clientY-planeGesture.y)<=8)nearBirds(event,50,finalSpan);},{passive:true});
  function fitSectionGaps() {
    fitWires();
    const bounds=section=>{
      let top=Infinity,bottom=-Infinity;
      section.querySelectorAll('h2,h3,p,li,dt,dd,a,time,span,button').forEach(node=>{
        const hidden=node.closest('[aria-hidden="true"]');
        if(!node.textContent.trim()||node.closest('[hidden],.visually-hidden,.split-source,.focus-ghost')||hidden&&!hidden.classList?.contains('split-visual'))return;
        // display:contents has no offset box; its text descendants provide it.
        const box=layoutBox(node);if(!box.height)return;
        top=Math.min(top,box.top);bottom=Math.max(bottom,box.bottom);
      });
      return {top,bottom};
    };
    const measured=sections.map(bounds),adjustments=[];
    for(const id of ['talks','timeline','links']){
      const section=document.getElementById(id),index=sectionIds.indexOf(id),css=getComputedStyle(section);
      const gap=parseFloat(css.getPropertyValue('--gap-section'))||(innerWidth>=961?128:72);
      const padding=parseFloat(css.paddingTop)||0,prior=parseFloat(section.style.getPropertyValue('--section-gap-adjust'))||0;
      const actual=measured[index].top-measured[index-1].bottom;
      if(Number.isFinite(actual))adjustments.push({section,padding:Math.max(0,padding+gap-actual),base:padding-prior});
    }
    adjustments.forEach(({section,padding,base})=>{
      section.style.paddingTop=`${padding}px`;section.style.setProperty('--section-gap-adjust',`${padding-base}px`);
    });
  }
  function refreshGeometry() {
    clearTimeout(geometryTimer);geometryTimer=null;
    clearTimeout(splitSourceTimer);splitSourceTimer=null;
    fitHeroTitle();
    splitLines();
    fitSkyWindows();
    fitSectionGaps();
    // Every lower edge includes its complete upward travel plus eight pixels.
    document.querySelector('.finale-sky').style.setProperty('--edge-overdraw',`${innerHeight*.025+(fine.matches?2:0)+8}px`);
    const flowDpr=devicePixelRatio||1;
    document.querySelector('.finale-low-clouds').style.setProperty('--edge-overdraw',`${Math.ceil((innerHeight*.025+(fine.matches?2:0))*flowDpr)/flowDpr+8}px`);
    document.querySelector('.cloud-parallax').style.setProperty('--edge-overdraw',`${innerHeight*.075+8}px`);
    fitPhotoSurfaces();
    sizeStars();
    const tall=portrait.matches,w=hero.clientWidth,h=hero.clientHeight;
    const c=tall?{w:1200,h:2133,n:1493,x:-189,y:640}:{w:2400,h:1350,n:1350,x:132,y:0};
    const cover=Math.max(w*(tall?1.1:1.12)/c.w,h/c.h)*(tall?1.15:1);
    const lx=c.x+c.n*192/400,ly=c.y+c.n*126/400;
    const ox=tall?w*.29-(c.x+c.n*.38)*cover:w*.20-c.w*cover*.274;
    const oy=tall?Math.max(h-c.h*cover,h*.43-ly*cover):0,x=ox+lx*cover,y=oy+ly*cover,unit=c.n/400*cover;
    
    
    
    for(const [key,val] of Object.entries({'img-x':ox,'img-y':oy,'img-width':c.w*cover,'img-height':c.h*cover}))hero.style.setProperty(`--${key}`,`${val}px`);
    sky.style.cssText=`left:0;top:0;width:${w}px;height:${h}px`;
    sky.querySelectorAll('img').forEach(img=>img.style.cssText=`position:absolute;left:${ox}px;top:${oy}px;width:${c.w*cover}px;height:${c.h*cover}px`);
    const lampPhoto=photos.find(p=>p.node===lamp),lb=tall?{x:363,y:800,w:284,h:1333}:{x:631,y:144,w:258,h:1206};
    lampPhoto.surface.style.cssText=`left:${lb.x*cover}px;top:${lb.y*cover}px;width:${lb.w*cover}px;height:${lb.h*cover}px;`;
    lampPhoto.surface.querySelectorAll('img').forEach(img=>img.style.cssText=`position:absolute;left:${-lb.x*cover}px;top:${-lb.y*cover}px;width:${c.w*cover}px;height:${c.h*cover}px`);
    const dg=tall?{x:446,y:1000,w:194,h:202}:{x:706,y:326,w:174,h:182};
    dayGlow.style.cssText=`left:${(dg.x-lb.x)*cover}px;top:${(dg.y-lb.y)*cover}px;width:${dg.w*cover}px;height:${dg.h*cover}px`;
    const dayGlowImage=dayGlow.querySelector('img'),variant=tall?'tall':'wide';
    dayGlowImage.dataset.src=`images/layers/lamp-${variant}-glow.webp?v=${IMAGE_VERSION}`;
    dayGlowImage.dataset.srcset=`images/layers/lamp-${variant}-glow.webp?v=${IMAGE_VERSION} 1x, images/layers/lamp-${variant}-2x-glow.webp?v=${IMAGE_VERSION} 2x`;
    if(sceneAssetsStarted)refreshAsset(dayGlowImage);
    dayGlowImage.style.cssText=`left:${-dg.x*cover}px;top:${-dg.y*cover}px;width:${c.w*cover}px;height:${c.h*cover}px`;
    bloom.style.left=`${x}px`;bloom.style.top=`${y}px`;bloom.style.width=bloom.style.height=`${Math.min(220,unit*62*.6)}px`;
    // Alpha-weighted glass centres and support widths measured from the masks.
    const glassSource=tall?{x:539.7552,y:1094.8262,w:193}:{x:790.8733,y:411.2604,w:176};
    const glassX=ox+glassSource.x*cover,glassY=oy+glassSource.y*cover;
    const glassWidth=glassSource.w*cover;
    const gb=tall?{x:448,y:1002,w:181,h:195}:{x:708,y:327,w:163,h:176};
    glass.style.left=`${ox+gb.x*cover}px`;glass.style.top=`${oy+gb.y*cover}px`;
    glass.style.width=`${gb.w*cover}px`;glass.style.height=`${gb.h*cover}px`;
    glass.style.maskSize=`${c.w*cover}px ${c.h*cover}px`;
    glass.style.maskPosition=`${-gb.x*cover}px ${-gb.y*cover}px`;
    // Alpha>32 hull of the existing mask; columns and arms are outside it.
    const hit=tall?{x:448,y:1002,w:181,h:195,points:[[452,1012],[567,1004],[571,1004],[628,1039],[625,1171],[615,1192],[483,1196],[452,1174],[450,1147]]}:
      {x:708,y:327,w:163,h:176,points:[[712,336],[815,329],[819,329],[870,360],[868,480],[857,498],[741,502],[712,484],[710,436]]};
    const polygon=hit.points.map(([px,py])=>[(px-hit.x)/hit.w*100,(py-hit.y)/hit.h*100]);
    lampButton.style.cssText=`left:${(hit.x-lb.x)*cover}px;top:${(hit.y-lb.y)*cover}px;width:${hit.w*cover}px;height:${hit.h*cover}px;clip-path:polygon(${polygon.map(p=>p.map(v=>`${v}%`).join(' ')).join(',')});`;
    lampButton.querySelector('svg').setAttribute('viewBox','0 0 100 100');
    lampButton.querySelector('polygon').setAttribute('points',polygon.map(p=>p.join(',')).join(' '));
    lampControl.geometry={x:ox+hit.x*cover,y:oy+hit.y*cover,width:hit.w*cover,height:hit.h*cover,glassX,glassY,glassWidth,source:hit};
    halo.style.left=`${glassX}px`;halo.style.top=`${glassY}px`;
    halo.style.width=halo.style.height=`${glassWidth*3.2}px`;
    halo.dataset.glassWidth=String(glassWidth);
    dayHalo.style.left=`${glassX}px`;dayHalo.style.top=`${glassY}px`;
    dayHalo.style.width=dayHalo.style.height=`${glassWidth*1.8}px`;
    const finaleGlassWidth=finaleLamp.clientWidth*193/280;
    const finaleBox=layoutBox(finaleLamp),finaleScene=layoutBox(finaleLamp.parentElement);
    finaleHalo.style.left=`${finaleBox.left-finaleScene.left+finaleLamp.clientWidth*174.7552/280}px`;
    finaleHalo.style.top=`${finaleBox.top-finaleScene.top+(finaleLamp.clientHeight-8)*292.8262/1331}px`;
    finaleHalo.style.width=finaleHalo.style.height=`${finaleGlassWidth*3}px`;
    finaleHalo.dataset.glassWidth=String(finaleGlassWidth);
    finaleDayHalo.style.left=finaleHalo.style.left;finaleDayHalo.style.top=finaleHalo.style.top;
    finaleDayHalo.style.width=finaleDayHalo.style.height=`${finaleGlassWidth*1.8}px`;
    const fs=finaleLamp.clientWidth/280;
    finaleDayGlow.style.cssText=`left:${81*fs}px;top:${198*fs}px;width:${194*fs}px;height:${202*fs}px`;
    finaleDayGlow.querySelector('img').style.cssText=`left:${-81*fs}px;top:${-198*fs}px;width:${280*fs}px;height:${1331*fs}px`;

    const heroTextBottom=Math.max(...['.hero-name','.hero-sub'].map(selector=>layoutBox(hero.querySelector(selector)).bottom-layoutBox(hero).top));
    const originalStripHeight=Math.max(150,Math.min(320,h*.26));
    const heroStripHeight=reduced.matches?originalStripHeight:Math.max(1,Math.min(originalStripHeight,h-heroTextBottom-12));
    heroCloudPixels=Math.ceil(Math.max(originalStripHeight*4800/900,w/1.92)*(devicePixelRatio||1));
    cloudLayers[3].style.setProperty('--paper-overdraw',`${h*.4+12}px`);
    cloudLayers.forEach((node,i)=>{
      const height=heroStripHeight,tile=Math.max(originalStripHeight*4800/900,w/1.92);
      node.style.setProperty('--tile-width',`${tile}px`);node.style.setProperty('--strip-height',`${height}px`);
      node.dataset.assetWidth=String(Math.ceil(tile*(devicePixelRatio||1)));
      node.style.left='0px';
    });
    const low=document.querySelector('.finale-low-clouds');
    low.style.setProperty('--low-tile',`${low.clientHeight*4800/900}px`);
    fitFlows();
    const rect=layoutBox(hero.querySelector('.hero-caption'));
    heroGeometry={w,h,exclusions:[{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},{left:x-unit*34,right:x+unit*34,top:y-unit*39,bottom:y+unit*39}]};
    const cr=document.querySelector('.closing-scene').getBoundingClientRect(),lr=document.querySelector('#links .sec-body').getBoundingClientRect();
    const sun=sunScenes.find(scene=>scene.owner===closing);
    sun.overlay.style.height=`${Math.min(innerHeight,cr.height)}px`;
    sun.overlay.style.top='0px';
    finaleGeometry={w:cr.width,h:cr.height,skyBottom:cr.height*.65,exclusions:[{left:lr.left,right:lr.right,top:lr.top-cr.top,bottom:lr.bottom-cr.top}]};
    // Contrails only avoid text and the moon. Keep the flock geometry unchanged.
    for(const [camera,layer,selectors] of [[heroGeometry,trailLayer,'.hero-name,.hero-sub'],[finaleGeometry,finaleTrailLayer,'#links-title,.links a']]){
      const base=layer.getBoundingClientRect();
      camera.contrailText=[...document.querySelectorAll(selectors)].map(node=>{
        const box=node.getBoundingClientRect();
        return {left:box.left-base.left,right:box.right-base.left,top:box.top-base.top,bottom:box.bottom-base.top};
      });
      if(layer===trailLayer){
        const box=moon.getBoundingClientRect();
        camera.contrailMoon={x:box.left+box.width/2-base.left,y:box.top+box.height/2-base.top,radius:Math.max(box.width,box.height)/2+24};
      }
    }
    geometry=new Map([wireFixture,...owners,...revealTargets,...lamps.map(l=>l.el),...huntTargets,...photos.map(p=>p.node)].map(node=>{
      const r=layoutBox(node);
      return[node,{top:r.top,height:r.height,left:r.left,width:r.width}];
    }));
    const heroBox=geometry.get(hero),headingBox=layoutBox(document.querySelector('#profile h2'));
    cloudDescent.distance=Math.max(1,heroBox.height*.75);
    cloudDescent.heroHeight=heroBox.height;cloudDescent.headingTop=headingBox.top;
    cloudDescent.textBottom=heroTextBottom;
    cloudDescent.stripHeight=heroStripHeight;
    const skyThreshold=cr.top+scrollY+innerHeight*.15;
    document.querySelectorAll('.links a').forEach(a=>a.classList.toggle('over-sky',a.getBoundingClientRect().bottom+scrollY>skyThreshold));
    photos.forEach(p=>{const g=geometry.get(p.node);p.top=g.top;p.height=g.height;p.layoutHeight=p.node.offsetHeight;});
    for(const layer of [trailLayer,finaleTrailLayer,planeLayer]){const box=layoutBox(layer);geometry.set(layer,box);}
    // Keep existing flights at their current coordinates, even after a large
    // resize. New flights use the refreshed geometry while old ones fade out.
    fitFinalSpan();
    for(const node of [finalBand,finalPole,pedestrian])geometry.set(node,layoutBox(node));
    fitVisibleFinaleSky();fitSplitSources();fittedViewportWidth=root.clientWidth;fittedWindowWidth=innerWidth;fittedViewportHeight=innerHeight;fittedDpr=devicePixelRatio||1;updateScroll();refreshAssetObserver();
  }
  let geometryTimer=null,fittedViewportHeight=0,fittedWindowWidth=0,fittedDpr=0;
  function queueGeometry(event){
    if(['resize','orientationchange','pageshow'].includes(event?.type)&&Math.abs(innerWidth-fittedWindowWidth)<.5&&Math.abs(innerHeight-fittedViewportHeight)<.5&&(devicePixelRatio||1)===fittedDpr)return;
    clearTimeout(geometryTimer);
    geometryTimer=setTimeout(refreshGeometry,150);
  }
  function syncSceneDormancy(){
    if(!geometry.has(hero)||!geometry.has(closing))return;
    for(const [owner,token] of [[hero,'top-dormant'],[closing,'finale-dormant']]){
      const box=geometry.get(owner),gap=Math.max(scrollY-box.top-box.height,box.top-scrollY-innerHeight,0);
      const sleeping=owner.classList.contains(token);
      const dormant=gap>(sleeping?1.5:2)*innerHeight;
      if(dormant!==sleeping){
        owner.classList.toggle(token,dormant);
        if(dormant)owner.querySelectorAll('*').forEach(node=>{
          node._movingAt={};node.style.willChange='';movingSurfaces.delete(node);
        });
      }
      // Scroll events update the scene owners synchronously, including Safari's
      // inertial scrolling and status-bar return. No observer delivery is needed.
      const visible=box.top<scrollY+innerHeight&&box.top+box.height>scrollY;
      visible?inView.add(owner):inView.delete(owner);owner.classList.toggle('in-view',visible);
    }
  }
  function syncChromeTints(){
    const y=scrollY,vh=innerHeight;let changed=false;
    chromeTints.forEach(tint=>{
      const box=geometry.get(tint.owner);if(!box)return;
      // Clamp rubber-band overscroll and Safari's extra bottom-bar space to
      // the document edges. Geometry is read only during refreshGeometry.
      const edge=tint.bottom?Math.min(y+vh,box.top+box.height):Math.max(0,y);
      // The closing scene includes its lower edge (the document's end).
      const visible=box.top<=edge&&(tint.bottom?edge<=box.top+box.height:edge<box.top+box.height);
      if(visible===tint.shown)return;
      tint.shown=visible;root.classList.toggle(tint.className,visible);changed=true;
    });
    if(changed)syncThemeColor();
  }
  function syncThemeColor(){
    // One style read per state or mode change, never per frame.
    const color=getComputedStyle(document.body).backgroundColor;
    if(themeColor.content!==color)themeColor.content=color;
  }
  function updateScroll() {
    const y=scrollY,vh=innerHeight;if(!geometry.size)return;
    if(![hero,closing,...sections].every(node=>geometry.has(node)))return;
    const hb=geometry.get(hero);root.classList.toggle('hero-out',y>=hb.height*.72);
    syncChromeTints();
    syncSceneDormancy();
    const closingBox=geometry.get(closing),closingSun=sunScenes.find(scene=>scene.owner===closing);
    syncFinalVisibility();
    if(pedState.returning&&y<=1){pedState.returning=false;paintPedestrian(0);}
    translate(closingSun.overlay,0,Math.max(0,Math.min(closingBox.height-vh,y-closingBox.top)));
    opacity(hero.querySelector('.hero-mist'),0);
    paintCloudDescent();
    revealTargets.forEach(node=>{
      if(node.hidden||node.closest('[hidden]'))return;const g=geometry.get(node);if(!g)return;
      if(g.top<y+vh*.92&&!node.classList.contains('is-visible'))reveal(node,g.top+g.height<y);
      else if(g.top>=y+vh)node.classList.remove('is-visible','is-immediate');
    });
    if(!observer)observed.forEach(node=>{
      const g=geometry.get(node);if(!g)return;const visible=g.top<y+vh&&g.top+g.height>y;
      visible?inView.add(node):inView.delete(node);node.classList.toggle('in-view',visible);
      photos.filter(p=>p.node===node).forEach(p=>p.visible=visible);lamps.filter(l=>l.el===node).forEach(l=>l.visible=visible);
    });
    let index=-1;sections.forEach((s,i)=>{if(geometry.get(s).top<=y+vh*.35)index=i;});if(index!==activeSection)setCurrent(index);
    const show=index>=0;
    if(guide.hidden===show){guide.hidden=!show;if(show)focusPull(guide,guide);}
    const start=geometry.get(sections[0]).top,end=geometry.get(sections.at(-1)).top;
    guideTarget=clamp((y+vh*.35-start)/(end-start))*vh*.4;
    if(reduced.matches){guidePosition=guideTarget;translate(guide.querySelector('.guide-progress'),0,guidePosition);}
    guide.classList.toggle('over-sky',y+vh*.5>geometry.get(closing).top+vh*.45);syncMotion();
  }
  function focusPull(el,owner,duration=durations.focus,delay=0,travel=8){
    if(reduced.matches)return;
    const phases=[0,.25,.5,.75,1];
    const clear=phases.map(p=>({offset:p,opacity:p*p,transform:`translateY(${travel*(1-p)}px)`}));
    trackAnimation(el,clear,{duration,delay,easing:easeOut,fill:'backwards'},owner);
    // The defocused exposure is painted once; only its opacity and displacement
    // change. Touch devices skip it: Safari draws colored seams on filtered layers.
    if(coarse.matches)return;
    const box=el.getBoundingClientRect(),parent=el.offsetParent||el.parentElement,parentBox=parent.getBoundingClientRect();
    const ghost=el.cloneNode(true);ghost.classList.add('focus-ghost');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
    ghost.querySelectorAll('.lamp-switch').forEach(button=>button.remove());
    [ghost,...ghost.querySelectorAll('*')].forEach(node=>{node.removeAttribute('id');node.removeAttribute('data-reveal');node.removeAttribute('tabindex');});
    const walker=document.createTreeWalker(ghost,NodeFilter.SHOW_TEXT),texts=[];
    while(walker.nextNode())texts.push(walker.currentNode);
    texts.forEach(text=>{
      const copy=document.createElement('span');copy.className='focus-ghost-text';copy.dataset.copy=text.textContent;text.replaceWith(copy);
    });
    ghost.style.cssText=`position:absolute;left:${box.left-parentBox.left+parent.scrollLeft}px;top:${box.top-parentBox.top+parent.scrollTop}px;width:${box.width}px;height:${box.height}px;margin:0;filter:blur(8px);pointer-events:none;z-index:1;`;
    const type=getComputedStyle(el);
    for(const property of ['font','letterSpacing','lineHeight','color','writingMode','textOrientation','textAlign','textShadow','whiteSpace'])ghost.style[property]=type[property];
    parent.append(ghost);
    const blurred=phases.map(p=>({offset:p,opacity:p*(1-p),transform:`translateY(${travel*(1-p)}px)`}));
    const animation=trackAnimation(ghost,blurred,{duration,delay,easing:easeOut,fill:'both'},owner);
    animation.finished.then(()=>ghost.remove(),()=>ghost.remove());
  }
  function setCurrent(index) {
    activeSection=index;
    guideLinks.forEach((a,i)=>{
      a.parentElement.classList.toggle('passed',i<index);
      if(i===index){a.setAttribute('aria-current','location');lamps.find(l=>l.el===a).idleUntil=time+.7;}else a.removeAttribute('aria-current');
      a.querySelector('.guide-next').textContent=i===index&&i<sectionIds.length-1?`次　${guideLinks[i+1].getAttribute('aria-label')}`:'';
    });
    document.querySelectorAll('.menu-toc a').forEach(a=>{if(a.getAttribute('href').slice(1)===sectionIds[index])a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    location.textContent=index<0?'':guideLinks[index].getAttribute('aria-label');
    lamps.find(l=>l.el.classList.contains('mobile-location')).idleUntil=time+.7;
    if(index>=0)focusPull(location,document.querySelector('.fixed-ui'));
  }

  // Retain the 10–14s flight, 20–30s diffusion and the v21b head glint.
  function clearContrails(){liveTrails.forEach(t=>{t.animations.forEach(a=>a?.cancel());t.node.remove();});liveTrails.length=0;windowTrails.forEach(o=>{o.trail?.remove();o.trail=null;o.pending=false;});}
  function paintWindowTrails(delta){
    if(nightMode())return;
    windowTrails.forEach(o=>{
      const active=activeSection>=0&&sections[activeSection]===o.section;
      if(active&&!o.active){o.pending=true;o.elapsed=0;}
      o.active=active;
      if(!inView.has(o.node))return;
      if(o.pending){
        o.trail?.remove();o.trail=document.createElement('span');o.trail.className='window-trail';
        o.duration=randomBetween(6,8);o.node.querySelector('.window-contrails').append(o.trail);o.pending=false;
      }
      if(!o.trail)return;o.elapsed+=delta;
      const progress=clamp(o.elapsed/o.duration),fade=1-clamp((o.elapsed-o.duration)/8);
      transform(o.trail,`rotate(-12deg) scaleX(${progress})`);opacity(o.trail,.48*fade);
      if(!fade){o.trail.remove();o.trail=null;}
    });
  }
  function contrailClearance(camera,slope,intercept){
    const norm=Math.hypot(1,slope),drift=camera.h*.03*norm,padding=20;
    const text=Math.min(camera.h,...camera.contrailText.map(b=>Math.max(
      b.top-padding-intercept+slope*(b.left-padding),
      intercept-slope*(b.right+padding)-b.bottom-padding-drift)/norm));
    const moon=camera.contrailMoon;
    if(!moon)return {text,moon:Infinity};
    const offset=intercept-slope*moon.x-moon.y;
    const distance=offset<=0?-offset:offset>=drift?offset-drift:0;
    return {text,moon:distance/norm-moon.radius};
  }
  function chooseContrailRoute(camera,visibleTop,visibleBottom){
    const {w,h,contrailText,contrailMoon}=camera,padding=20;
    const bounds=slope=>[visibleTop+24+slope*w/2,Math.max(visibleTop+24,visibleBottom-24)+slope*w/2];
    for(let attempt=0;attempt<60;attempt++){
      const slope=Math.tan(randomBetween(5,16)*Math.PI/180),[low,high]=bounds(slope),intercept=randomBetween(low,high);
      const gap=contrailClearance(camera,slope,intercept);
      if(gap.text>=0&&gap.moon>=0)return {slope,intercept};
    }
    // Search every free interval instead of dropping a scheduled flight when
    // random sampling misses a narrow corridor. Prefer the most distant text.
    let best,farthest;
    for(let degrees=5;degrees<=16;degrees++){
      const slope=Math.tan(degrees*Math.PI/180),norm=Math.hypot(1,slope),drift=h*.03*norm,[low,high]=bounds(slope);
      const textEdges=contrailText.flatMap(b=>[b.top-padding+slope*(b.left-padding),b.bottom+padding+drift+slope*(b.right+padding)]);
      const edges=[low,high,...textEdges];
      if(contrailMoon){const centre=contrailMoon.y+slope*contrailMoon.x,radius=contrailMoon.radius*norm;edges.push(centre-radius,centre+radius+drift);}
      const sorted=edges.filter(y=>y>=low&&y<=high).sort((a,b)=>a-b);
      // Equal-distance points between text boundaries may fall inside a free
      // interval split by the moon, so include those points explicitly too.
      const centres=textEdges.flatMap((y,i)=>textEdges.slice(i+1).map(other=>(y+other)/2)).filter(y=>y>=low&&y<=high);
      const candidates=[...sorted,...sorted.slice(1).map((y,i)=>(y+sorted[i])/2),...centres];
      for(const intercept of candidates){
        const gap=contrailClearance(camera,slope,intercept),route={slope,intercept,clearance:gap.text};
        if(!farthest||gap.text>farthest.clearance)farthest=route;
        if(gap.text>=0&&gap.moon>=0&&(!best||gap.text>best.clearance))best=route;
      }
    }
    return best||farthest;
  }
  function spawnContrail(owner) {
    if(nightMode()||reduced.matches||!inView.has(owner.node))return;
    const camera=owner.node===hero?heroGeometry:finaleGeometry;
    if(!camera||liveTrails.filter(t=>t.owner===owner).length>=2)return;
    const {w,h}=camera,layer=owner.node===hero?trailLayer:finaleTrailLayer,base={top:geometry.get(layer).top-scrollY};
    const route=chooseContrailRoute(camera,Math.max(0,-base.top),Math.min(h,innerHeight-base.top));
    const svg=document.createElement('div');svg.classList.add('sky-trail');
    const x1=-.12*w,x2=1.12*w,y1=route.intercept-route.slope*x1,y2=route.intercept-route.slope*x2;
    const length=Math.hypot(x2-x1,y2-y1),angle=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
    svg.setAttribute('aria-hidden','true');layer.append(svg);
    const draw=randomBetween(10000,14000),diffuse=randomBetween(20000,30000),trailAnimations=[],windPieces=[];
    for(let i=0;i<36;i++){
      const u=i/36,position=document.createElement('span'),development=document.createElement('span');
      position.className='trail-piece';development.className='trail-development';
      position.style.cssText=`left:${x1+(x2-x1)*u}px;top:${y1+(y2-y1)*u}px;width:${length/36+1.2}px;height:1px;rotate:${angle}deg;`;
      position.append(development);
      if(owner.node===closing){
        const air=document.createElement('span');air.className='trail-wind-piece';
        air.style.cssText=`position:absolute;left:${x1+(x2-x1)*u}px;top:${y1+(y2-y1)*u}px;width:${length/36+1.2}px;height:1px;pointer-events:none;`;
        position.style.left=position.style.top='0px';air.append(position);svg.append(air);windPieces.push(air);
      }else svg.append(position);
      trailAnimations.push(trackAnimation(development,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:draw/36,delay:draw*i/36,easing:'linear',fill:'both'},owner.node));
      [0,1,2].forEach(index=>{
        const segment=document.createElement('span');segment.className='trail-ink';
        development.append(segment);
        const weights=[[.35,0,0,0],[0,.24,.06,0],[0,0,.06,0]][index];
        trailAnimations.push(trackAnimation(segment,[{opacity:weights[0],transform:'scaleY(1)',offset:0},{opacity:weights[1],transform:'scaleY(4)',offset:.4},{opacity:weights[2],transform:'scaleY(5)',offset:.7},{opacity:weights[3],transform:'scaleY(6)',offset:1}],{duration:diffuse,delay:draw*(i+1)/36,easing:'linear',fill:'both'},owner.node));
      });
      trailAnimations.push(trackAnimation(position,[{transform:'translateY(0)'},{transform:`translate(${-Math.sin(angle*Math.PI/180)*h*.03}px,${-Math.cos(angle*Math.PI/180)*h*.03}px)`}],{duration:draw+diffuse,easing:'linear',fill:'both'},owner.node));
    }
    const glint=document.createElement('span');glint.className='contrail-glint';glint.setAttribute('aria-hidden','true');svg.append(glint);
    liveTrails.push({node:svg,animations:trailAnimations,owner,until:owner.elapsed+(draw+diffuse)/1000,
      glint,windPieces,x1,y1,x2,y2,angle,h,draw:draw/1000,duration:(draw+diffuse)/1000,started:owner.elapsed,glintFrequency:randomBetween(2,4)});owner.trails++;
  }
  function paintContrailGlints(delta=0){
    liveTrails.forEach(trail=>{
      if(!inView.has(trail.owner.node))return;
      const age=trail.owner.elapsed-trail.started,p=clamp(age/trail.draw),drift=age/trail.duration;
      const angle=trail.angle*Math.PI/180;
      if(trail.owner.node===closing){
        trail.windDistance=(trail.windDistance||0)+18*windStrength()*delta;
        trail.windPieces.forEach(piece=>translate(piece,Math.cos(angle)*trail.windDistance,Math.sin(angle)*trail.windDistance));
      }
      const wind=trail.windDistance||0;
      translate(trail.glint,trail.x1+(trail.x2-trail.x1)*p-Math.sin(angle)*trail.h*.03*drift+Math.cos(angle)*wind,
        trail.y1+(trail.y2-trail.y1)*p-Math.cos(angle)*trail.h*.03*drift+Math.sin(angle)*wind);
      opacity(trail.glint,age<trail.draw?.8+.2*Math.sin(age*2*Math.PI*trail.glintFrequency):0);
    });
  }

  const skyPlayScenes=[{owner:hero,holder:hero.querySelector('.hero-scene')},{owner:closing,holder:document.querySelector('.closing-scene')}].map(scene=>{
    const field=document.createElement('div');field.className='distant-flock';field.setAttribute('aria-hidden','true');scene.holder.append(field);
    if(scene.owner===hero)field.classList.add('top-decoration');
    return {...scene,field,birds:[],elapsed:0};
  });
  let flockClock=0,nextFlock=randomBetween(35,70);
  function clearFlocks(){skyPlayScenes.forEach(scene=>{scene.birds.forEach(bird=>bird.node.remove());scene.birds=[];});}
  function spawnFlock(scene,avoidance=false,command=false){
    if(reduced.matches||nightMode())return;
    const camera=scene.owner===hero?heroGeometry:finaleGeometry;if(!camera)return;
    const visibleTop=Math.max(0,scrollY-(geometry.get(scene.owner)?.top||0));
    const height=Math.min(avoidance?camera.h:camera.h/2,visibleTop+innerHeight*.45);
    if(height<=visibleTop+(command?88:40))return false;
    const routes=command?Array.from({length:Math.max(1,Math.floor((height-visibleTop-88)/4))},(_,i)=>visibleTop+44+i*4):
      Array.from({length:40},()=>randomBetween(Math.max(20,visibleTop+20),height-16));
    const clearance=command?44:20;
    const exclusions=command?camera.contrailText||camera.exclusions:camera.exclusions;
    const safe=routes.filter(y=>exclusions.every(b=>y+clearance<b.top||y-clearance>b.bottom));
    const y=command?safe[Math.floor(Math.random()*safe.length)]:safe[0];if(y===undefined)return false;
    const direction=command?1:Math.random()<.5?1:-1;
    const duration=randomBetween(6,9),count=command?Math.floor(randomBetween(9,16)):Math.floor(randomBetween(3,7));
    const spread=command?(count-1)*Math.max(6,14*innerWidth/1920)*1.8:0;
    const speed=command?(camera.w+50+spread)/duration:randomBetween(40,70);
    for(let i=0;i<count;i++){
      const node=document.createElement('span');node.className=command?'flock-bird command-bird':'flock-bird';const size=command?Math.max(6,randomBetween(8,14)*innerWidth/1920):randomBetween(4,6);node.style.width=`${size}px`;node.style.height=`${size*.8}px`;scene.field.append(node);
      const poses=spritePoses(node,'birds',['sparrow-flap-up','sparrow-flap-down']);
      scene.birds.push({node,poses,pose:-1,age:0,direction,speed,command,size,duration,frequency:randomBetween(8,10),phase:i*.71,
        x:direction===1?-20-i*(command?size*1.8:14):camera.w+20+i*14,y:y+(i%2?1:-1)*i*(command?1.5:3),
        vx:direction*speed,vy:0,homeY:y+(i%2?1:-1)*i*(command?1.5:3),width:camera.w,avoidAt:avoidance?0:null});
    }
    return true;
  }
  function paintFlocks(delta){
    if(reduced.matches||nightMode())return;
    const visible=skyPlayScenes.filter(scene=>inView.has(scene.owner));if(!visible.length)return;
    flockClock+=delta;
    if(flockClock>=nextFlock){
      const available=visible.filter(scene=>scene.owner===hero||scrollY-(geometry.get(scene.owner)?.top||0)<finaleGeometry.h/2-40);
      if(available.length)spawnFlock(available[Math.floor(Math.random()*available.length)]);
      nextFlock=flockClock+randomBetween(35,70);
    }
    visible.forEach(scene=>{
      scene.birds=scene.birds.filter(bird=>{
        const step=bird.command?(realFrameDelta||delta):delta;bird.age+=step;
        if(bird.command){
          const neighbors=scene.birds.filter(b=>b!==bird&&Math.hypot(b.x-bird.x,b.y-bird.y)<75);
          let separation=0,alignment=0,cohesion=0;
          neighbors.forEach(b=>{const dy=bird.y-b.y,dist=Math.hypot(bird.x-b.x,dy);
            if(dist<bird.size*1.8)separation+=(dy||Math.sin(bird.phase))*18/Math.max(1,dist);
            alignment+=b.vy;cohesion+=b.y-bird.y;});
          const n=Math.max(1,neighbors.length),target=(bird.homeY-bird.y)*.6+separation+alignment/n*.25+cohesion/n*.08;
          bird.vy+=(target-bird.vy)*(1-Math.exp(-step*2));
          bird.vx+=(bird.speed-bird.vx)*(1-Math.exp(-step*2));bird.x+=bird.vx*step;bird.y+=bird.vy*step;
          // The full flock stays within the selected text-free upper corridor.
          bird.y=Math.max(bird.homeY-5,Math.min(bird.homeY+5,bird.y));
        }
        const x=bird.command?bird.x:bird.x+bird.direction*bird.speed*bird.age;
        if(bird.direction===1?x>bird.width+30:x< -30){bird.node.remove();return false;}
        showPose(bird,Math.floor(bird.age*bird.frequency*2+bird.phase)%2);
        const avoidance=bird.avoidAt===null?0:36*-Math.expm1(-(bird.age-bird.avoidAt)/.45)*Math.exp(-(bird.age-bird.avoidAt)/3);
        translate(bird.node,x,bird.y+2*Math.sin(bird.age*2+bird.phase)-avoidance);bird.avoidance=avoidance;return true;
      });
    });
  }

  const planeLayer=document.createElement('div');planeLayer.className='paper-planes';planeLayer.setAttribute('aria-hidden','true');document.querySelector('.closing-scene').append(planeLayer);
  const paperPlanes=[];
  const planePlay={throws:0,rewardUsed:false,rewards:0,rewardTextMax:0,textOverlapMax:0,evades:0,collisions:[],formationCount:0,launches:0,leftLaunches:0};
  try{
    planePlay.throws=Math.max(0,Number(sessionStorage.getItem('portfolio-plane-throws'))||0);
    planePlay.rewardUsed=sessionStorage.getItem('portfolio-plane-reward')==='1';
  }catch{/* Page-lifetime state still works when storage is unavailable. */}
  // Nose and centre-fold tail measured in the original 2x cutouts (144×84,
  // 144×90). object-fit scales each uniformly, preserving these directions.
  const planeNativeHeadings=[Math.atan2(-54,106),Math.atan2(-61,103)].map(angle=>angle*180/Math.PI);
  let planeClock=0,nextPlane=randomBetween(6,10),planeGesture=null;
  function paperPlaneSkyBounds(){
    const cached=geometry.get(planeLayer),box={...cached,top:cached.top-scrollY};
    return {left:Math.max(0,-box.left),right:Math.min(box.width,innerWidth-box.left),
      top:Math.max(0,-box.top),bottom:Math.min(box.height,innerHeight-box.top)};
  }
  // v22f gliding physics. y is height (up); z is distance behind the near plane.
  const planeLaunchDirections=[];
  function nextPlaneLaunchDirection(){
    if(!planeLaunchDirections.length){
      planeLaunchDirections.push(-1,-1,-1,-1,1,1,1,1,1,1);
      for(let i=planeLaunchDirections.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));[planeLaunchDirections[i],planeLaunchDirections[j]]=[planeLaunchDirections[j],planeLaunchDirections[i]];
      }
    }
    return planeLaunchDirections.pop();
  }
  function planePhysicsParameters(width=innerWidth){
    const unit=Math.max(.45,Math.min(1,width/960)),V0=115*unit,g=170*unit,gamma0=-Math.atan(1/7);
    return {V0,g,kL:g*Math.cos(gamma0)/(V0*V0),kD:-g*Math.sin(gamma0)/(V0*V0),
      gamma0,f:Math.max(320,width*.65),width:Math.max(26,Math.min(72,width*.075)),unit};
  }
  function planeNoise(seed){
    return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  }
  function createPlaneGlider(x,y,bounds,options={},width=innerWidth,rng=Math.random){
    const between=(a,b)=>a+rng()*(b-a),aero=planePhysicsParameters(width);
    const direction=options.direction??(rng()<.4?-1:1),cx=(bounds.left+bounds.right)/2,cy=(bounds.top+bounds.bottom)/2;
    const z=options.z??between(0,aero.f*(1/.6-1)),scale=aero.f/(aero.f+z);
    const injected=options.vx!==undefined||options.vy!==undefined;
    const V=injected?Math.hypot(options.vx||0,options.vy||0)/scale:aero.V0*between(1.05,1.35);
    const gamma=injected?Math.atan2(-(options.vy||0),Math.abs(options.vx||0)):between(-5,15)*Math.PI/180;
    const psi=injected?(options.vx<0?Math.PI:0):(direction<0?Math.PI:0)+between(-30,30)*Math.PI/180;
    const stall=!injected&&!options.reward&&rng()<1/6,gentle=!injected&&!options.reward;
    const noiseSeed=Math.floor(rng()*4294967296);
    return {aero,cx:gentle?x:cx,cy:gentle?y:cy,x:gentle?x:cx+(x-cx)/scale,y:gentle?0:(cy-y)/scale,z,V,gamma,psi,gentle,direction,departure:null,phi:options.reward ? .65 : between(-.12,.12),
      rollRate:0,rollForce:0,nextRoll:between(.35,.9),forceUntil:0,turnProgress:0,turnComplete:false,
      stallStart:stall?between(.4,.85):Infinity,stallDuration:between(.5,.75),stalled:false,age:0,noiseSeed,rng:planeNoise(noiseSeed),controlled:injected};
  }
  function projectPlaneGlider(flight,windVx=0,windVy=0){
    const {aero,x,y,z,V,gamma,psi,cx,cy}=flight,scale=aero.f/(aero.f+z);
    const horizontal=V*Math.cos(gamma),dx=horizontal*Math.cos(psi)+windVx,dy=V*Math.sin(gamma)-windVy;
    const dz=!flight.gentle&&z<=0?Math.max(0,horizontal*Math.sin(psi)):horizontal*Math.sin(psi),depthRate=scale*scale*dz/aero.f;
    // Smoothly compress the vertical excursion to +/-30px. Its derivative is
    // also projected, so the nose follows the actual visible tangent.
    const vertical=y*scale,verticalRate=-dy*scale+y*depthRate;
    return {x:cx+(x-cx)*scale,y:cy-(flight.gentle?30*Math.tanh(vertical/30):vertical),scale,
      vx:dx*scale-(x-cx)*depthRate,vy:flight.gentle?verticalRate/Math.cosh(vertical/30)**2:verticalRate};
  }
  function stepPlaneGlider(plane,delta){
    const f=plane.flight,a=f.aero;
    let remaining=delta;
    while(remaining>1e-8){
      const dt=Math.min(1/120,remaining);remaining-=dt;f.age+=dt;
      if(f.age>=f.nextRoll){
        const broad=f.rng()<.22;
        f.rollForce=(f.rng()*2-1)*(f.gentle?(broad?.8:.14):(broad?2.4:.35));f.forceUntil=f.age+(broad?1.2:.65);
        f.nextRoll=f.age+1.2+f.rng()*1.8;
      }
      const rewardTurn=plane.reward&&!f.turnComplete;
      let bankTarget=rewardTurn?1.05:0;
      if(!f.gentle&&!rewardTurn&&f.z<55*a.unit&&Math.sin(f.psi)<-.08)bankTarget=Math.cos(f.psi)>=0?.45:-.45;
      const force=rewardTurn||f.departure||f.controlled?0:f.age<f.forceUntil?f.rollForce:0;
      f.rollRate+=(2.8*(bankTarget-f.phi)-2.4*f.rollRate+force)*dt;
      if(f.gentle)f.rollRate=Math.max(-12*Math.PI/180,Math.min(12*Math.PI/180,f.rollRate));
      const bankLimit=f.gentle?25*Math.PI/180:1.15;
      f.phi=Math.max(-bankLimit,Math.min(bankLimit,f.phi+f.rollRate*dt));
      f.stalled=f.age>=f.stallStart&&f.age<f.stallStart+f.stallDuration;
      // Lower sink and pitch damping expose only one or two gentle waves.
      const pitchTrim=f.gentle?-Math.atan(1/40):a.gamma0;
      const baseLift=a.kL*f.V*f.V*(f.gentle?Math.cos(pitchTrim)/Math.cos(a.gamma0):1),drag=a.kD*f.V*f.V*(f.gentle?7/40:1);
      // A gentle, continuous lift dip lets the nose lower and recover speed.
      const stallPhase=(f.age-f.stallStart)/f.stallDuration;
      const liftFactor=f.stalled?(f.gentle?1-.22*Math.sin(Math.PI*stallPhase)**2:.13):1;
      const lift=baseLift*liftFactor;
      const dV=-drag-a.g*Math.sin(f.gamma),dGamma=(lift*Math.cos(f.phi)-a.g*Math.cos(f.gamma))/Math.max(8*a.unit,f.V)-(f.gentle?.75*(f.gamma-pitchTrim):0);
      const dPsi=lift*Math.sin(f.phi)/(Math.max(8*a.unit,f.V)*Math.max(.2,Math.cos(f.gamma)));
      f.V=Math.max(12*a.unit,f.V+dV*dt);
      f.gamma=Math.max(-1.35,Math.min(1.35,f.gamma+dGamma*dt));
      if(!f.departure)f.psi+=dPsi*dt;
      if(f.gentle&&!f.departure){
        const yaw=Math.atan2(Math.sin(f.psi-(f.direction<0?Math.PI:0)),Math.cos(f.psi-(f.direction<0?Math.PI:0)));
        if(Math.abs(yaw)>=70*Math.PI/180){f.departure=Math.sin(f.psi)>0?'away':'toward';f.departureAt=f.age;}
      }
      if(rewardTurn){f.turnProgress+=Math.abs(dPsi*dt);if(f.turnProgress>=2*Math.PI)f.turnComplete=true;}
      const horizontal=f.V*Math.cos(f.gamma);
      f.x+=(horizontal*Math.cos(f.psi)+(plane.windVx||0))*dt;
      f.y+=(f.V*Math.sin(f.gamma)-(plane.windVy||0))*dt;
      f.z=Math.max(f.gentle?-(1-1/1.28)*a.f:0,f.z+horizontal*Math.sin(f.psi)*dt);
    }
  }
  function spawnPaperPlane(x,y,options={}){
    if(reduced.matches||document.hidden||nightMode()||(!options.formation&&!inView.has(closing))||paperPlanes.length>=(options.formation?7:innerWidth<768?2:3))return false;
    const bounds=paperPlaneSkyBounds();
    if(bounds.bottom<=bounds.top||(!options.formation&&((!options.edge&&(x<bounds.left||x>bounds.right))||y<bounds.top||y>bounds.bottom)))return false;
    const node=document.createElement('span');node.className='paper-plane';node.setAttribute('aria-hidden','true');planeLayer.append(node);
    const poses=spritePoses(node,'paper-plane',['paper-plane-roll-left','paper-plane-roll-right']);
    const reward=!!options.manual&&++planePlay.throws===3&&!planePlay.rewardUsed;
    if(reward){planePlay.rewardUsed=true;planePlay.rewards++;}
    if(options.manual)try{
      sessionStorage.setItem('portfolio-plane-throws',String(planePlay.throws));
      sessionStorage.setItem('portfolio-plane-reward',planePlay.rewardUsed?'1':'0');
    }catch{/* Storage is optional. */}
    const plane={node,poses,pose:-1,x,y,bounds,age:0,vx:options.vx||0,vy:options.vy||0,duration:reward?12:randomBetween(8,12),period:randomBetween(2.2,2.8),reward,formation:!!options.formation,formationSize:options.size,phase:options.phase||0,textSeconds:0,textByBox:[],textMax:0};
    if(plane.formation){plane.duration=options.duration;node.style.width=`${options.size}px`;node.style.height=`${options.size/2}px`;node.style.left=`${-options.size/2}px`;node.style.top=`${-options.size/4}px`;}
    else{
      const direction=options.direction??(options.vx!==undefined?(options.vx<0?-1:1):nextPlaneLaunchDirection());
      plane.flight=createPlaneGlider(plane.x,plane.y,plane.bounds,{...options,direction,reward});
      plane.launch={V:plane.flight.V,gamma:plane.flight.gamma,psi:plane.flight.psi,z:plane.flight.z,direction,scale:plane.flight.aero.f/(plane.flight.aero.f+plane.flight.z),width:plane.flight.aero.width,stall:Number.isFinite(plane.flight.stallStart)};
      planePlay.launches++;if(direction<0)planePlay.leftLaunches++;
    }
    if(options.manual){
      const scene=skyPlayScenes.find(s=>s.owner===closing);if(!scene.birds.length)spawnFlock(scene,true);
      scene.birds.forEach(bird=>bird.avoidAt=bird.age);planePlay.evades++;
    }
    paperPlanes.push(plane);paintPaperPlane(plane);return plane;
  }
  function paintPaperPlane(plane){
    if(plane.falling){paintFallingPlane(plane);return;}
    const p=clamp(plane.age/plane.duration),phase=plane.age*2*Math.PI/plane.period;
    let {x,y,scale,vx,vy}=plane.formation?{x:plane.x,y:plane.y,scale:1,vx:plane.vx,vy:plane.vy}:projectPlaneGlider(plane.flight,plane.windVx,plane.windVy);
    if(plane.formation){
      const windX=(plane.windDistance||0)/8,windY=(plane.windDrop||0)/4;
      x=plane.x+plane.vx*plane.age+8*Math.tanh(windX);
      y=plane.y+plane.vy*plane.age+2*Math.sin(plane.age*2+plane.phase)+4*Math.tanh(windY);
      vx=plane.vx+(plane.windVx||0)/Math.cosh(windX)**2;
      vy=plane.vy+4*Math.cos(plane.age*2+plane.phase)+(plane.windVy||0)/Math.cosh(windY)**2;scale=1;
    }
    const heading=Math.atan2(vy,vx)*180/Math.PI;
    const bank=plane.formation?2*Math.sin(phase):plane.flight.phi*180/Math.PI;
    const pose=plane.formation?(Math.sin(phase)>=0?0:1):(bank>=0?1:0),nativeHeading=planeNativeHeadings[pose];
    const angle=heading-nativeHeading+(plane.formation?bank:0);
    showPose(plane,pose);
    transform(plane.node,`translate(${x.toFixed(3)}px,${y.toFixed(3)}px) rotate(${angle.toFixed(3)}deg) scale(${scale.toFixed(5)})`);
    const width=(plane.formation?plane.formationSize:plane.flight.aero.width)*scale;
    const depthOpacity=plane.flight?.gentle?(smoothStep((width-12)/4)*(1-smoothStep((scale-1.08)/.2))*(plane.flight.departure?1-smoothStep((plane.flight.age-plane.flight.departureAt)/2.4):1)):1;
    opacity(plane.node,plane.formation?1:(1-clamp((p-.88)/.12))*depthOpacity);
    if(plane.flight?.gentle&&(width<=12||scale>=1.28||plane.flight.departure&&plane.flight.age-plane.flight.departureAt>=2.4))plane.duration=plane.age;
    const previous=plane.current;plane.current={x,y,scale,vx,vy,heading,nativeHeading,angle,bank,width:(plane.formation?plane.formationSize:plane.flight.aero.width)*scale,z:plane.flight?.z,windDistance:plane.windDistance||0,windVx:plane.windVx||0};
    if(previous&&!plane.formation)checkPlaneCollision(plane,previous);
  }
  function clearPaperPlanes(){paperPlanes.forEach(plane=>plane.node.remove());paperPlanes.length=0;}
  function strikePlane(plane,kind,x,y,wire=null,u=null){
    if(plane.falling)return;
    if(wire!==null){
      const spring=finalSpan.springs[wire];spring.impulse(4*spring.omega);
      finalSpan.wind[wire].quietUntil=finalSpan.wind[wire].elapsed+4;
    }
    const before=plane.current;
    plane.falling={x,y,vx:before.vx*.35,vy:Math.max(35,before.vy*.3),scale:before.scale,at:plane.age,windX:plane.windDistance||0,windY:plane.windDrop||0};
    plane.duration=plane.age+2.4;
    planePlay.collisions.push({kind,wire,u,x,y,age:plane.age,springVelocity:wire===null?null:finalSpan.springs[wire].v});
    if(planePlay.collisions.length>30)planePlay.collisions.shift();
    paintFallingPlane(plane);
  }
  function checkPlaneCollision(plane,previous){
    const current=plane.current,band=geometry.get(finalBand),base=geometry.get(planeLayer);
    if(!band||!finaleMount)return;
    const top=band.top-base.top;
    for(let wire=0;wire<finalSpan.fit.visibleCount;wire++){
      // Sweep the whole segment, including fast reward flights at 4x CPU.
      let last=null;
      for(let j=0;j<=24;j++){
        const t=j/24,x=previous.x+(current.x-previous.x)*t,y=previous.y+(current.y-previous.y)*t;
        const u=(x-finalSpan.fit.left)/(finalSpan.fit.anchorX-finalSpan.fit.left);
        if(u<0||u>1){last=null;continue;}
        const difference=y-top-wireRestY(wire,u,finalSpan)-wireDisplacement(wire,u,finalSpan);
        if(Math.abs(difference)<=3*current.scale||last&&Math.sign(difference)!==Math.sign(last.difference)){
          strikePlane(plane,'wire',x,top+wireRestY(wire,u,finalSpan)+wireDisplacement(wire,u,finalSpan),wire,u);return;
        }
        last={difference};
      }
    }
    const noseRadius=plane.flight.aero.width*.25*current.scale;
    const shaft={left:finaleMount.shaftX-80*finalSpan.scale-noseRadius,right:finaleMount.shaftX+80*finalSpan.scale+noseRadius,
      top:finaleMount.poleTop-noseRadius,bottom:finaleMount.poleTop+1500*finalSpan.scale+noseRadius};
    for(let j=0;j<=24;j++){
      const t=j/24,x=previous.x+(current.x-previous.x)*t,y=previous.y+(current.y-previous.y)*t;
      if(x>=shaft.left&&x<=shaft.right&&y>=shaft.top&&y<=shaft.bottom){strikePlane(plane,'pole',x,y);return;}
    }
  }
  function paintFallingPlane(plane){
    const f=plane.falling,age=plane.age-f.at,decay=Math.exp(-age*.8),gravity=180;
    const x=f.x+f.vx*(1-decay)/.8+(plane.windDistance||0)-f.windX,y=f.y+f.vy*(1-decay)/.8+gravity/.8*(age-(1-decay)/.8)+(plane.windDrop||0)-f.windY;
    const vx=f.vx*decay+(plane.windVx||0),vy=f.vy*decay+gravity/.8*(1-decay)+(plane.windVy||0),heading=Math.atan2(vy,vx)*180/Math.PI;
    const bank=plane.flight.phi*180/Math.PI*Math.exp(-age*.7),pose=bank>=0?1:0,nativeHeading=planeNativeHeadings[pose],angle=heading-nativeHeading;
    const scale=f.scale*Math.exp(-age*.1);showPose(plane,pose);
    transform(plane.node,`translate(${x.toFixed(3)}px,${y.toFixed(3)}px) rotate(${angle.toFixed(3)}deg) scale(${scale.toFixed(5)})`);
    opacity(plane.node,(1-smoothStep((age-1.6)/.8))*(1-nightMix()));
    plane.current={x,y,vx,vy,heading,nativeHeading,angle,bank,scale,width:plane.flight.aero.width*scale,falling:true};
  }
  function paintPaperPlanes(delta){
    if(reduced.matches||document.hidden||nightMode()||(!inView.has(closing)&&!paperPlanes.some(p=>p.formation&&spanVisible(finalSpan))))return;
    planeClock+=delta;
    const ordinary=paperPlanes.filter(p=>!p.formation),maximum=innerWidth<768?2:3;
    ordinary.slice(maximum).forEach(p=>{p.node.remove();paperPlanes.splice(paperPlanes.indexOf(p),1);});
    if(planeClock>=nextPlane){
      const bounds=paperPlaneSkyBounds(),direction=nextPlaneLaunchDirection();
      const edge=Math.random()<.5;
      const x=edge?(direction<0?bounds.right+40:bounds.left-40):bounds.left+(bounds.right-bounds.left)*randomBetween(.15,.85);
      const y=bounds.top+(bounds.bottom-bounds.top)*randomBetween(.1,.9);
      spawnPaperPlane(x,y,{direction,edge});
      nextPlane=planeClock+randomBetween(30,50);
    }
    for(let i=paperPlanes.length-1;i>=0;i--){
      const plane=paperPlanes[i],step=plane.formation?realFrameDelta:delta;plane.age+=step;
      if(plane.flight)plane.flight.aero.width=planePhysicsParameters().width;
      const response=1-Math.exp(-delta/1.2);
      plane.windVx=(plane.windVx||0)+(18*windStrength()-(plane.windVx||0))*response;
      plane.windVy=(plane.windVy||0)+(4*windStrength()-(plane.windVy||0))*response;
      plane.windDistance=(plane.windDistance||0)+plane.windVx*delta;plane.windDrop=(plane.windDrop||0)+plane.windVy*delta;
      if(plane.age>=plane.duration){plane.node.remove();paperPlanes.splice(i,1);}else {
        const previous=plane.current;
        if(!plane.formation&&!plane.falling)stepPlaneGlider(plane,step);
        paintPaperPlane(plane);
        const c=plane.current,r=plane.formation?plane.formationSize*.56:0;
        if(plane.formation){
          finaleTextBoxes.forEach((b,j)=>{
            const length=previous?Math.hypot(c.x-previous.x,c.y-previous.y):0;
            const hit=length?formationLineHit(previous,{x:(c.x-previous.x)/length,y:(c.y-previous.y)/length},b,r):null;
            const fraction=hit?Math.max(0,Math.min(length,hit.hi)-Math.max(0,hit.lo))/length:!length&&boxesIntersect({left:c.x-r,right:c.x+r,top:c.y-r,bottom:c.y+r},b)?1:0;
            plane.textByBox[j]=(plane.textByBox[j]||0)+step*fraction;
          });
          planePlay.formation.textOverlapMax=Math.max(planePlay.formation.textOverlapMax,...plane.textByBox.map(seconds=>seconds||0));
        }
      }
    }
  }
  closing.addEventListener('pointerdown',event=>{planeGesture={x:event.clientX,y:event.clientY,id:event.pointerId};},{passive:true});
  closing.addEventListener('pointercancel',()=>planeGesture=null,{passive:true});
  function throwPaperPlane(event){
    const gesture=planeGesture;planeGesture=null;
    if(reduced.matches||event.defaultPrevented||event.button!==0||!gesture||Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8||!getSelection()?.isCollapsed)return;
    if(event.target.closest('a,button,input,textarea,select,[contenteditable],p,h1,h2,h3,h4,time,.links,.split-text'))return;
    const box=planeLayer.getBoundingClientRect();
    if(event.clientY<box.top||event.clientY>box.bottom||event.clientX<box.left||event.clientX>box.right)return;
    spawnPaperPlane(event.clientX-box.left,event.clientY-box.top,{manual:true});
  }
  closing.addEventListener('click',throwPaperPlane);
  function visibleAnimation(s) {
    if(s.owner===guide)return!guide.hidden;
    if(s.owner?.classList.contains('fixed-ui'))return root.classList.contains('hero-out');
    if(s.owner?.id==='menu')return!s.owner.hidden;
    if(inView.has(s.owner))return true;
    const g=geometry.get(s.node)||geometry.get(s.owner);return!!g&&g.top<scrollY+innerHeight&&g.top+g.height>scrollY;
  }
  function hasRunningAnimation(node){
    // All sharp-exposure animations are registered here. Querying the DOM's
    // animations after per-letter writes would require pending style updates.
    for(const state of animations)if(state.node===node&&state.animation.playState==='running')return true;
    return false;
  }
  function syncMotion() {
    root.classList.toggle('page-hidden',document.hidden);
    const running=!document.hidden&&!reduced.matches&&!menuOpen;
    animations.forEach(s=>{if(document.hidden||reduced.matches||(menuOpen&&s.owner!==menu)||!visibleAnimation(s))s.animation.pause();else if(s.animation.playState==='paused')s.animation.play();});
    if(!running){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastFrame=null;if(reduced.matches&&motionReady)applyReducedMotion();return;}
    if(frame===null)frame=requestAnimationFrame(tick);
  }
  function tick(timestamp) {
    frame=null;
    if(reduced.matches){lastFrame=null;applyReducedMotion();return;}
    if(document.hidden||menuOpen)return;
    if(!geometry.has(closing)||!heroGeometry||!finaleGeometry){lastFrame=null;frame=requestAnimationFrame(tick);return;}
    realFrameDelta=lastFrame===null?0:(timestamp-lastFrame)/1000;
    const delta=Math.min(realFrameDelta,.1);lastFrame=timestamp;time+=delta;
    releaseStillSurfaces();
    paintMode();
    const light=sunlight(time);
    stepWind(delta);
    paintFlows(delta);
    if(inView.has(hero))paintHeroLetters(delta);
    if(inView.has(document.querySelector('.cloud-parallax')))finaleCloudTime+=delta;
    stepPointer(delta);
    if(!guide.hidden){guidePosition+=(guideTarget-guidePosition)*.06;translate(guide.querySelector('.guide-progress'),0,guidePosition);}
    sunScenes.forEach(scene=>{if(inView.has(scene.owner))scene.elapsed+=delta;});paintSun(light);
    photos.forEach(p=>{
      if(p.cloudName?!inView.has(hero):!p.visible)return;p.elapsed+=delta;
      const scroll=clamp((scrollY+innerHeight*.5-p.top)/Math.max(innerHeight,p.height))-.5;
      const depth=nightMode()?p.nightDepth:p.depth;
      p.x=fine.matches?easedPointer.x*depth:0;
      p.y=(fine.matches?easedPointer.y*depth:0)+scroll*innerHeight*.05;
      if(p.cloudName||p.node.classList.contains('finale-low-clouds')){
        const dpr=devicePixelRatio||1;
        p.x=Math.round(p.x*dpr)/dpr;p.y=Math.round(p.y*dpr)/dpr;
      }
      if(p.node===sky)p.y=0;
      if(p.cloudName){const index=cloudLayers.indexOf(p.node),descent=cloudDescent.layers[index];
        p.y=(fine.matches?easedPointer.y*depth:0)-(descent?.rise||0);
        transform(p.node,`translate(${p.x.toFixed(3)}px,${p.y.toFixed(3)}px) scale(${(descent?.scale||1).toFixed(6)})`);
        return;
      }
      if(p.node.classList.contains('sky-window')){
        p.x=fine.matches?easedPointer.x*2:0;p.y=fine.matches?easedPointer.y*2:0;
        translate(p.node.querySelector('.window-depth'),p.x,p.y);
        p.node.style.translate='none';return;
      }
      if(p.node.closest('.fixture')||p.node.classList.contains('finale-lamp')||p.finalName)p.x=p.y=0;
      if(p.finalName)p.node.style.translate='none';
      else if(p.node===lamp){p.node.style.translate='none';translate(p.surface,p.x,p.y);}
      else if(p.x||p.y)translate(p.node,p.x,p.y);
      else transform(p.node,'none');
      if(p.node===lamp)translate(glow,p.x,p.y);
      if(p.finalName){
        // Every copy grows in one direction; only invisible copies reset.
        const periods={body:20,top:13,wisps:16},period=periods[p.finalName];
        let x=0,y=0,scale=1,opacity=1;
        if(period){
          const offset=Number(p.node.dataset.cloudCopy||0)*period/2;
          const clock=finaleCloudTime+offset,phase=(clock%period)/period;
          const smooth=v=>v*v*(3-2*v),fade=phase<.3?phase/.3:phase>.7?(1-phase)/.3:1;
          opacity=smooth(clamp(fade));
          if(p.finalName==='body'){scale=1+.035*phase;y=-p.layoutHeight*.008*phase;}
          if(p.finalName==='top'){scale=1+.07*phase;y=-32*phase;}
          if(p.finalName==='wisps')x=96*phase;
          p.phase=phase;p.cycle=Math.floor(clock/period);
        }
        p.elapsed=finaleCloudTime;
        p.surface.style.visibility=opacity===0?'hidden':'visible';
        p.surface.classList.toggle('is-dormant',opacity===0);
        p.surface.style.opacity=String(opacity);
        transform(p.surface,`translate(${x.toFixed(3)}px,${y.toFixed(3)}px) scale(${scale.toFixed(6)})`);
      }
    });
    lamps.forEach(l=>{if(l.visible&&(l!==topLamp||topGlassVisible())&&!l.el.hidden&&!l.el.closest('[hidden]')&&(l.el.closest('.section-guide')?l.el.hasAttribute('aria-current')||l.el.parentElement.classList.contains('passed'):true))paintLamp(l,delta);});
    if(inView.has(signal))paintSignal(delta);
    const cloudOwner=document.querySelector('.cloud-parallax');
    if(inView.has(cloudOwner)){
      const g=geometry.get(closing),scroll=clamp((scrollY+innerHeight-g.top)/(innerHeight+g.height));
      translate(cloudOwner,0,(.5-scroll)*innerHeight*.15);
    }
    if(inView.has(wireFixture)){
      stepWires(delta);
      paintBirds(delta);
      wireScene.style.translate='none'; // Fastenings and the fitted gap remain fixed.
    }
    if(spanVisible(finalSpan)){stepWires(delta,finalSpan);paintBirds(delta,finalSpan);paintPedestrian(delta);}
    paintFinalPole();paintPackets(delta);paintFireworks(delta);
    const paperVisible=sections.slice(0,-1).some(s=>inView.has(s));
    if(paperVisible&&!nightMode())dustParticles.forEach(p=>{
      p.elapsed+=delta;const phase=p.elapsed*2*Math.PI/p.duration+p.phase;
      translate(p.el,Math.sin(phase)*14,Math.cos(phase)*18);
      opacity(p.el,p.opacity*(.8+.2*Math.sin(phase*3)**8));
    });
    dust.style.visibility=paperVisible?'visible':'hidden';
    const shadeAge=time-shadeStart;
    opacity(shadow,shadeAge>=0&&shadeAge<10?.05*Math.sin(shadeAge/10*Math.PI):0);
    if(shadeAge>=0&&shadeAge<10)transform(shadow,`translateX(${shadeAge/10*200}vw)`);
    if(time>=nextHunt){
      // Touch devices skip the letter hunts for the same reason as the still hero letters.
      const eligible=coarse.matches?[]:huntTargets.filter(el=>{const g=geometry.get(el);return g&&g.top<scrollY+innerHeight&&g.top+g.height>scrollY;});
      const el=eligible[Math.floor(Math.random()*eligible.length)];if(el){const chars=el.querySelectorAll('.hero-letter,.focus-character');hunt(chars[Math.floor(Math.random()*chars.length)]);}nextHunt=time+randomBetween(5,9);
    }
    if(time>=nextLink){const eligible=lamps.filter(l=>l.el.matches('.links a')&&l.visible);if(eligible.length)eligible[Math.floor(Math.random()*eligible.length)].idleUntil=time+.9;nextLink=time+randomBetween(7,12);}
    trailOwners.forEach(o=>{if(nightMode()||!inView.has(o.node))return;o.elapsed+=delta;if(o.elapsed>=o.next){spawnContrail(o);o.next=o.elapsed+(o.node===closing?randomBetween(18,30):randomBetween(14,22));}});
    paintContrailGlints(delta);paintFlocks(delta);paintPaperPlanes(delta);
    paintWindowTrails(delta);
    paintNightSky(delta);
    for(let i=liveTrails.length-1;i>=0;i--){const t=liveTrails[i];if(t.owner.elapsed>=t.until){t.animations.forEach(a=>a?.cancel());t.node.remove();liveTrails.splice(i,1);}}
    frame=requestAnimationFrame(tick);
  }

  const meteorEvents=[];
  const starScenes=[{owner:hero,holder:hero.querySelector('.hero-scene')},{owner:closing,holder:document.querySelector('.closing-scene')}].map((scene,index)=>{
    const field=document.createElement('div');field.className='night-stars';field.setAttribute('aria-hidden','true');scene.holder.append(field);
    if(scene.owner===hero)field.classList.add('top-decoration');
    return {...scene,field,stars:[],draws:0,meteors:0,occurrences:0,followup:false,elapsed:0,next:randomBetween(5,11),active:[],index};
  });
  const commandState={index:0,count:0,last:null};
  const commandKeys=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  function formationLineHit(origin,direction,box,padding){
    if(box.right+padding<box.left-padding||box.bottom+padding<box.top-padding)return null;
    let lo=-Infinity,hi=Infinity;
    for(const [p,v,min,max] of [[origin.x,direction.x,box.left-padding,box.right+padding],[origin.y,direction.y,box.top-padding,box.bottom+padding]]){
      if(Math.abs(v)<1e-9){if(p<min||p>max)return null;continue;}
      const a=(min-p)/v,b=(max-p)/v;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
      if(lo>hi)return null;
    }
    return {lo,hi};
  }
  function formationExclusions(bounds){
    const base=geometry.get(planeLayer),padding=24;
    const boxes=spans.map(span=>({left:bounds.left,right:bounds.right,
      top:span.fit.bandTop-base.top-padding,bottom:span.fit.bandBottom-base.top+padding}));
    for(const pole of [wireFixture.querySelector('.pole-photo'),finalPole]){
      const b=geometry.get(pole)||layoutBox(pole);
      boxes.push({left:b.left-base.left-padding,right:b.left+b.width-base.left+padding,
        top:b.top-base.top-padding,bottom:b.top+b.height-base.top+padding});
    }
    return boxes.filter(b=>boxesIntersect(b,bounds));
  }
  function chooseFormationRoute(bounds){
    const width=bounds.right-bounds.left,count=innerWidth<768?3:5;
    const visibleBounds={...bounds,top:Math.max(bounds.top,innerHeight*.45)};
    const exclusions=formationExclusions(bounds),texts=finaleTextBoxes.filter(b=>boxesIntersect(b,bounds));
    const coordinates=(min,max,edges)=>{
      const sorted=[min,max,...edges.filter(v=>v>min&&v<max)].sort((a,b)=>a-b);
      return [...new Set([...sorted,...sorted.slice(1).map((v,i)=>(v+sorted[i])/2),
        ...Array.from({length:33},(_,i)=>min+(max-min)*(i+.5)/33)])];
    };
    const make=(start,end,direction,size,degrees)=>{
      const length=Math.hypot(end.x-start.x,end.y-start.y),spacing=size*1.8;
      // Equal 45-degree V arms: neighbouring aircraft are 1.8 lengths apart.
      const slots=Array.from({length:count},(_,i)=>{
        const row=Math.ceil(i/2),side=i===0?0:i%2?1:-1;
        return {along:row*spacing/Math.SQRT2,across:side*row*spacing/Math.SQRT2};
      });
      const origins=slots.map(slot=>({x:start.x-direction.x*slot.along-direction.y*slot.across,
        y:start.y-direction.y*slot.along+direction.x*slot.across}));
      const intervals=origins.map(origin=>formationLineHit(origin,direction,bounds,size*.56+10));
      const margin=Math.max(size+10,...intervals.filter(Boolean).flatMap(hit=>[-hit.lo+size+10,hit.hi-length+size+10]));
      return {start,end,direction,size,count,length,spacing,slots,origins,margin,shape:'v',kind:degrees===90?'vertical':'diagonal',degrees};
    };
    // No horizontal wire corridor or single-file fallback. First search a
    // 20-35 degree climb, allowing brief crossings of the link rows.
    // If a very short viewport exposes only the feathered mask edge, retain
    // the flight there rather than requiring an opaque patch that is absent.
    for(const visibleArea of [visibleBounds,bounds])for(const angles of [[25,20,30,35],[50,65,90]]){
      let best;
      for(const size of innerWidth<768?[22]:[36,28,22])for(const degrees of angles){
        const angle=degrees*Math.PI/180,direction={x:Math.cos(angle),y:-Math.sin(angle)};
        const gradient=direction.y/Math.max(1e-9,direction.x);
        const vertical=degrees===90;
        // Project obstacle/text corners, including both V wings and motion
        // reserves, to find gaps missed by a regular viewport grid.
        const wing=Math.ceil((count-1)/2)*size*1.8/Math.SQRT2;
        const edges=[...texts,...exclusions].flatMap(b=>{
          const pad=size*.56+10;
          return [b.left-pad,b.right+pad].flatMap(x=>[b.top-pad,b.bottom+pad].flatMap(y=>
            [-wing,0,wing].map(across=>vertical?x+across:y-gradient*(x-bounds.left)-across/direction.x)));
        });
        const offsets=vertical?coordinates(bounds.left,bounds.right,edges)
          :coordinates(bounds.top,bounds.bottom-gradient*width,edges);
        for(const offset of offsets){
          const origin=vertical?{x:offset,y:bounds.bottom}:{x:bounds.left,y:offset};
          const hit=formationLineHit(origin,direction,bounds,0);if(!hit||hit.hi<=hit.lo)continue;
          const start={x:origin.x+direction.x*hit.lo,y:origin.y+direction.y*hit.lo};
          const end={x:origin.x+direction.x*hit.hi,y:origin.y+direction.y*hit.hi};
          const plan=make(start,end,direction,size,degrees),pad=size*.56+10;
          if(!plan.origins.every(p=>formationLineHit(p,direction,visibleArea,-pad)))continue;
          const ranges=plan.origins.map(p=>formationLineHit(p,direction,bounds,pad));
          const intersects=(p,b,i,padding)=>{
            const h=formationLineHit(p,direction,b,padding),range=ranges[i];
            return h&&range&&h.hi>=range.lo&&h.lo<=range.hi?h:null;
          };
          if(plan.origins.some((p,i)=>exclusions.some(b=>intersects(p,b,i,pad))))continue;
          const overlaps=plan.origins.flatMap((p,i)=>texts.map(b=>intersects(p,b,i,pad)).filter(Boolean));
          const distance=Math.max(0,...overlaps.map(h=>h.hi-h.lo));
          // The extra 10px covers the unchanged 8px horizontal wind drift,
          // 4px vertical drift and 2px bob. A 0.5s forecast reserves headroom.
          const clear=!overlaps.length,score=distance+overlaps.reduce((sum,h)=>sum+h.hi-h.lo,0)*.01;
          if(!best||(clear&&!best.clear)||(clear===best.clear&&(score<best.score-1e-6||Math.abs(score-best.score)<1e-6&&plan.length>best.length))){
            const duration=Math.min(6,(plan.length+2*plan.margin)/Math.max(1,distance/.5));
            best={...plan,exclusions,score,distance,duration,clear,textOverlapMax:0};
          }
        }
      }
      if(best)return best;
    }
  }
  function runSkyCommand(){
    if(reduced.matches||document.hidden||menuOpen)return false;
    const owner=spanVisible(finalSpan)?closing:!hero.classList.contains('top-dormant')?hero:inView.has(closing)?closing:null;
    if(!owner)return false;
    let effect;
    if(nightMode()){
      const scene=starScenes.find(s=>s.owner===owner);scene.boostUntil=scene.elapsed+10;scene.boostStarted=scene.elapsed;scene.boostCount=0;scene.next=scene.elapsed+.1;effect='meteors';
    }else if(owner===hero){clearFlocks();if(!spawnFlock(skyPlayScenes.find(s=>s.owner===hero),false,true))return false;effect='flock';}
    else {
      const bounds=paperPlaneSkyBounds(),plan=chooseFormationRoute(bounds);
      clearPaperPlanes();let spawned=0;
      const speed=(plan.length+2*plan.margin)/plan.duration;
      for(const [i,slot] of plan.slots.entries()){
        const x=plan.start.x-plan.direction.x*(plan.margin+slot.along)-plan.direction.y*slot.across;
        const y=plan.start.y-plan.direction.y*(plan.margin+slot.along)+plan.direction.x*slot.across;
        if(spawnPaperPlane(x,y,{formation:true,vx:plan.direction.x*speed,vy:plan.direction.y*speed,size:plan.size,duration:plan.duration,phase:i*1.73}))spawned++;
      }
      planePlay.formationCount=spawned;planePlay.formation={...plan,from:bounds.left,to:bounds.right,y:plan.start.y};effect='formation';
    }
    commandState.count++;commandState.last={scene:owner===hero?'top':'finale',mode:root.dataset.mode,effect,time};return true;
  }
  document.addEventListener('keydown',event=>{
    const target=event.composedPath()[0];
    if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||target?.isContentEditable||reduced.matches){commandState.index=0;return;}
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(key===commandKeys[commandState.index])commandState.index++;
    else commandState.index=key===commandKeys[0]?1:0;
    if(commandState.index===commandKeys.length){commandState.index=0;runSkyCommand();}
  });
  function sizeStars(){
    const sizes=starScenes.map(scene=>({scene,width:scene.holder.clientWidth,height:scene.holder.clientHeight}));
    sizes.forEach(({scene,width,height})=>{
      scene.width=width;scene.height=height;
      const count=innerWidth<=720?75:150;
      const moonX=portrait.matches ? .14 : .74;
      if(scene.stars.length!==count){scene.field.replaceChildren();scene.stars=Array.from({length:count},()=>{
        let x,y;do{x=Math.random();y=Math.random()*.75;}while(scene.index===0&&Math.hypot(x-moonX,y-.17)<.09&&Math.random()<.85);
        const node=document.createElement('span');node.className='star-point';scene.field.append(node);
        return{x,y,node,r:randomBetween(.4,1.2),period:randomBetween(2,6),phase:randomBetween(0,Math.PI*2),depth:randomBetween(1,3)};
      });}
      scene.stars.forEach(star=>star.node.style.cssText=`left:${star.x*width-star.r}px;top:${star.y*height-star.r}px;width:${2*star.r}px;height:${2*star.r}px`);
      drawStars(scene,reduced.matches);
    });
  }
  function spawnMeteor(scene){
    const width=scene.width,height=scene.height;
    const caption=heroGeometry.exclusions[0],base={left:0,top:0};
    const planned=scene.index===1?chooseFinaleMeteorRoute(scene):null;
    if(scene.index===1&&!planned)return false;
    for(let attempt=0;attempt<60;attempt++){
      const direction=Math.random()<.5?-1:1,angle=randomBetween(20,40)*Math.PI/180,length=scene.index===1?randomBetween(60,Math.min(180,width*.25)):randomBetween(120,260);
      const boosted=scene.elapsed<(scene.boostUntil||0),visibleTop=Math.max(0,scrollY-(geometry.get(scene.owner)?.top||0));
      let x=randomBetween(width*.08,width*.92),y=boosted||scene.index===1?randomBetween(visibleTop+12,Math.min(height-60,visibleTop+innerHeight*.4)):randomBetween(height*.03,height*.45),dx=Math.cos(angle)*length*1.5*direction,dy=Math.sin(angle)*length*1.5;
      if(planned)({x,y,dx,dy}=planned);
      const minX=Math.min(x,x+dx),maxX=Math.max(x,x+dx),minY=y,maxY=y+dy;
      if(scene.index===0&&minX<caption.right-base.left+24&&maxX>caption.left-base.left-24&&minY<caption.bottom-base.top+24&&maxY>caption.top-base.top-24)continue;
      const pathBox={left:minX-4,right:maxX+4,top:minY-4,bottom:maxY+4};
      if(scene.index===1&&!finaleEffectClear(pathBox))continue;
      const node=document.createElement('span'),tail=document.createElement('span'),head=document.createElement('span');
      node.className='meteor';tail.className='meteor-tail';head.className='meteor-head';
      const tailLength=Math.hypot(dx,dy)*2/3;
      tail.style.width=`${tailLength}px`;tail.style.left=`${-tailLength}px`;
      node.append(tail,head);scene.field.append(node);
      scene.active.push({x,y,dx,dy,length,node,tail,head,age:0,duration:randomBetween(.6,1.1)});
      scene.meteors++;if(boosted)scene.boostCount++;meteorEvents.push(Object.freeze({scene:scene.index,time,mode:root.dataset.mode,x,y,dx,dy,pathBox,boosted,visibleSky:scene.index===0||visibleFinaleSky(pathBox)}));
      if(meteorEvents.length>100)meteorEvents.shift();return;
    }
  }
  function drawStars(scene,still=false){
    still ||= reduced.matches;
    if(!scene.width)return;
    paintStarExposure(scene);
    if(!nightMode()&&!nightMix())return;
    scene.stars.forEach(star=>{
      const twinkle=still?.72:.48+.34*Math.sin(scene.elapsed*Math.PI*2/star.period+star.phase)**2;
      const sparkle=still?0:.18*Math.max(0,Math.sin(scene.elapsed*.47+star.phase))**48;
      const box=lampControl.geometry;
      const proximity=scene.owner===hero&&box?Math.max(0,1-Math.hypot(star.x*scene.width-box.glassX,star.y*scene.height-box.glassY)/(box.glassWidth*1.6)):0;
      opacity(star.node,(twinkle+sparkle)*(1-proximity*.5*lampControl.gate));
      translate(star.node,still?0:easedPointer.x*star.depth,still?0:easedPointer.y*star.depth);
    });
    scene.active.forEach(meteor=>{
      const p=clamp(meteor.age/meteor.duration),x=meteor.x+meteor.dx*p,y=meteor.y+meteor.dy*p,tail=Math.min(p,2/3);
      const angle=Math.atan2(meteor.dy,meteor.dx)*180/Math.PI;
      translate(meteor.node,x,y);opacity(meteor.head,Math.sin(p*Math.PI));opacity(meteor.tail,Math.sin(p*Math.PI));
      transform(meteor.tail,`rotate(${angle}deg) scaleX(${tail/(2/3)})`);
    });
    scene.draws++;
  }
  function paintStarExposure(scene){
    const target=nightMode()?1:0;
    const age=performance.now()/1000-modeChangedAt;
    const progress=reduced.matches?1:softProgress(clamp((age-(target?1.2:0))/1.2));
    opacity(scene.field,(scene.fromOpacity||0)+(target-(scene.fromOpacity||0))*progress);
  }
  function paintNightSky(delta){
    if(reduced.matches){starScenes.forEach(scene=>{scene.active=[];drawStars(scene,true);});return;}
    starScenes.forEach(scene=>{
      if(!inView.has(scene.owner))return;
      if(!nightMode()){scene.active.forEach(meteor=>meteor.node.remove());scene.active=[];drawStars(scene);return;}
      scene.elapsed+=scene.index===1&&scene.elapsed<(scene.boostUntil||0)?realFrameDelta||delta:delta;
      if(scene.elapsed>=scene.next){
        spawnMeteor(scene);
        // Every sixth occurrence gets a second meteor half a second later.
        if(scene.followup){scene.followup=false;scene.next=scene.elapsed+randomBetween(5,11);}
        else {scene.occurrences++;scene.followup=scene.occurrences%6===0;scene.next=scene.elapsed+(scene.followup?.5:randomBetween(5,11));}
        if(scene.elapsed<(scene.boostUntil||0)){scene.followup=false;scene.next=scene.index===1?scene.boostStarted+.1+scene.boostCount:scene.elapsed+randomBetween(.6,1);}
      }
      scene.active.forEach(meteor=>meteor.age+=delta);scene.active=scene.active.filter(meteor=>{if(meteor.age<meteor.duration)return true;meteor.node.remove();return false;});
      drawStars(scene);
    });
  }

  const menu=document.querySelector('#menu'),menuButton=document.querySelector('.menu-btn'),closeButton=menu.querySelector('.menu-close');
  let savedOverflow='',savedPadding='',menuFocusFrame=null;
  menuButton.hidden=false;
  function openMenu(){
    preloadMode();
    if(menuOpen)return;menuOpen=true;savedOverflow=document.body.style.overflow;savedPadding=document.body.style.paddingRight;
    document.body.style.paddingRight=`${innerWidth-root.clientWidth}px`;document.body.style.overflow='hidden';
    root.classList.add('menu-open');syncMotion();menu.hidden=false;menuButton.setAttribute('aria-expanded','true');closeButton.focus({preventScroll:true});
    // A nested RAF leaves a paint opportunity before cloning or reading layout.
    menuFocusFrame=requestAnimationFrame(()=>{
      menuFocusFrame=requestAnimationFrame(()=>{menuFocusFrame=null;if(menuOpen)focusPull(menu.querySelector('.menu-panel'),menu);});
    });
  }
  function closeMenu(){
    if(menuFocusFrame!==null){cancelAnimationFrame(menuFocusFrame);menuFocusFrame=null;}
    if(!menuOpen)return;menuOpen=false;menu.hidden=true;menuButton.setAttribute('aria-expanded','false');root.classList.remove('menu-open');syncMotion();
    document.body.style.overflow=savedOverflow;document.body.style.paddingRight=savedPadding;menuButton.focus({preventScroll:true});
  }
  menuButton.addEventListener('click',openMenu);closeButton.addEventListener('click',closeMenu);menu.querySelector('.menu-backdrop').addEventListener('click',closeMenu);
  document.addEventListener('keydown',e=>{
    if(!menuOpen)return;if(e.key==='Escape'){e.preventDefault();closeMenu();return;}if(e.key!=='Tab')return;
    const items=[...menu.querySelectorAll('a[href],button')],first=items[0],last=items.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!menu.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!menu.contains(document.activeElement))){e.preventDefault();first.focus();}
  });
  document.addEventListener('focusin',e=>{if(menuOpen&&!menu.contains(e.target))closeButton.focus({preventScroll:true});});
  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
    const target=document.getElementById(a.getAttribute('href').slice(1));if(!target)return;e.preventDefault();if(menu.contains(a))closeMenu();
    target.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});history.replaceState(null,'',a.getAttribute('href'));
    const old=target.getAttribute('tabindex');target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
    target.addEventListener('blur',()=>{if(old===null)target.removeAttribute('tabindex');else target.setAttribute('tabindex',old);},{once:true});
  }));
  const historyBody=document.querySelector('.history'),rows=[...historyBody.querySelectorAll('.events > li')],groups=[...historyBody.querySelectorAll('.year-group')];
  const filter=document.createElement('div');filter.className='filter';filter.setAttribute('role','group');filter.setAttribute('aria-label','年譜の絞り込み');
  const count=document.createElement('p');count.className='count';count.setAttribute('aria-live','polite');count.setAttribute('aria-atomic','true');
  function setCount(n){const number=document.createElement('span');number.textContent=n;count.replaceChildren(number,' 件');}
  const preferredCategories=['学校','資格','仕事・インターン','CTF・ハッカソン','制作・報告','イベント・コミュニティ'];
  const usedCategories=[...new Set(rows.map(row=>row.dataset.cat).filter(Boolean))];
  const categories=['すべて',...preferredCategories.filter(category=>usedCategories.includes(category)),
    ...usedCategories.filter(category=>category!=='すべて'&&!preferredCategories.includes(category))];
  categories.forEach((category,i)=>{
    const button=document.createElement('button');button.type='button';button.textContent=category;button.setAttribute('aria-pressed',String(i===0));
    button.addEventListener('click',()=>{
      [...filter.children].forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      rows.forEach(row=>{row.hidden=category!=='すべて'&&row.dataset.cat!==category;if(!row.hidden)reveal(row,true);});
      groups.forEach(group=>group.hidden=[...group.querySelectorAll('.events > li')].every(row=>row.hidden));
      setCount(rows.filter(row=>!row.hidden).length);queueGeometry();
    });filter.append(button);
  });
  setCount(rows.length);historyBody.prepend(filter,count);
  root.classList.add('js');refreshGeometry();startSceneAssets();motionReady=true;applyMode(root.dataset.mode||'day');
  if(reduced.matches)applyReducedMotion();
  addEventListener('pointermove',e=>{if(fine.matches)pointer={x:(e.clientX/innerWidth-.5)*2,y:(e.clientY/innerHeight-.5)*2};},{passive:true});
  addEventListener('blur',()=>pointer={x:0,y:0});
  addEventListener('scroll',()=>{syncSceneDormancy();syncChromeTints();if(layoutFrame!==null)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=null;updateScroll();});},{passive:true});
  addEventListener('resize',queueGeometry);addEventListener('pageshow',queueGeometry);addEventListener('hashchange',updateScroll);portrait.addEventListener('change',queueGeometry);
  document.fonts?.ready.then(queueGeometry);
  document.fonts?.addEventListener('loadingdone',queueGeometry);
  addEventListener('orientationchange',queueGeometry);
  function applyReducedMotion() {
    windState.strength=0;windState.started=-100;windState.next=windState.elapsed+randomBetween(20,40);
    morseState.active=false;lampControl.blink=false;lampControl.from=lampControl.on?1:0;lampControl.changedAt=-100;
    lastMix=-1;paintMode();
    animations.forEach(s=>s.animation.cancel());animations.clear();clearContrails();clearFlocks();clearPaperPlanes();
    clearFinalEffects();commandState.index=0;starScenes.forEach(scene=>scene.boostUntil=0);
    finalSpan.springs.forEach(s=>s.reset());drawFinalWires(true);paintBirds(0,finalSpan);paintFinalPole();paintPedestrian(0);syncFinalVisibility();
    easedPointer={x:0,y:0};pointerVelocity.x=pointerVelocity.y=0;
    photos.forEach(p=>{
      p.node.style.translate='none';p.node.style.transform='none';p.node.style.opacity='';p.x=p.y=0;
      if(p.node.classList.contains('sky-window'))transform(p.node.querySelector('.window-depth'),'none');
      if(p.finalName){transform(p.surface,'none');opacity(p.surface,Number(p.node.dataset.cloudCopy||0)?0:1);}
      if(p.node===lamp)transform(p.surface,'none');
    });
    glow.style.translate='none';transform(glow,'none');wireScene.style.translate='none';transform(document.querySelector('.cloud-parallax'),'none');
    [...nameLetters,...subLetters].forEach(letter=>{letter.style.translate='none';transform(letter,'none');opacity(letter,1);if(letter._focusSamples){opacity(letter._focusSamples.sharp,1);opacity(letter._focusSamples.soft,0);opacity(letter._focusSamples.hunt,0);}});
    signalSpring.reset();wireSprings.forEach(spring=>spring.reset());
    signalHead.style.transform='none';signalOn.style.opacity='.78';signalBloom.style.opacity='.3';
    signalState.opacity=.78;signalState.blinkAt=-10;paintYellow(1);
    if(nightMode()){signalOn.style.opacity='0';signalBloom.style.opacity='0';}
    starScenes.forEach(scene=>{scene.active.forEach(meteor=>meteor.node.remove());scene.active=[];drawStars(scene,true);});drawWires(true);paintBirds(0);paintSun(1,true);paintFlows(0);
    shadow.style.opacity='0';shadow.style.transform='none';wireCurrent.style.opacity='0';
    lamps.forEach(l=>{paintLamp(l,0);l.el.classList.remove('is-lit');});
    paintCloudDescent();
    releaseStillSurfaces();
    revealTargets.forEach(n=>reveal(n,true));
  }
  function scheduleSteadyPaint(){
    syncMotion();applyReducedMotion();
    if(steadyFrame!==null)cancelAnimationFrame(steadyFrame);
    // A preference change may be dispatched while the previous RAF is completing.
    // Paint once more after that frame, and ignore this job if motion resumed.
    steadyFrame=requestAnimationFrame(()=>{steadyFrame=null;if(reduced.matches)applyReducedMotion();});
  }
  reduced.addEventListener('change',()=>{
    if(reduced.matches){syncMotion();scheduleSteadyPaint();}
    else {revealTargets.forEach(n=>n.classList.remove('is-immediate'));photos.forEach(p=>p.node.style.transform='');}
    queueGeometry();syncMotion();
  });
  document.addEventListener('visibilitychange',()=>{syncFinalVisibility();syncMotion();});
  addEventListener('scrollend',()=>{pedState.returning=false;paintPedestrian(0);});
  const springSnapshot=spring=>Object.freeze({x:spring.x,velocity:spring.v,f:spring.f,zeta:spring.zeta,limit:spring.limit});
  const developerLetter='電灯のあるページへようこそ。手がかりは base64 にあります。\nZmxhZ3tsaWdodF9pbl90aGVfc2t5fQ==';
  console.info(['   +---+','   | * |','   +-+-+','     |','     |',developerLetter].join('\n'));
  Object.defineProperty(window,'__motionDebug',{value:Object.freeze({
    get sceneDormancy(){return {top:hero.classList.contains('top-dormant'),finale:closing.classList.contains('finale-dormant'),wakeScreens:1.5,sleepScreens:2};},
    get menu(){return {open:menuOpen,running:frame!==null,time};},
    get visibleFinaleSky(){return {map:finaleSkyMap&&{...finaleSkyMap},alphaTop:Object.fromEntries(Object.entries(cloudAlphaTop).map(([part,columns])=>[part,[...columns]]))};},
    isVisibleFinaleSky:visibleFinaleSky,
    triggerWind:beginWind,
    triggerMorse:startMorse,
    triggerFirework:spawnFirework,
    sendWirePacket:(scene='projects',u=0,request=false)=>sendWirePacket(scene==='finale'?finalSpan:projectSpan,u,request),
    throwPaperPlane:(x,y)=>spawnPaperPlane(x,y,{manual:true}),
    launchPaperPlane:(x,y)=>spawnPaperPlane(x,y),
    clearPaperPlanes,
    get planePhysics(){return {...planePhysicsParameters(),maximum:innerWidth<768?2:3};},
    testPlaneCollision:(wire=0)=>{
      if(wire<0||wire>=finalSpan.fit.visibleCount)return false;
      const point=projectedWirePoint(wire,.45,null,finalSpan),offset=geometry.get(finalBand).top-geometry.get(planeLayer).top;
      return !!spawnPaperPlane(point.x-12,point.y+offset+20,{vx:60,vy:-120});
    },
    testPoleCollision:()=>{
      const bounds=paperPlaneSkyBounds();
      return !!spawnPaperPlane(finaleMount.shaftX-45,Math.min(bounds.bottom-24,finaleMount.poleTop+1200*finalSpan.scale),{vx:180,vy:0});
    },
    get finalWires(){return finalSpan.springs.slice(0,finalSpan.fit.visibleCount).map((s,i)=>({...springSnapshot(s),center:wireDisplacement(i,.5,finalSpan),attachment:wireDisplacement(i,1,finalSpan),leftAttachment:wireDisplacement(i,0,finalSpan)}));},
    get finalWireLayout(){
      const box=geometry.get(finalBand),rect={left:box.left,top:box.top-scrollY,width:box.width,height:box.height};
      return {...finalSpan.fit,scale:finalSpan.scale,svg:rect,mount:{...finaleMount},
        strands:finalPaths.slice(0,finalSpan.fit.visibleCount).map((_,i)=>Array.from({length:257},(_,j)=>{
          const p=projectedWirePoint(i,j/256,null,finalSpan);return {x:p.x+rect.left,y:p.y+rect.top,radius:.65,envelope:finalSpan.springs[i].limit};
        })),birds:finalSpan.birds.map(b=>({state:b.state,placed:b.placed,wire:b.wire,u:b.u,lean:b.lean||0,transform:b.node.style.transform})),
        pole:{left:finaleMount.poleLeft,top:finaleMount.poleTop,width:755*finalSpan.scale,height:1500*finalSpan.scale,sourceWidth:3000,sourceHeight:1500},
        textBoxes:finaleTextBoxes.map(b=>({...b,top:b.top+geometry.get(closing).top-scrollY,bottom:b.bottom+geometry.get(closing).top-scrollY}))};
    },
    get pedestrian(){return {...pedState,walking:pedState.hover||pedState.focused||pedState.returning,mount:{...finaleMount},opacities:pedPhotos.map(images=>images.map(n=>Number(n.style.opacity||0)))};},
    get fireworks(){return {elapsed:fireworks.elapsed,next:fireworks.next,count:fireworks.count,events:fireworks.events.map(e=>({...e,samples:e.samples.map(sample=>({...sample}))})),active:fireworks.active.map(f=>({box:{...f.box},age:f.age,duration:f.duration,diameter:f.diameter,brightness:f.brightness,renderedDiameter:f.renderedDiameter,count:f.grains.length}))};},
    get wirePackets(){return {active:wirePackets.map(p=>({id:p.id,scene:p.span.id,u:p.u,phase:p.phase,speed:p.speed,distance:p.distance})),events:packetEvents.map(e=>({...e})),clocks:spans.map(s=>({scene:s.id,clock:s.packetClock,next:s.nextPacket}))};},
    get command(){return {...commandState,last:commandState.last&&{...commandState.last},boosts:starScenes.map(s=>({scene:s.index,remaining:Math.max(0,(s.boostUntil||0)-s.elapsed)}))};},
    get planePlay(){return {...planePlay,collisions:planePlay.collisions.map(c=>({...c})),active:paperPlanes.map(p=>({reward:p.reward,formation:p.formation,falling:!!p.falling,textSeconds:p.textSeconds,textMax:p.textMax,duration:p.duration,size:p.formationSize,launch:p.launch&&{...p.launch},flight:p.flight&&{V:p.flight.V,gamma:p.flight.gamma,psi:p.flight.psi,phi:p.flight.phi,x:p.flight.x,y:p.flight.y,z:p.flight.z,stalled:p.flight.stalled,turnProgress:p.flight.turnProgress,turnComplete:p.flight.turnComplete},current:p.current&&{...p.current},x:p.x,y:p.y,age:p.age}))};},
    get wind(){return Object.freeze({...windState, strength:windStrength(),cloudSpeedMultiplier:1+.6*windStrength()});},
    get cloudDescent(){return Object.freeze({...cloudDescent,layers:cloudDescent.layers.map(layer=>({...layer}))});},
    get lamp(){return Object.freeze({...lampControl,visible:topGlassVisible(),geometry:lampControl.geometry&&{...lampControl.geometry},time:topLamp.localTime,dayIntensity:topLamp.dayIntensity,nightIntensity:topLamp.intensity,composed:topLamp.composed&&{...topLamp.composed},morse:{...morseState,duration:morseDuration,code:[...morseCode]}});},
    measureText:restingTextRect,
    get state(){return Object.freeze({time,reducedMotion:reduced.matches,activeSection:sectionIds[activeSection]||'top',visiblePhotos:photos.filter(p=>p.visible).length,running:frame!==null,animations:animations.size,trails:liveTrails.length,lamps:Object.freeze(lamps.filter(l=>l.visible).map(l=>Object.freeze({time:l.localTime,intensity:l.intensity})))});},
    get signal(){return Object.freeze({yellowOpacity,...springSnapshot(signalSpring),opacity:signalState.opacity,elapsed:signalState.elapsed,visible:inView.has(signal)});},
    get lights(){return Object.freeze({top:lamps.find(l=>l.el===glow).intensity,topFeedback:lamps.find(l=>l.el===glow).feedback,finale:lamps.find(l=>l.el===finaleLamp).intensity/.62});},
    get dayLights(){return {top:lamps.find(l=>l.el===glow).dayIntensity,finale:lamps.find(l=>l.el===finaleLamp).dayIntensity};},
    get birds(){return perchBirds.map(b=>({state:b.state,wire:b.wire,u:b.u,x:b.x,y:b.y,placed:b.placed,pose:b.pose,lean:b.lean||0,opacity:Number(b.node.style.opacity),transform:b.node.style.transform}));},
    get skyPlay(){return {flockClock,nextFlock,planeClock,nextPlane,flocks:skyPlayScenes.map(s=>s.birds.map(b=>({age:b.age,command:b.command,size:b.size,duration:b.duration,x:b.x,y:b.y,avoidance:b.avoidance||0,transform:b.node.style.transform}))),planes:paperPlanes.map(p=>({...p.current,age:p.age,duration:p.duration})),
      glints:liveTrails.map(t=>({scene:t.owner.node===hero?'top':'finale',age:t.owner.elapsed-t.started,draw:t.draw,x1:t.x1,y1:t.y1,x2:t.x2,y2:t.y2,angle:t.angle,h:t.h,duration:t.duration,windDistance:t.windDistance||0,transform:t.glint.style.transform})),
      flows:flows.filter(f=>f.isHero).map(f=>({className:f.node.className,distance:f.distance,elapsed:f.elapsed,daySpeed:f.daySpeed,nightSpeed:f.nightSpeed,speed:f.speed||0})),pointer:{...easedPointer}};},
    get wires(){return Object.freeze(wireSprings.slice(0,wireFit.visibleCount).map((spring,i)=>Object.freeze({...springSnapshot(spring),center:wireDisplacement(i,.5),attachment:wireDisplacement(i,1),leftAttachment:wireDisplacement(i,0),visible:inView.has(wireFixture)})));},
    get wireLayout(){
      const rect=wireSvg.getBoundingClientRect();
      return Object.freeze({...wireFit,angle:0,scaleY:1,scaleX:wireScale,uniformScale:wireScale,
        sagRatios:wireFit.curves.slice(0,wireFit.visibleCount).map(curve=>curve.sagRatio),
        coverageRatio:(wireFit.anchorX-16)/innerWidth,
        svg:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
        strands:wireDefinitions.slice(0,wireFit.visibleCount).map((_,i)=>Array.from({length:257},(_,j)=>{
          const p=projectedWirePoint(i,j/256);
          return Object.freeze({x:p.x+rect.left,y:p.y+rect.top,radius:i===3?.75:innerWidth<=1100?.55:.65});
        }))});
    },
    get night(){return Object.freeze({mode:root.dataset.mode,stars:starScenes.map(scene=>({count:scene.stars.length,draws:scene.draws,meteors:scene.meteors,visible:inView.has(scene.owner)})),meteorEvents:[...meteorEvents],contrails:trailOwners.reduce((sum,owner)=>sum+owner.trails,0),yellowOpacity});},
    get finale(){return Object.freeze(photos.filter(p=>p.finalName).map(p=>Object.freeze({name:p.finalName,copy:Number(p.node.dataset.cloudCopy||0),phase:p.phase||0,cycle:p.cycle||0,opacity:Number(p.surface.style.opacity||1),transform:p.surface.style.transform,elapsed:p.elapsed,visible:p.visible})));}
  })});
  syncMotion();
})();
