// Edit IMAGE_VERSION in main.js, then run this command before shipping.
// It also stamps style.css, fonts.css and main.js in index.html with a hash of their content, so a reload
// never pairs a new page with a stylesheet or script cached from the last release.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const js=readFileSync('main.js','utf8');
const version=js.match(/const IMAGE_VERSION = '([\w.-]+)'/)?.[1];
if(!version)throw new Error('Missing IMAGE_VERSION in main.js');
const check=process.argv.includes('--check');
for(const file of ['index.html','style.css']){
  const original=readFileSync(file,'utf8');
  const updated=original.replace(/(images\/[^\s"'()]+?\.(?:webp|png|jpg|jpeg|svg|avif))(?:\?v=[\w.-]+)?/g,`$1?v=${version}`);
  if(original!==updated){
    if(check)throw new Error(`${file} has unversioned or stale image URLs`);
    writeFileSync(file,updated);
  }
}
const imagePaths=[...js.matchAll(/images\/[^\n`]*?\.webp/g)];
if(imagePaths.some(match=>!js.slice(match.index+match[0].length).startsWith('?v=${IMAGE_VERSION}')))throw new Error('JavaScript image URL without IMAGE_VERSION');
// After the image URLs, so the stamp covers the final stylesheet. Line endings are normalized,
// so CRLF and LF checkouts compute the same stamp.
const stamp=file=>createHash('sha256').update(readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
const page=readFileSync('index.html','utf8');
const stamped=page.replace(/(href|src)="(style\.css|fonts\.css|main\.js)(?:\?v=[\w.-]+)?"/g,(_,attribute,file)=>`${attribute}="${file}?v=${stamp(file)}"`);
if(page!==stamped){
  if(check)throw new Error('index.html has a stale style.css, fonts.css or main.js stamp; run node tools/version-images.mjs');
  writeFileSync('index.html',stamped);
}
console.log(`Image URLs: ${version}; style.css, fonts.css and main.js stamped`);
